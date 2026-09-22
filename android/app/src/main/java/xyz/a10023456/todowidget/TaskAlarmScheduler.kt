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
    private const val CHANNEL_NAME = "闹钟铃声设置"

    private const val FULL_SCREEN_REQUEST = 15000

    // 贪睡瞬态闹钟的 todoId 前缀：与服务端任务闹钟区分，reconcile 不对账
    const val SNOOZE_TODO_PREFIX = "__snooze__"

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
        @SerialName("shared_cat") val sharedCat: Boolean = false,
        @SerialName("alarm_minute") val alarmMinute: Int? = null
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

    /**
     * 创建「待办闹钟」系统渠道：用户在系统通知设置里改铃声、关震动即对真实闹钟生效
     * （铃声由 Service 的 MediaPlayer 读取渠道声音循环播放，不用该渠道直接发通知）。
     */
    fun createChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        // 一次性改名迁移：名字不符（旧"待办闹钟"）则删除重建；之后复用渠道、保留用户自定义
        val existing = manager.getNotificationChannel(CHANNEL_ID)
        if (existing != null) {
            if (existing.name?.toString() == CHANNEL_NAME) return
            manager.deleteNotificationChannel(CHANNEL_ID)
        }

        val sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        val attributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        val channel = NotificationChannel(
            CHANNEL_ID,
            CHANNEL_NAME,
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "闹钟的铃声与震动在此设置；响铃时循环播放直到停止"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 800, 600, 800, 600)
            setSound(sound, attributes)
            lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
        }
        manager.createNotificationChannel(channel)
    }

    /** 打开系统设置中「待办闹钟」渠道详情（铃声/震动在此设置）。 */
    fun openAlarmChannelSettings(context: Context): Boolean {
        createChannel(context)
        val intent = Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS).apply {
            putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
            putExtra(Settings.EXTRA_CHANNEL_ID, CHANNEL_ID)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        return runCatching { context.startActivity(intent) }.isSuccess
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
        // 过滤贪睡瞬态记录；正常闹钟触发即删，无残留
        TaskAlarmStore.list(context)
            .filter { !it.todoId.startsWith(SNOOZE_TODO_PREFIX) }
            .sortedWith(compareBy({ it.dueDate }, { it.minute }))

    fun deleteAlarm(context: Context, key: String) {
        TaskAlarmStore.find(context, key)?.let { cancelStored(context, it) }
    }

    fun reconcile(context: Context, baseUrl: String, raw: String) {
        val payload = runCatching {
            json.decodeFromString<WebTaskAlarmSync>(raw)
        }.getOrNull() ?: return
        val normalizedBase = baseUrl.trimEnd('/')
        val byKey = payload.tasks.associateBy {
            StoredTaskAlarm.taskAlarmKey(normalizedBase, it.id)
        }
        val now = System.currentTimeMillis()

        // 贪睡瞬态记录（__snooze__ 前缀）不参与对账，由其自身触发/过期管理
        val storedAlarms = TaskAlarmStore.list(context)
            .filter { it.baseUrl == normalizedBase && !it.todoId.startsWith(SNOOZE_TODO_PREFIX) }

        // ① 服务端带闹钟的任务全部 upsert 并按未来时间注册（含新增、重装/多设备恢复、重复滚动）
        payload.tasks.forEach { task ->
            val alarmMinute = task.alarmMinute ?: return@forEach
            if (task.done || task.dueDate.isBlank()) return@forEach
            val stored = TaskAlarmStore.upsert(
                context = context,
                baseUrl = normalizedBase,
                todoId = task.id,
                title = task.title.ifBlank { "待办提醒" }.take(120),
                dueDate = task.dueDate,
                minute = alarmMinute,
                children = task.toChildren(),
                childDue = task.childDue,
                priority = task.priority,
                category = task.category,
                recurrence = task.recurrence,
                sharedCat = task.sharedCat
            )
            val triggerAt = triggerAtMillis(task.dueDate, alarmMinute)
            if (triggerAt != null && triggerAt > now && canScheduleExactAlarms(context)) {
                schedule(context, stored, triggerAt)
            } else {
                cancelPending(context, stored)
            }
        }

        // ② 本地有、但已不该存在的记录：任务 full 缺席 / done / 无日期 / 闹钟被取消 → 删除
        storedAlarms.forEach { stored ->
            val task = byKey[stored.key]
            val gone = when {
                task == null -> payload.full
                task.done || task.dueDate.isBlank() || task.alarmMinute == null -> true
                else -> false
            }
            if (gone) cancelStored(context, stored)
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
        // 闹钟已由服务端 alarm_minute 成为事实源、重复滚动由后端复制，触发即删本地记录
        TaskAlarmStore.remove(context, key)
        val firedAt = System.currentTimeMillis()
        context.getSharedPreferences(META_PREFS, Context.MODE_PRIVATE)
            .edit().putLong(KEY_LAST_FIRE, firedAt).apply()
        AlarmRingingService.start(context, alarm)
    }

    /**
     * 贪睡：本次停铃，注册 delayMs 后触发的**本地瞬态闹钟**（不写服务端）。
     * 瞬态记录 todoId 带 __snooze__ 前缀，reconcile 不对账，到点触发后即删；
     * 渲染快照（标题/子任务）沿用原闹钟记录。
     */
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
        val origTodoId = alarm.todoId.removePrefix(SNOOZE_TODO_PREFIX)
        val stored = TaskAlarmStore.upsert(
            context = context,
            baseUrl = alarm.baseUrl,
            todoId = SNOOZE_TODO_PREFIX + origTodoId,
            title = alarm.title,
            dueDate = zoned.toLocalDate().toString(),
            minute = zoned.hour * 60 + zoned.minute,
            children = alarm.children,
            childDue = alarm.childDue,
            priority = alarm.priority,
            category = alarm.category,
            recurrence = null,
            sharedCat = false
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