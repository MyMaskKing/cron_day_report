package xyz.a10023456.todowidget

import android.content.Context
import android.util.Log
import androidx.glance.GlanceId
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

/**
 * 小组件点击动作（刷新/勾选完成）的实际执行 Worker。
 *
 * 动作回调（[androidx.glance.appwidget.action.ActionCallback]）跑在 goAsync 广播里，广播结束后
 * 进程不再有活跃组件，可能被系统随时杀掉；若网络请求与终态写入都放在广播/进程级协程里，
 * 进程一死任务即丢——loading 遮罩已由 Glance 的 SessionWorker（同样是 WorkManager 托管）画出，
 * 但 done/error/idle 终态帧永远不会到来，表现为遮罩长时间不消失、勾选无反馈。
 *
 * 故广播里只做瞬时操作（写 loading 状态 + update 重绘），耗时流程全部交给本 Worker：
 * WorkManager 持久化任务、进程被杀后自动重跑，保证终态一定写入并触发重绘。
 *
 * 同一 widget 用唯一任务名 + REPLACE：新点击自动取消上一个未完成动作（等价于旧 activeJobs 语义）。
 * 不加网络约束：断网时请求快速失败/超时，error 终态可见，而不是任务排队卡 loading。
 *
 * 注意：doWork 在进程被杀后可能从头重跑——refresh 为 GET 天然幂等；complete 的 markDone
 * 重跑极小概率让周期任务多滚动一次（窗口仅网络请求的 1~2s），后端对已完成任务本就有滚动
 * 语义，可接受。
 */

/** 手动动作任务 unique work 名前缀；[MaskResetWorker] 据此查询动作任务是否仍在执行。 */
private const val WORK_PREFIX = "todo_widget_action_"

/**
 * silent 初始化刷新专用任务名前缀：必须与手动动作隔离——silent 任务不写遮罩终态，
 * 若 REPLACE 掉手动动作任务（被取消时不写终态），loading 遮罩将无人清除而常驻。
 */
private const val WORK_PREFIX_SILENT = "todo_widget_action_silent_"

class WidgetActionWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val widgetId = inputData.getInt(KEY_WIDGET_ID, -1)
        val silent = inputData.getBoolean(KEY_SILENT, false)
        Log.d(
            TAG,
            "doWork start: action=${inputData.getString(KEY_ACTION)}, widget=$widgetId, " +
                "attempt=$runAttemptCount, silent=$silent"
        )
        if (widgetId < 0) return Result.success()
        // runCatching 兜底：查询异常（系统服务瞬时不可用）不得逃出 doWork——未捕获异常会被
        // WorkManager 按 retry + 指数退避（30s 起）重排，遮罩终态迟迟不写，表现为"刷新中"常驻。
        val glanceId = runCatching {
            GlanceAppWidgetManager(applicationContext)
                .getGlanceIds(TodoAppWidget::class.java)
                .firstOrNull { it.resolveAppWidgetId(applicationContext) == widgetId }
        }.getOrNull() ?: run {
            Log.w(TAG, "doWork: glanceId not found for widget=$widgetId（小组件已被移除或查询失败？）")
            return Result.success()
        }

        try {
            when (inputData.getString(KEY_ACTION)) {
                ACTION_COMPLETE -> {
                    val itemId = inputData.getLong(KEY_ITEM_ID, -1L)
                    if (itemId <= 0) return Result.success()
                    val msg = withContext(Dispatchers.IO) {
                        val baseUrl = Prefs.getBaseUrl(applicationContext, widgetId)
                        val sid = Prefs.getSid(applicationContext)
                        val token = Prefs.getToken(applicationContext, widgetId)
                        val resp = ApiClient.markDone(baseUrl, sid, token, itemId)
                        // markDone 已成功说明网络可达，随后的刷新少量重试即可，避免遮罩长时间转圈
                        WidgetRepo.refresh(applicationContext, widgetId, maxAttempts = 2)
                        if (!resp.message.isNullOrBlank()) resp.message else "已完成"
                    }
                    if (!silent) WidgetStateStore.setUiState(
                        applicationContext, widgetId, "done",
                        if (msg.isNotBlank()) msg else "已完成"
                    )
                }
                else -> {
                    // 手动刷新：用户正在使用手机、网络通常活跃，2 次（间隔 2s）兼顾弱网与等待时长
                    val ok = WidgetRepo.refresh(applicationContext, widgetId, maxAttempts = 2)
                    Log.d(TAG, "refresh result: ok=$ok, widget=$widgetId")
                    if (!silent) WidgetStateStore.setUiState(
                        applicationContext, widgetId,
                        if (ok) "done" else "error",
                        // 失败时带上真实原因（登录失效/服务器异常/网络不通），refresh 已写入 failed_msg
                        if (ok) "已刷新" else friendlyErrorMsg(Prefs.getFailedMsg(applicationContext, widgetId))
                    )
                }
            }
        } catch (e: CancellationException) {
            Log.d(TAG, "doWork cancelled（被新动作 REPLACE），widget=$widgetId")
            throw e // 被新动作 REPLACE 取消：不要写终态覆盖新动作的 loading
        } catch (e: Exception) {
            Log.e(TAG, "doWork action failed, widget=$widgetId", e)
            if (!silent) WidgetStateStore.setUiState(
                applicationContext, widgetId, "error",
                e.message?.let { friendlyErrorMsg(it) } ?: "操作失败"
            )
        }
        // 业务成败均已落到遮罩状态，统一 success：不触发 WorkManager 重试，避免遮罩复位后又弹结果
        if (silent) {
            // 静默初始化刷新：不弹遮罩；数据已由 WidgetRepo.refresh -> publish 驱动重组，
            // 此处仅兜底一次重绘（session 死亡时走 startSession 重建读到新缓存）。
            updateWidget(glanceId, "silent-frame")
            return Result.success().also { Log.d(TAG, "doWork end success (silent), widget=$widgetId") }
        }
        Log.d(TAG, "done/error frame: uiState=${Prefs.getUiState(applicationContext, widgetId)}, widget=$widgetId")
        updateWidget(glanceId, "done-frame")
        Log.d(TAG, "done frame update() returned, widget=$widgetId")
        delay(RESULT_HOLD_MS)
        WidgetStateStore.setUiState(applicationContext, widgetId, "idle", "")
        Log.d(TAG, "idle written: uiState=${Prefs.getUiState(applicationContext, widgetId)}, widget=$widgetId")
        updateWidget(glanceId, "idle-frame")
        Log.d(TAG, "idle frame update() returned, widget=$widgetId")
        return Result.success().also { Log.d(TAG, "doWork end success, widget=$widgetId") }
    }

    /** 定向重绘；runCatching 兜底：重绘失败不能中断后续状态复位。 */
    private suspend fun updateWidget(glanceId: GlanceId, tag: String) {
        // 探针：查 Glance SessionWorker（unique work 名 = "appWidget-<id>"）此刻状态，
        // 判断 update() 内部走 updateGlance 事件（session 存活）还是 startSession（session 已死）
        runCatching {
            val widgetId = glanceId.resolveAppWidgetId(applicationContext)
            val infos = WorkManager.getInstance(applicationContext)
                .getWorkInfosForUniqueWork("appWidget-$widgetId").get()
            val states = infos.joinToString { it.state.name + "(attempt=" + it.runAttemptCount + ")" }
            Log.d(TAG, "[$tag] before update(): SessionWorker infos=[$states]")
        }.onFailure { Log.e(TAG, "[$tag] probe failed", it) }
        runCatching { TodoAppWidget().update(applicationContext, glanceId) }
            .onFailure { Log.e(TAG, "[$tag] update() threw", it) }
    }

    companion object {
        private const val TAG = "TodoWidget"
        const val ACTION_REFRESH = "refresh"
        const val ACTION_COMPLETE = "complete"

        private const val KEY_WIDGET_ID = "widget_id"
        private const val KEY_ACTION = "action"
        private const val KEY_ITEM_ID = "item_id"
        private const val KEY_SILENT = "silent"

        /** 结果遮罩停留时长，给用户阅读庆祝词/错误。 */
        private const val RESULT_HOLD_MS = 1400L

        /**
         * 入队一个动作任务；同类任务上一个未完成的会被 REPLACE 取消。
         * silent=true：初始化自动刷新用，不弹 loading/done/error 遮罩，走独立任务名
         * （[WORK_PREFIX_SILENT]），不得取消用户触发的手动动作任务。
         * 手动动作入队时连带 [MaskResetWorker] 遮罩兜底，防止终态丢失导致遮罩常驻。
         */
        fun enqueue(
            context: Context,
            widgetId: Int,
            action: String,
            itemId: Long = -1L,
            silent: Boolean = false
        ) {
            val request = OneTimeWorkRequestBuilder<WidgetActionWorker>()
                .setInputData(
                    workDataOf(
                        KEY_WIDGET_ID to widgetId,
                        KEY_ACTION to action,
                        KEY_ITEM_ID to itemId,
                        KEY_SILENT to silent
                    )
                )
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork(
                (if (silent) WORK_PREFIX_SILENT else WORK_PREFIX) + widgetId,
                ExistingWorkPolicy.REPLACE,
                request
            )
            if (!silent) MaskResetWorker.enqueue(context, widgetId)
        }
    }
}

/**
 * 遮罩兜底 Worker：手动动作（刷新/勾选）入队时连带延迟入队，独立任务名，不被动作任务
 * REPLACE，任务持久化（进程被杀后下次拉起仍会补跑）。
 *
 * 遮罩消失本应由 [WidgetActionWorker] 写终态（done/error → idle）驱动，但终态可能丢失：
 * 进程在广播结束后被杀且动作任务未被系统及时调度（国产 ROM 省电策略）、动作任务异常进入
 * 重试退避、（旧版本）silent 刷新 REPLACE 掉动作任务等。SP 的 6s 过期是惰性的——只在读
 * SP 时生效，不会自行触发重绘。本 Worker 延时后主动检查：动作任务仍在 RUNNING（弱网多跳
 * 重定向/刷新重试中，由 OkHttp 15s 超时与有限重试保底结束）则交给它自己写终态；其余情况（loading 但任务已结束/
 * 被取消/排队未调度、done/error 过期残留、屏幕帧残留）一律强制回落 idle 并重绘一次。
 */
class MaskResetWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val widgetId = inputData.getInt(KEY_WIDGET_ID, -1)
        if (widgetId < 0) return Result.success()
        val (state, _) = Prefs.getUiState(applicationContext, widgetId)
        val actionRunning = runCatching {
            WorkManager.getInstance(applicationContext)
                .getWorkInfosForUniqueWork(WORK_PREFIX + widgetId).get()
                .any { it.state == WorkInfo.State.RUNNING }
        }.getOrDefault(false)
        if (state == "loading" && actionRunning) {
            Log.d(TAG, "mask reset: action still running, skip. widget=$widgetId")
            return Result.success()
        }
        Log.d(
            TAG,
            "mask reset: force idle. state=$state, actionRunning=$actionRunning, widget=$widgetId"
        )
        // 幂等回落：idle 时 remove 键并发布一帧，顺带清掉"SP 已过期但屏幕仍是旧遮罩帧"的残留
        WidgetStateStore.setUiState(applicationContext, widgetId, "idle", "")
        runCatching {
            val glanceId = GlanceAppWidgetManager(applicationContext)
                .getGlanceIds(TodoAppWidget::class.java)
                .firstOrNull { it.resolveAppWidgetId(applicationContext) == widgetId }
            if (glanceId != null) TodoAppWidget().update(applicationContext, glanceId)
        }
        return Result.success()
    }

    companion object {
        private const val TAG = "TodoWidget"
        private const val MASK_WORK_PREFIX = "todo_widget_mask_"
        private const val KEY_WIDGET_ID = "widget_id"

        /**
         * 延时：覆盖单次请求快速失败 + 结果遮罩停留 1.4s；弱网下动作进入 15s 超时/刷新重试
         * （最坏约数十秒）时，doWork 的 RUNNING 检查会跳过本次兜底，由动作任务自行写终态。
         */
        private const val MASK_DELAY_MS = 13000L

        fun enqueue(context: Context, widgetId: Int) {
            val request = OneTimeWorkRequestBuilder<MaskResetWorker>()
                .setInputData(workDataOf(KEY_WIDGET_ID to widgetId))
                .setInitialDelay(MASK_DELAY_MS, TimeUnit.MILLISECONDS)
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork(
                MASK_WORK_PREFIX + widgetId,
                ExistingWorkPolicy.REPLACE,
                request
            )
        }
    }
}
