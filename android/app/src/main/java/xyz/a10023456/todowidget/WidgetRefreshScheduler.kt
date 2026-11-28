package xyz.a10023456.todowidget

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.glance.appwidget.GlanceAppWidgetManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.ZoneId

/**
 * 小组件后台定时兜底调度器：
 * WorkManager 周期任务在夜间 Doze / 厂商省电策略下常被推迟数小时，导致次日早晨仍显示前一天数据。
 * 这里用 AlarmManager（setAndAllowWhileIdle / setExactAndAllowWhileIdle，不走 setAlarmClock
 * 以免状态栏出现闹钟图标）在「30 分钟后」与「次日 00:05」取较早者做链式唤醒，触发即时刷新。
 */
object WidgetRefreshScheduler {
    private const val TAG = "TodoWidget"
    private const val ACTION_REFRESH = "xyz.a10023456.todowidget.WIDGET_BG_REFRESH"
    private const val REQUEST_CODE = 14001
    private const val INTERVAL_MS = 30L * 60 * 1000L
    private const val STALE_THRESHOLD_MS = 25L * 60 * 1000L

    fun scheduleNext(context: Context) {
        val appCtx = context.applicationContext
        val alarmManager = appCtx.getSystemService(AlarmManager::class.java) ?: return
        val now = System.currentTimeMillis()
        val nextInterval = now + INTERVAL_MS
        val zone = ZoneId.systemDefault()
        val nextMidnightPlus5m = LocalDate.now(zone)
            .plusDays(1)
            .atTime(0, 5)
            .atZone(zone)
            .toInstant()
            .toEpochMilli()
        val triggerAt = minOf(nextInterval, nextMidnightPlus5m)
        val pending = pendingIntent(appCtx, create = true) ?: return

        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pending)
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pending)
            } else {
                alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAt, pending)
            }
        }.onFailure {
            Log.w(TAG, "WidgetRefreshScheduler.scheduleNext failed: ${it.message}")
        }
    }

    fun cancel(context: Context) {
        val appCtx = context.applicationContext
        val alarmManager = appCtx.getSystemService(AlarmManager::class.java)
        pendingIntent(appCtx, create = false)?.let { pending ->
            alarmManager?.cancel(pending)
            pending.cancel()
        }
    }

    private fun pendingIntent(context: Context, create: Boolean): PendingIntent? {
        val intent = Intent(context, WidgetRefreshReceiver::class.java).apply {
            action = ACTION_REFRESH
        }
        val flags = if (create) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        }
        return PendingIntent.getBroadcast(context, REQUEST_CODE, intent, flags)
    }

    internal fun isRefreshAction(intent: Intent?): Boolean = intent?.action == ACTION_REFRESH
    internal fun staleThresholdMs(): Long = STALE_THRESHOLD_MS
}

/** 接收 AlarmManager 定时唤醒，检查小组件过期或跨天后入队持久化刷新并链式调度下一次。 */
class WidgetRefreshReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (!WidgetRefreshScheduler.isRefreshAction(intent)) return
        val appCtx = context.applicationContext
        val pendingResult = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val ids = runCatching {
                    GlanceAppWidgetManager(appCtx)
                        .getGlanceIds(TodoAppWidget::class.java)
                        .map { it.resolveAppWidgetId(appCtx) }
                        .filter { it >= 0 }
                }.getOrDefault(emptyList())

                if (ids.isEmpty()) {
                    WidgetRefreshScheduler.cancel(appCtx)
                    RefreshWorker.cancelPeriodic(appCtx)
                    return@launch
                }

                WidgetRefreshScheduler.scheduleNext(appCtx)
                val loggedIn = Prefs.isLoggedIn(appCtx)
                val needRefresh = ids.any { id ->
                    (loggedIn || Prefs.isConfigured(appCtx, id)) &&
                        Prefs.isCacheStale(appCtx, id, WidgetRefreshScheduler.staleThresholdMs())
                }
                if (needRefresh) {
                    RefreshWorker.enqueueImmediate(appCtx)
                }
            } finally {
                pendingResult.finish()
            }
        }
    }
}
