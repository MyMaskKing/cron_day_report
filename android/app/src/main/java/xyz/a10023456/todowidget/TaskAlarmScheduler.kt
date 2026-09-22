package xyz.a10023456.todowidget

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId

/** 任务级本地闹钟：由 Android AlarmManager 唤醒本 App，不写入系统时钟 App。 */
object TaskAlarmScheduler {
    const val CHANNEL_ID = "todo_task_alarm"
    const val EXTRA_KEY = "task_alarm_key"

    private const val FULL_SCREEN_REQUEST = 15000
    private const val TEST_NOTIFICATION_ID = 29999

    private const val META_PREFS = "task_alarm_meta"
    private const val KEY_LAST_FIRE = "last_fire_ms"

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    @Serializable
    private data class WebTaskChild(
        val id: String,
        val title: String = "",
        @SerialName("due_date") val dueDate: String? = null,
        val done: Boolean = false
    )

    @Serializable
    private data class WebTaskAlarm(
        val id: String,
        val title: String = "",
        @SerialName("due_date") val dueDate: String = "",
        val minute: Int = 0,
        val done: Boolean = false,
        @SerialName("recur_from_id") val recurFromId: Long? = null,
        val children: List<WebTaskChild> = emptyList(),
        @SerialName("child_due") val childDue: Boolean = false,
        val priority: Int? = null,
        val category: String? = null,
        val recurrence: String? = null,
        @SerialName("shared_cat") val sharedCat: Boolean = false
    )

    private fun WebTaskAlarm.toChildren(): List<TaskAlarmChild> =
        children.map { TaskAlarmChild(it.id, it.title, it.dueDate, it.done) }

    @Serializable
    private data class WebTaskAlarmSync(
        val tasks: List<WebTaskAlarm> = emptyList(),
        val full: Boolean = false
    )

    fun setFromJson(context: Context, baseUrl: String, raw: String): String {
        val payload = runCatching {
            json.decodeFromString<WebTaskAlarm>(raw)
        }.getOrElse { return "本地闹钟数据无效" }
        return upsert(
            context, baseUrl,
            todoId = payload.id,
            title = payload.title,
            dueDate = payload.dueDate,
            minute = payload.minute,
            children = payload.toChildren(),
            childDue = payload.childDue,
            priority = payload.priority,
            category = payload.category,
            recurrence = payload.recurrence,
            sharedCat = payload.sharedCat
        )
    }

    fun canScheduleExactAlarms(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        val manager = context.getSystemService(AlarmManager::class.java) ?: return false
        return manager.canScheduleExactAlarms()
    }

    fun exactAlarmSettingsIntent(context: Context): Intent? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return null
        return Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
            data = Uri.parse("package:${context.packageName}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
    }

    fun applicationDetailsSettingsIntent(context: Context): Intent =
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.parse("package:${context.packageName}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

    fun isIgnoringBatteryOptimizations(context: Context): Boolean {
        val powerManager = context.getSystemService(android.os.PowerManager::class.java) ?: return false
        return powerManager.isIgnoringBatteryOptimizations(context.packageName)
    }

    fun openBatteryOptimizationSettings(context: Context): Boolean {
        val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        val opened = runCatching { context.startActivity(intent) }.isSuccess
        if (opened) return true
        return runCatching {
            context.startActivity(applicationDetailsSettingsIntent(context))
        }.isSuccess
    }

    fun openExactAlarmSettings(context: Context): Boolean {
        if (canScheduleExactAlarms(context)) return true
        val intent = exactAlarmSettingsIntent(context) ?: return false
        val opened = runCatching { context.startActivity(intent) }.isSuccess
        if (opened) return true
        return runCatching {
            context.startActivity(applicationDetailsSettingsIntent(context))
        }.isSuccess
    }

    fun notificationsEnabled(context: Context): Boolean =
        NotificationManagerCompat.from(context).areNotificationsEnabled()

    fun openNotificationSettings(context: Context): Boolean {
        val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
            putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        return runCatching { context.startActivity(intent) }.isSuccess
    }

    fun openAlarmChannelSettings(context: Context): Boolean {
        createChannel(context)
        val intent = Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS).apply {
            putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
            putExtra(Settings.EXTRA_CHANNEL_ID, CHANNEL_ID)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        return runCatching { context.startActivity(intent) }.isSuccess
    }

    fun showTestNotification(context: Context): Boolean {
        if (!notificationsEnabled(context)) return false
        createChannel(context)
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_chip_today)
            .setContentTitle("待办闹钟测试")
            .setContentText("如果听到铃声或感到震动，说明待办提醒正常。")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .build()
        NotificationManagerCompat.from(context).notify(TEST_NOTIFICATION_ID, notification)
        return true
    }

    fun upsert(
        context: Context,
        baseUrl: String,
        todoId: String,
        title: String,
        dueDate: String,
        minute: Int,
        children: List<TaskAlarmChild> = emptyList(),
        childDue: Boolean = false,
        priority: Int? = null,
        category: String? = null,
        recurrence: String? = null,
        sharedCat: Boolean = false
    ): String {
        if (!canScheduleExactAlarms(context)) return "请先在系统设置中允许精确闹钟"
        if (todoId.isBlank()) return "任务标识无效"
        if (title.isBlank()) return "任务标题不能为空"
        if (minute !in 0..1439) return "闹钟时间无效"
        val triggerAt = triggerAtMillis(dueDate, minute) ?: return "截止日期无效"
        if (triggerAt <= System.currentTimeMillis()) return "提醒时间已过，请重新选择时间"

        val alarm = TaskAlarmStore.upsert(
            context = context,
            baseUrl = baseUrl.trimEnd('/'),
            todoId = todoId,
            title = title.take(120),
            dueDate = dueDate,
            minute = minute,
            children = children,
            childDue = childDue,
            priority = priority,
            category = category,
            recurrence = recurrence,
            sharedCat = sharedCat
        )
        try {
            schedule(context, alarm, triggerAt)
        } catch (e: RuntimeException) {
            TaskAlarmStore.remove(context, alarm.key)
            throw e
        }
        return "ok"
    }

    fun minuteOf(context: Context, baseUrl: String, todoId: String): Int {
        val key = StoredTaskAlarm.taskAlarmKey(baseUrl.trimEnd('/'), todoId)
        return TaskAlarmStore.find(context, key)?.minute ?: -1
    }

    fun cancel(context: Context, baseUrl: String, todoId: String) {
        val key = StoredTaskAlarm.taskAlarmKey(baseUrl.trimEnd('/'), todoId)
        TaskAlarmStore.find(context, key)?.let { cancelStored(context, it) }
    }

    fun listAlarms(context: Context): List<StoredTaskAlarm> =
        TaskAlarmStore.list(context).sortedWith(compareBy({ it.dueDate }, { it.minute }))

    fun deleteAlarm(context: Context, key: String) {
        TaskAlarmStore.find(context, key)?.let { cancelStored(context, it) }
    }

    fun reconcile(context: Context, baseUrl: String, raw: String) {
        val payload = runCatching {
            json.decodeFromString<WebTaskAlarmSync>(raw)
        }.getOrNull() ?: return
        val normalizedBase = baseUrl.trimEnd('/')
        val storedAlarms = TaskAlarmStore.list(context)
            .filter { it.baseUrl == normalizedBase }
        val byKey = payload.tasks.associateBy {
            StoredTaskAlarm.taskAlarmKey(normalizedBase, it.id)
        }
        val now = System.currentTimeMillis()
        val migratedOldKeys = mutableSetOf<String>()

        payload.tasks.forEach { task ->
            val oldId = task.recurFromId ?: return@forEach
            if (task.done || task.dueDate.isBlank()) return@forEach
            val newKey = StoredTaskAlarm.taskAlarmKey(normalizedBase, task.id)
            val oldKey = StoredTaskAlarm.taskAlarmKey(normalizedBase, oldId.toString())
            if (oldKey in migratedOldKeys || storedAlarms.any { it.key == newKey }) return@forEach
            val old = storedAlarms.firstOrNull { it.key == oldKey } ?: return@forEach
            val triggerAt = triggerAtMillis(task.dueDate, old.minute) ?: return@forEach
            if (triggerAt <= now) return@forEach

            val migrated = TaskAlarmStore.upsert(
                context = context,
                baseUrl = normalizedBase,
                todoId = task.id,
                title = task.title.ifBlank { old.title }.take(120),
                dueDate = task.dueDate,
                minute = old.minute,
                children = task.toChildren(),
                childDue = task.childDue,
                priority = task.priority,
                category = task.category,
                recurrence = task.recurrence,
                sharedCat = task.sharedCat
            )
            if (canScheduleExactAlarms(context)) {
                try {
                    schedule(context, migrated, triggerAt)
                } catch (e: RuntimeException) {
                    TaskAlarmStore.remove(context, migrated.key)
                    return@forEach
                }
            }
            migratedOldKeys.add(oldKey)
        }

        storedAlarms.forEach { stored ->
            val task = byKey[stored.key]
            // 贪睡中的记录：不被 reconcile 改期/覆盖；仅当任务被删除(full 缺席)或完成时取消
            if (stored.snoozeFromMs != null) {
                val gone = (task == null && payload.full) ||
                    (task != null && (task.done || task.dueDate.isBlank()))
                if (gone) cancelStored(context, stored)
                return@forEach
            }
            when {
                task == null && payload.full -> cancelStored(context, stored)
                task != null && (task.done || task.dueDate.isBlank()) -> cancelStored(context, stored)
                task != null -> {
                    val updated = stored.copy(
                        title = task.title.ifBlank { stored.title }.take(120),
                        dueDate = task.dueDate,
                        children = task.toChildren(),
                        childDue = task.childDue,
                        priority = task.priority,
                        category = task.category,
                        recurrence = task.recurrence,
                        sharedCat = task.sharedCat
                    )
                    TaskAlarmStore.upsert(
                        context = context,
                        baseUrl = updated.baseUrl,
                        todoId = updated.todoId,
                        title = updated.title,
                        dueDate = updated.dueDate,
                        minute = updated.minute,
                        children = updated.children,
                        childDue = updated.childDue,
                        priority = updated.priority,
                        category = updated.category,
                        recurrence = updated.recurrence,
                        sharedCat = updated.sharedCat,
                        snoozeFromMs = updated.snoozeFromMs
                    )
                    val triggerAt = triggerAtMillis(updated.dueDate, updated.minute)
                    when {
                        triggerAt != null && triggerAt > now && canScheduleExactAlarms(context) ->
                            schedule(context, updated, triggerAt)
                        triggerAt == null || triggerAt <= now -> cancelPending(context, updated)
                    }
                }
            }
        }
    }

    fun rescheduleAll(context: Context) {
        if (!canScheduleExactAlarms(context)) return
        TaskAlarmStore.list(context).forEach { alarm ->
            val triggerAt = triggerAtMillis(alarm.dueDate, alarm.minute)
            if (triggerAt != null && triggerAt > System.currentTimeMillis()) {
                schedule(context, alarm, triggerAt)
            } else {
                cancelPending(context, alarm)
            }
        }
    }

    fun fire(context: Context, key: String) {
        val alarm = TaskAlarmStore.find(context, key) ?: return
        TaskAlarmStore.remove(context, key)
        context.getSharedPreferences(META_PREFS, Context.MODE_PRIVATE)
            .edit().putLong(KEY_LAST_FIRE, System.currentTimeMillis()).apply()
        AlarmRingingService.start(context, alarm)
    }

    /** 贪睡：按 delayMs 后的绝对时间重新注册同一任务闹钟；连续贪睡保留首次触发时间。 */
    fun snooze(
        context: Context,
        alarm: StoredTaskAlarm,
        originalFireAtMs: Long,
        delayMs: Long
    ) {
        if (!canScheduleExactAlarms(context)) return
        val triggerAt = System.currentTimeMillis() + delayMs
        val zoned = java.time.Instant.ofEpochMilli(triggerAt)
            .atZone(java.time.ZoneId.systemDefault())
        val stored = TaskAlarmStore.upsert(
            context = context,
            baseUrl = alarm.baseUrl,
            todoId = alarm.todoId,
            title = alarm.title,
            dueDate = zoned.toLocalDate().toString(),
            minute = zoned.hour * 60 + zoned.minute,
            children = alarm.children,
            childDue = alarm.childDue,
            priority = alarm.priority,
            category = alarm.category,
            recurrence = alarm.recurrence,
            sharedCat = alarm.sharedCat,
            snoozeFromMs = alarm.snoozeFromMs ?: originalFireAtMs
        )
        schedule(context, stored, triggerAt)
    }

    /** 最近一次任务闹钟到点触发的时间戳（毫秒）；从未触发过返回 0。 */
    fun lastFireAtMillis(context: Context): Long =
        context.getSharedPreferences(META_PREFS, Context.MODE_PRIVATE)
            .getLong(KEY_LAST_FIRE, 0L)

    private fun schedule(context: Context, alarm: StoredTaskAlarm, triggerAt: Long) {
        val alarmManager = context.getSystemService(AlarmManager::class.java)
            ?: throw IllegalStateException("系统闹钟服务不可用")
        val operation = Intent(context, TaskAlarmReceiver::class.java).apply {
            action = TaskAlarmReceiver.ACTION_FIRE
            putExtra(EXTRA_KEY, alarm.key)
        }
        val operationIntent = PendingIntent.getBroadcast(
            context,
            alarm.requestCode,
            operation,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val info = AlarmManager.AlarmClockInfo(triggerAt, showIntent(context, alarm))
        alarmManager.setAlarmClock(info, operationIntent)
    }

    private fun cancelStored(context: Context, alarm: StoredTaskAlarm) {
        cancelPending(context, alarm)
        TaskAlarmStore.remove(context, alarm.key)
    }

    private fun cancelPending(context: Context, alarm: StoredTaskAlarm) {
        val alarmManager = context.getSystemService(AlarmManager::class.java)
        val operation = Intent(context, TaskAlarmReceiver::class.java).apply {
            action = TaskAlarmReceiver.ACTION_FIRE
            putExtra(EXTRA_KEY, alarm.key)
        }
        PendingIntent.getBroadcast(
            context,
            alarm.requestCode,
            operation,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )?.let { pending ->
            alarmManager?.cancel(pending)
            pending.cancel()
        }
        NotificationManagerCompat.from(context).cancel(alarm.requestCode)
    }

    private fun showIntent(context: Context, alarm: StoredTaskAlarm): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_CLEAR_TOP or
                Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(Keys.Url.name, alarm.baseUrl + "/todo?edit=" + Uri.encode(alarm.todoId))
        }
        return PendingIntent.getActivity(
            context,
            alarm.requestCode + FULL_SCREEN_REQUEST,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun createChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return

        val sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        val attributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        val channel = NotificationChannel(
            CHANNEL_ID,
            "待办闹钟",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "待办截止时间响铃或震动提醒"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 500, 500, 500)
            setSound(sound, attributes)
            lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
        }
        manager.createNotificationChannel(channel)
    }

    private fun triggerAtMillis(dueDate: String, minute: Int): Long? {
        return runCatching {
            val date = LocalDate.parse(dueDate)
            val time = LocalTime.of(minute / 60, minute % 60)
            date.atTime(time)
                .atZone(ZoneId.systemDefault())
                .toInstant()
                .toEpochMilli()
        }.getOrNull()
    }
}