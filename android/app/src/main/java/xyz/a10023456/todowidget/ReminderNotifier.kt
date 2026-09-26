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
import androidx.glance.appwidget.GlanceAppWidgetManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
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

    // 任务闹钟刚响后的避让窗口：窗口内不发每日提醒，避免与闹钟铃声/抬头通知互相打断
    private const val FIRE_GUARD_MS = 5 * 60 * 1000L

    fun check(context: Context, refreshedIds: List<Int>) {
        if (refreshedIds.isEmpty() || !hasNotificationPermission(context)) return
        // 本次跳过且不标记已发，等下一次刷新（15 分钟周期或打开 App）自动补发
        if (System.currentTimeMillis() - TaskAlarmScheduler.lastFireAtMillis(context) < FIRE_GUARD_MS) return

        val snapshot = reminderSnapshot(context, refreshedIds)
        val now = LocalTime.now()
        val morningStart = reminderTime(context, R.integer.reminder_morning_hour, R.integer.reminder_morning_minute)
        val eveningStart = reminderTime(context, R.integer.reminder_evening_hour, R.integer.reminder_evening_minute)
        when {
            now >= morningStart && now.isBefore(eveningStart) -> {
                val text = morningText(snapshot.todayCount, snapshot.overdueCount) ?: return
                show(context, TYPE_MORNING, NOTIFICATION_MORNING, snapshot.date, "待办提醒", text, snapshot.accountWidgetIds, true, snapshot.todayCount > 0)
            }
            now >= eveningStart -> {
                val text = eveningText(snapshot.tomorrowCount, snapshot.overdueCount) ?: return
                show(context, TYPE_EVENING, NOTIFICATION_EVENING, snapshot.date, "待办提醒", text, snapshot.accountWidgetIds, snapshot.overdueCount > 0, false)
            }
        }
    }

    private data class ReminderSnapshot(
        val date: String,
        val todayCount: Int,
        val overdueCount: Int,
        val tomorrowCount: Int,
        val accountWidgetIds: List<Int>
    )

    private fun reminderSnapshot(context: Context, refreshedIds: List<Int>): ReminderSnapshot {
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

        return ReminderSnapshot(today, todayCount, overdueCount, tomorrowCount, accountWidgetIds)
    }

    fun showTest(context: Context) {
        if (!hasNotificationPermission(context)) return
        android.widget.Toast.makeText(context, "正在拉取最新待办…", android.widget.Toast.LENGTH_SHORT).show()

        val appContext = context.applicationContext
        CoroutineScope(Dispatchers.IO).launch {
            val ids = runCatching {
                GlanceAppWidgetManager(appContext)
                    .getGlanceIds(TodoAppWidget::class.java)
                    .map { it.resolveAppWidgetId(appContext) }
                    .filter { it >= 0 }
            }.getOrDefault(emptyList())
            val refreshedIds = mutableListOf<Int>()
            ids.forEach { id ->
                if (WidgetRepo.refresh(appContext, id, maxAttempts = 2)) refreshedIds.add(id)
            }
            showTestSnapshot(appContext, ids, refreshedIds)
        }
    }

    private fun showTestSnapshot(
        context: Context,
        ids: List<Int>,
        refreshedIds: List<Int>
    ) {
        val snapshot = reminderSnapshot(context, refreshedIds)
        val isEvening = LocalTime.now() >= reminderTime(
            context,
            R.integer.reminder_evening_hour,
            R.integer.reminder_evening_minute
        )
        val type = if (isEvening) TYPE_EVENING else TYPE_MORNING
        val text = when {
            ids.isEmpty() -> "请先添加桌面小组件后再模拟待办提醒"
            refreshedIds.isEmpty() -> "最新待办刷新失败，请检查网络或登录状态后重试"
            snapshot.accountWidgetIds.isEmpty() -> "暂无可模拟的待办提醒数据"
            isEvening -> eveningText(snapshot.tomorrowCount, snapshot.overdueCount)
                ?: "明日暂无待办，当前也没有逾期"
            else -> morningText(snapshot.todayCount, snapshot.overdueCount)
                ?: "今日暂无到期或逾期待办"
        }
        val hasActionData = refreshedIds.isNotEmpty() && snapshot.accountWidgetIds.isNotEmpty()
        val enableComplete = hasActionData && if (isEvening) {
            snapshot.overdueCount > 0
        } else {
            snapshot.todayCount > 0 || snapshot.overdueCount > 0
        }
        val enablePostpone = hasActionData && !isEvening && snapshot.todayCount > 0

        show(
            context,
            type,
            NOTIFICATION_TEST,
            snapshot.date,
            "待办提醒",
            text,
            snapshot.accountWidgetIds,
            enableComplete = enableComplete,
            enablePostpone = enablePostpone,
            markSent = false
        )
    }

    fun cancelReminders(context: Context) {
        NotificationManagerCompat.from(context).cancel(NOTIFICATION_MORNING)
        NotificationManagerCompat.from(context).cancel(NOTIFICATION_EVENING)
    }

    fun cancelNotification(context: Context, notificationId: Int) {
        NotificationManagerCompat.from(context).cancel(notificationId)
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
        enablePostpone: Boolean,
        markSent: Boolean = true
    ) {
        if (!hasNotificationPermission(context) || (markSent && Prefs.getReminderSentDate(context, type) == date)) return
        createChannel(context)
        val builder = buildNotification(context, notificationId, title, text)
        if (enableComplete && accountWidgetIds.isNotEmpty()) {
            builder.addAction(
                R.drawable.ic_launcher_monochrome,
                "全部完成",
                actionPendingIntent(context, ACTION_COMPLETE, accountWidgetIds, notificationId)
            )
            if (enablePostpone) {
                builder.addAction(
                    R.drawable.ic_launcher_monochrome,
                    "放到明天",
                    actionPendingIntent(context, ACTION_TOMORROW, accountWidgetIds, notificationId)
                )
            }
        }
        NotificationManagerCompat.from(context).notify(notificationId, builder.build())
        if (markSent) Prefs.setReminderSentDate(context, type, date)
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
            putExtra(Keys.Url.name, AppConfig.getBaseUrl(context) + "/todo")
        }
        val pendingIntent = if (intent == null) null else PendingIntent.getActivity(
            context,
            notificationId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_monochrome)
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
            putExtra(ReminderActionReceiver.EXTRA_NOTIFICATION_ID, notificationId)
        }
        val requestCode = notificationId * 10 + if (action == ACTION_COMPLETE) 1 else 2
        return PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    /** 确保系统通知设置里存在每日「待办提醒」渠道（幂等）。 */
    fun createChannel(context: Context) {
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
