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

/** 本地待办提醒：复用小组件刷新结果，在 reminder_config.xml 配置的时间窗发送每日摘要。 */
object ReminderNotifier {
    private const val CHANNEL_ID = "todo_reminder"
    private const val TYPE_MORNING = "morning"
    private const val TYPE_EVENING = "evening"
    private const val NOTIFICATION_MORNING = 1001
    private const val NOTIFICATION_EVENING = 1002

    fun check(context: Context, refreshedIds: List<Int>) {
        if (refreshedIds.isEmpty() || !hasNotificationPermission(context)) return

        val today = java.time.LocalDate.now().toString()
        var todayCount = 0
        var overdueCount = 0
        var tomorrowCount = 0
        val seenAccounts = HashSet<String>()

        for (id in refreshedIds) {
            val data = WidgetRepo.cached(context, id) ?: continue
            // 仅使用本次成功刷新且服务端日期为今天的缓存，避免离线旧数据误报。
            if (!data.success || data.today != today) continue
            val owner = data.owner_name?.takeIf { it.isNotBlank() }
                ?: Prefs.getToken(context, id).takeLast(8)
            // 同一服务器 + owner 去重，避免同一账号多个小组件重复提醒。
            val accountKey = Prefs.getBaseUrl(context, id) + "|" + owner
            if (!seenAccounts.add(accountKey)) continue

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
                show(context, TYPE_MORNING, NOTIFICATION_MORNING, today, "待办提醒", text)
            }
            now >= eveningStart -> {
                val text = eveningText(tomorrowCount, overdueCount) ?: return
                show(context, TYPE_EVENING, NOTIFICATION_EVENING, today, "待办提醒", text)
            }
        }
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
        text: String
    ) {
        if (!hasNotificationPermission(context) || Prefs.getReminderSentDate(context, type) == date) return
        // 没有可提醒的任务时不写已发标记，当天稍后新增任务仍可补发。
        createChannel(context)
        val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_CLEAR_TOP or
                Intent.FLAG_ACTIVITY_SINGLE_TOP
        } ?: return
        val pendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_chip_today)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()

        NotificationManagerCompat.from(context).notify(notificationId, notification)
        Prefs.setReminderSentDate(context, type, date)
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

    private fun hasNotificationPermission(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(
                context,
                android.Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
}
