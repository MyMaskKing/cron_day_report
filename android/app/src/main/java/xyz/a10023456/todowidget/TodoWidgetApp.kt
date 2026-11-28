package xyz.a10023456.todowidget

import android.app.Application
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import androidx.core.content.ContextCompat
import androidx.glance.appwidget.GlanceAppWidgetManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * 进程级入口：动态监听屏幕解锁（ACTION_USER_PRESENT），
 * 解决夜间休眠后早晨解锁看桌面时小组件未自动刷新的问题。
 */
class TodoWidgetApp : Application() {
    override fun onCreate() {
        super.onCreate()
        val filter = IntentFilter(Intent.ACTION_USER_PRESENT)
        ContextCompat.registerReceiver(
            this,
            userPresentReceiver,
            filter,
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
    }

    private val userPresentReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent?) {
            if (intent?.action != Intent.ACTION_USER_PRESENT) return
            val appCtx = context.applicationContext
            CoroutineScope(Dispatchers.IO).launch {
                val ids = runCatching {
                    GlanceAppWidgetManager(appCtx)
                        .getGlanceIds(TodoAppWidget::class.java)
                        .map { it.resolveAppWidgetId(appCtx) }
                        .filter { it >= 0 }
                }.getOrDefault(emptyList())
                if (ids.isEmpty()) return@launch

                WidgetRefreshScheduler.scheduleNext(appCtx)
                val loggedIn = Prefs.isLoggedIn(appCtx)
                val stale = ids.any { id ->
                    (loggedIn || Prefs.isConfigured(appCtx, id)) &&
                        Prefs.isCacheStale(appCtx, id, UNLOCK_STALE_MS)
                }
                if (stale) {
                    RefreshWorker.enqueueImmediate(appCtx)
                }
            }
        }
    }

    companion object {
        private const val UNLOCK_STALE_MS = 15L * 60 * 1000L
    }
}
