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

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    @Serializable
    private data class WebTaskAlarm(
        val id: String,
        val title: String = "",
        @SerialName("due_date") val dueDate: String = "",
        val minute: Int = 0,
        val done: Boolean = false
    )

    @Serializable
    private data class WebTaskAlarmSync(
        val tasks: List<WebTaskAlarm> = emptyList(),
        val full: Boolean = false
    )

    fun setFromJson(context: Context, baseUrl: String, raw: String): String {
        val payload = runCatching {
            json.decodeFromString<WebTaskAlarm>(raw)
        }.getOrElse { return "本地闹钟数据无效" }
        return upsert(context, baseUrl, payload.id, payload.title, payload.dueDate, payload.minute)
    }

    fun canScheduleExactAlarms(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        val manager = context.getSystemService(AlarmManager::class.java) ?: return false
        return manager.canScheduleExactAlarms()
    }

    fun upsert(
        context: Context,
        baseUrl: String,
        todoId: String,
        title: String,
        dueDate: String,
        minute: Int
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
            minute = minute
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
        val byKey = payload.tasks.associateBy {
            StoredTaskAlarm.taskAlarmKey(normalizedBase, it.id)
        }

        TaskAlarmStore.list(context)
            .filter { it.baseUrl == normalizedBase }
            .forEach { stored ->
                val task = byKey[stored.key]
                when {
                    task == null && payload.full -> cancelStored(context, stored)
                    task != null && (task.done || task.dueDate.isBlank()) -> cancelStored(context, stored)
                    task != null -> {
                        val updated = stored.copy(
                            title = task.title.ifBlank { stored.title }.take(120),
                            dueDate = task.dueDate
                        )
                        TaskAlarmStore.upsert(
                            context = context,
                            baseUrl = updated.baseUrl,
                            todoId = updated.todoId,
                            title = updated.title,
                            dueDate = updated.dueDate,
                            minute = updated.minute
                        )
                        val triggerAt = triggerAtMillis(updated.dueDate, updated.minute)
                        if (triggerAt != null && triggerAt > System.currentTimeMillis()) {
                            schedule(context, updated, triggerAt)
                        } else {
                            cancelPending(context, updated)
                        }
                    }
                }
            }
    }

    fun rescheduleAll(context: Context) {
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
        showNotification(context, alarm)
    }

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

    private fun showNotification(context: Context, alarm: StoredTaskAlarm) {
        createChannel(context)
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_chip_today)
            .setContentTitle("待办提醒")
            .setContentText(alarm.title)
            .setStyle(NotificationCompat.BigTextStyle().bigText(alarm.title))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(showIntent(context, alarm))
            .setFullScreenIntent(showIntent(context, alarm), true)
            .build()
        NotificationManagerCompat.from(context).notify(alarm.requestCode, notification)
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