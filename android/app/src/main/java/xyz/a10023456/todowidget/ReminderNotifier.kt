package xyz.a10023456.todowidget

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import java.time.LocalTime

/** Local daily reminder notifications. */
object ReminderNotifier {
    private const val CHANNEL_ID = "todo_reminder"
    private const val TYPE_MORNING = "morning"
    private const val TYPE_EVENING = "evening"
    const val NOTIFICATION_MORNING = 1001
    const val NOTIFICATION_EVENING = 1002
    const val NOTIFICATION_TEST = 1003
    const val NOTIFICATION_ACTION_COMPLETE = 1004
    const val NOTIFICATION_ACTION_TOMORROW = 1005
    const val ACTION_COMPLETE = "complete"
    const val ACTION_TOMORROW = "tomorrow"

    fun check(context: Context, refreshedIds: List<Int>) {
        if (refreshedIds.isEmpty() || !hasNotificationPermission(context)) return

        val today = java.time.LocalDate.now().toString()
        var todayCount = 0
        var overdueCount = 0
        var tomorrowCount = 0
        val seenAccounts = HashSet<String>()
        val accountWidgetIds = mutableListOf<Int>()

        for (id in refreshedIds) {
            val data = WidgetRepo.cached(context, id) ?: continue
            if (!data.success || data.today != today) continue
            val owner = data.owner_name?.takeIf { it.isNotBlank() }
                ?: Prefs.getToken(context, id).takeLast(8)
            val accountKey = Prefs.getBaseUrl(context, id) + "|" + owner
            if (!seenAccounts.add(accountKey)) continue
            accountWidgetIds.add(id)

            todayCount += data.stats.today
            overdueCount += data.stats.overdue
            tomorrowCount += data.stats.tomorrow
        }

        val now = LocalTime.now()
        val morningStart = reminderTime(context, R.integer.reminder_morning_hour, R.integer.reminder_morning_minute)
        val eveningStart = reminderTime(context, R.integer.reminder_evening_hour, R.integer.reminder_evening_minute)
        when {
            now >= morningStart && now.isBefore(eveningStart) -> {
                val text = morningText(todayCount, overdueCount) ?: return
                show(context, TYPE_MORNING, NOTIFICATION_MORNING, today, "待办提醒", text, accountWidgetIds, true, todayCount > 0)
            }
            now >= eveningStart -> {
                val text = eveningText(tomorrowCount, overdueCount) ?: return
                show(context, TYPE_EVENING, NOTIFICATION_EVENING, today, "待办提醒", text, accountWidgetIds, overdueCount > 0, false)
            }
        }
    }

    fun showTest(context: Context) {
        if (!hasNotificationPermission(context)) return
        createChannel(context)
        NotificationManagerCompat.from(context).notify(
            NOTIFICATION_TEST,
            buildNotification(
                context,
                NOTIFICATION_TEST,
                "通知测试",
                "如果能看到这条通知，说明待办提醒可以正常显示。"
            ).build()
        )
    }

    fun cancelReminders(context: Context) {
        NotificationManagerCompat.from(context).cancel(NOTIFICATION_MORNING)
        NotificationManagerCompat.from(context).cancel(NOTIFICATION_EVENING)
    }

    fun showActionResult(context: Context, action: String, success: Boolean, count: Int, error: String? = null) {
        if (!hasNotificationPermission(context)) return
        createChannel(context)
        val title = "待办提醒"
        val text = if (!success) {
            "操作失败" + (error?.takeIf { it.isNotBlank() }?.let { "：$it" } ?: "")
        } else if (action == ACTION_COMPLETE) {
            if (count > 0) "已完成 ${count} 件待办" else "没有需要完成的待办"
        } else {
            if (count > 0) "已将 ${count} 件今日待办移到明天" else "没有需要改期的今日待办"
        }
        val notificationId = if (action == ACTION_COMPLETE) NOTIFICATION_ACTION_COMPLETE else NOTIFICATION_ACTION_TOMORROW
        NotificationManagerCompat.from(context).notify(
            notificationId,
            buildNotification(context, notificationId, title, text).build()
        )
    }

    private fun reminderTime(context: Context, hourRes: Int, minuteRes: Int): LocalTime =
        LocalTime.of(context.resources.getInteger(hourRes), context.resources.getInteger(minuteRes))

    private fun morningText(todayCount: Int, overdueCount: Int): String? = when {
        todayCount > 0 && overdueCount > 0 ->
            "今日到期 ${todayCount} 件，逾期 ${overdueCount} 件"
        todayCount > 0 -> "今日到期 ${todayCount} 件"
        overdueCount > 0 -> "有 ${overdueCount} 件逾期待办"
        else -> null
    }

    private fun eveningText(tomorrowCount: Int, overdueCount: Int): String? = when {
        tomorrowCount > 0 && overdueCount > 0 ->
            "明日有 ${tomorrowCount} 件待办；另有 ${overdueCount} 件逾期未完成"
        tomorrowCount > 0 -> "明日有 ${tomorrowCount} 件待办"
        overdueCount > 0 -> "有 ${overdueCount} 件逾期待办"
        else -> null
    }

    private fun show(
        context: Context,
        type: String,
        notificationId: Int,
        date: String,
        title: String,
        text: String,
        accountWidgetIds: List<Int>,
        enableComplete: Boolean,
        enablePostpone: Boolean
    ) {
        if (!hasNotificationPermission(context) || Prefs.getReminderSentDate(context, type) == date) return
        createChannel(context)
        val builder = buildNotification(context, notificationId, title, text)
        if (accountWidgetIds.isNotEmpty() && enableComplete) {
            builder.addAction(
                R.drawable.ic_chip_today,
                "全部完成",
                actionPendingIntent(context, ACTION_COMPLETE, accountWidgetIds, notificationId)
            )
            if (enablePostpone) {
                builder.addAction(
                    R.drawable.ic_chip_today,
                    "放到明天",
                    actionPendingIntent(context, ACTION_TOMORROW, accountWidgetIds, notificationId)
                )
            }
        }
        NotificationManagerCompat.from(context).notify(notificationId, builder.build())
        Prefs.setReminderSentDate(context, type, date)
    }

    private fun buildNotification(
        context: Context,
        notificationId: Int,
        title: String,
        text: String
    ): NotificationCompat.Builder {
        val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_CLEAR_TOP or
                Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = if (intent == null) null else PendingIntent.getActivity(
            context,
            notificationId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_chip_today)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .apply { if (pendingIntent != null) setContentIntent(pendingIntent) }
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
    }

    private fun actionPendingIntent(
        context: Context,
        action: String,
        widgetIds: List<Int>,
        notificationId: Int
    ): PendingIntent {
        val intent = Intent(context, ReminderActionReceiver::class.java).apply {
            putExtra(ReminderActionReceiver.EXTRA_ACTION, action)
            putExtra(ReminderActionReceiver.EXTRA_WIDGET_IDS, widgetIds.toIntArray())
        }
        val requestCode = notificationId * 10 + if (action == ACTION_COMPLETE) 1 else 2
        return PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun createChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "待办提醒",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "每日今日、逾期与明日待办摘要"
        }
        ContextCompat.getSystemService(context, NotificationManager::class.java)
            ?.createNotificationChannel(channel)
    }

    fun hasNotificationPermission(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(
                context,
                android.Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
}
