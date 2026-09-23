package xyz.a10023456.todowidget

import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.updateAll
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext

/**
 * 小组件生命周期：注册刷新任务、初次添加/系统更新时拉取数据、删除时清理。
 *
 * 点击动作（刷新/完成/折叠）统一走 Glance ActionCallback（actionRunCallback，见
 * [RefreshAction]/[CompleteAction]/[CollapseAction]）：进程内挂起执行，不启动 Activity/
 * Broadcast，避免 LazyColumn item 内点击在部分 ROM 被拦截，以及启动透明窗口造成的闪烁。
 */
class TodoAppWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = TodoAppWidget()

    override fun onUpdate(
        context: Context,
        appWidgetManager: android.appwidget.AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        RefreshWorker.enqueue(context)
        // 初次添加/系统更新时各拉一次：已登录 App 或已配 token 即可
        val ready = Prefs.isLoggedIn(context)
        appWidgetIds.forEach { id ->
            if (ready || Prefs.isConfigured(context, id)) {
                // updateAll 必须在主线程（Glance 组合/翻译需要主线程推进），先在 IO 拉数据再切 Main 重绘
                CoroutineScope(Dispatchers.IO).launch {
                    WidgetRepo.refresh(context, id)
                    withContext(Dispatchers.Main) { TodoAppWidget().updateAll(context) }
                }
            }
        }
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        appWidgetIds.forEach {
            Prefs.clear(context, it)
            WidgetStateStore.remove(it)
        }
        super.onDeleted(context, appWidgetIds)
        // 已无剩余小组件：取消周期刷新，避免每 30 分钟空跑；枚举失败按仍有组件处理（下次 doWork 判空兜底）
        // getGlanceIds 是 suspend，onDeleted 非协程上下文，runBlocking 同步完成（轻量 IPC）
        val empty = runBlocking {
            runCatching {
                GlanceAppWidgetManager(context)
                    .getGlanceIds(TodoAppWidget::class.java)
                    .isEmpty()
            }.getOrDefault(false)
        }
        if (empty) RefreshWorker.cancelPeriodic(context)
    }
}
