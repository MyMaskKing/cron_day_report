package xyz.a10023456.todowidget

import android.content.Context
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.updateAll
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

/** 周期拉取所有已添加小组件数据并更新。系统最小周期约 15 分钟。 */
class RefreshWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        // 枚举桌面上当前存在的小组件（登录态为全局会话，不再依赖每个 widget 的 token）
        val ids = GlanceAppWidgetManager(applicationContext)
            .getGlanceIds(TodoAppWidget::class.java)
            .map { it.resolveAppWidgetId(applicationContext) }
            .filter { it >= 0 }
        val refreshedIds = mutableListOf<Int>()
        ids.forEach { id ->
            if (WidgetRepo.refresh(applicationContext, id)) refreshedIds.add(id)
        }
        ReminderNotifier.check(applicationContext, refreshedIds)
        withContext(Dispatchers.Main) { TodoAppWidget().updateAll(applicationContext) }
        return Result.success()
    }

    companion object {
        private const val WORK_NAME = "todo_widget_refresh"
        private const val WORK_NAME_NOW = "todo_widget_refresh_now"

        /** 周期刷新（15 分钟，系统调度，App 关闭也能跑）。 */
        fun enqueue(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            val request = PeriodicWorkRequestBuilder<RefreshWorker>(15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }

        /** 立即刷新一次（登录/手动刷新后调用）。 */
        fun enqueueImmediate(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            val request = OneTimeWorkRequestBuilder<RefreshWorker>()
                .setConstraints(constraints)
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork(
                WORK_NAME_NOW,
                ExistingWorkPolicy.REPLACE,
                request
            )
        }

        /**
         * 进程内直接拉取所有桌面小组件数据并刷新（登录成功 / App 内网页待办变更后调用）：
         * WorkManager 一次性任务可能被系统延迟，这里在调用进程内直连拉取保证即时上屏
         * （成功写入缓存会顺带清掉旧 failed 标志，见 Prefs.setCache）。
         * 本函数立即返回，拉取在 IO 线程进行；高频调用方（网页连续变更）需自行防抖。
         */
        fun refreshAllNow(context: Context) {
            CoroutineScope(Dispatchers.IO).launch {
                val ids = runCatching {
                    GlanceAppWidgetManager(context)
                        .getGlanceIds(TodoAppWidget::class.java)
                        .map { it.resolveAppWidgetId(context) }
                        .filter { it >= 0 }
                }.getOrDefault(emptyList())
                val refreshedIds = mutableListOf<Int>()
                ids.forEach { id ->
                    if (WidgetRepo.refresh(context, id)) refreshedIds.add(id)
                }
                ReminderNotifier.check(context, refreshedIds)
                // updateAll 必须在主线程（Glance 组合需要主线程推进）
                withContext(Dispatchers.Main) {
                    runCatching { TodoAppWidget().updateAll(context) }
                }
            }
        }
    }
}
