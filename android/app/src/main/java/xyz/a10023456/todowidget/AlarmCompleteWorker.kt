package xyz.a10023456.todowidget

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json

/**
 * 闹钟页「完成」：停铃后由 WorkManager 持久化执行勾选（传统父任务可能勾多个子任务）。
 * 响铃页点完即关、锁屏时网络可能不可用，勾选交 Worker 在网络恢复后执行并自动退避重试，
 * 不依赖页面/小组件存活。已完成任务重复勾选由服务端按 duplicated 幂等返回，重试安全。
 */
class AlarmCompleteWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val raw = inputData.getString(KEY_ALARM_JSON) ?: return Result.failure()
        val alarm = runCatching {
            json.decodeFromString(StoredTaskAlarm.serializer(), raw)
        }.getOrNull() ?: return Result.failure()
        val targetIds = TaskAlarmScheduler.completeTargetIds(alarm)
        // 测试闹钟等无真实任务 id：不可重试的失败
        if (targetIds.isEmpty()) return Result.failure()

        val sid = Prefs.getSid(applicationContext)
        // 未登录时回退免密 report_token：取与闹钟同一服务器的第一个已配置小组件
        val token = if (sid.isNotBlank()) "" else {
            val normalized = alarm.baseUrl.trimEnd('/')
            Prefs.allConfiguredWidgetIds(applicationContext)
                .firstOrNull { Prefs.getBaseUrl(applicationContext, it).trimEnd('/') == normalized }
                ?.let { Prefs.getToken(applicationContext, it) }
                .orEmpty()
        }
        if (sid.isBlank() && token.isBlank()) return Result.failure()

        var retryable = false
        var permanent = false
        for (id in targetIds) {
            try {
                withContext(Dispatchers.IO) {
                    ApiClient.markDone(alarm.baseUrl, sid, token, id)
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                // 4xx（任务不存在/无权限等）重试无意义；网络错误/5xx 交 WorkManager 持久化退避重试。
                // ApiClient 非 2xx 错误信息形如 "PUT <url> → HTTP 404"。
                if (e.message?.contains("HTTP 4") == true) permanent = true else retryable = true
            }
        }
        if (retryable) return Result.retry()
        if (permanent) return Result.failure()

        // 全部勾选成功：让桌面小组件立刻追上（其内部自带网络约束，失败不影响本次结果）
        runCatching { RefreshWorker.enqueueImmediate(applicationContext) }
        return Result.success()
    }

    companion object {
        const val KEY_ALARM_JSON = "alarm_json"
        private const val WORK_PREFIX = "alarm_complete_"

        private val json = Json {
            ignoreUnknownKeys = true
            encodeDefaults = true
        }

        /** 入队勾选；测试闹钟等无真实任务 id 时直接忽略。按根任务去重（父任务一次勾多个子任务）。 */
        fun enqueue(context: Context, alarm: StoredTaskAlarm) {
            if (TaskAlarmScheduler.completeTargetIds(alarm).isEmpty()) return
            val payload = json.encodeToString(StoredTaskAlarm.serializer(), alarm)
            val request = OneTimeWorkRequestBuilder<AlarmCompleteWorker>()
                .setInputData(workDataOf(KEY_ALARM_JSON to payload))
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .build()
            // KEEP：同一次响铃的完成请求尚未执行时不重复入队（服务端勾选本身幂等，双保险）
            WorkManager.getInstance(context).enqueueUniqueWork(
                WORK_PREFIX + alarm.todoId.removePrefix(TaskAlarmScheduler.SNOOZE_TODO_PREFIX),
                ExistingWorkPolicy.KEEP,
                request
            )
        }
    }
}
