package xyz.a10023456.todowidget

import android.content.Context
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json

/** 小组件数据仓储：拉取、缓存、读取。 */
object WidgetRepo {
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        coerceInputValues = true
    }

    /** 后台刷新默认尝试次数（含首次）：网络抖动/5xx 间隔退避重试。 */
    private const val MAX_ATTEMPTS = 3

    /** 第 n 次失败后的退避等待（下标 0 = 第一次失败后等 2s，再失败等 4s）。 */
    private val RETRY_DELAYS_MS = longArrayOf(2000L, 4000L)

    /**
     * 拉取最新数据并写入缓存。成功返回 true，失败返回 false（调用方渲染缓存）。
     * 网络异常/服务端 5xx 按 [maxAttempts] 间隔退避重试；401/403/404 属配置问题
     * （登录失效/地址错误），重试无意义，立即放弃。仅在最终失败时写 failed 标志。
     * 交互式调用方（手动刷新/配置保存）可传较小次数避免长时间转圈。
     */
    suspend fun refresh(
        context: Context,
        widgetId: Int,
        maxAttempts: Int = MAX_ATTEMPTS
    ): Boolean = withContext(Dispatchers.IO) {
        val sid = Prefs.getSid(context)
        val token = Prefs.getToken(context, widgetId)
        if (sid.isBlank() && token.isBlank()) return@withContext false
        val baseUrl = Prefs.getBaseUrl(context, widgetId)
        val scope = Prefs.getScope(context, widgetId)
        var lastMsg: String? = null
        for (attempt in 1..maxAttempts) {
            var fatal = false
            try {
                val resp = ApiClient.fetchWidget(baseUrl, sid, token, scope)
                if (resp.success) {
                    Prefs.setCache(context, widgetId, json.encodeToString(WidgetResponse.serializer(), resp))
                    return@withContext true
                }
                lastMsg = "后端返回 success=false"
                fatal = false
            } catch (e: CancellationException) {
                throw e // 被新动作 REPLACE 取消，不要落失败标志
            } catch (e: Exception) {
                lastMsg = e.message
                fatal = isFatalClientError(e.message)
            }
            if (fatal || attempt == maxAttempts) break
            delay(RETRY_DELAYS_MS[attempt - 1])
        }
        Prefs.setFailed(context, widgetId, true, lastMsg)
        false
    }.also { WidgetStateStore.publish(context, widgetId) }

    /** 从异常 message 提取 HTTP 码；401/403（登录失效）、404（地址错误）为不可重试的配置类错误。 */
    private fun isFatalClientError(msg: String?): Boolean {
        val code = Regex("""HTTP\s*(\d{3})""").find(msg.orEmpty())?.groupValues?.get(1)
        return code == "401" || code == "403" || code == "404"
    }

    /** 读取最近一次缓存（无缓存返回 null）。 */
    fun cached(context: Context, widgetId: Int): WidgetResponse? {
        val raw = Prefs.getCache(context, widgetId) ?: return null
        return runCatching { json.decodeFromString(WidgetResponse.serializer(), raw) }.getOrNull()
    }
}

/**
 * 把拉取失败的原始异常信息（ApiClient 抛出的 "HTTP 401"、OkHttp 的
 * "Unable to resolve host…" / "failed to connect … after 15000ms" 等）映射为
 * 用户可读的失败原因；无法归类时原样带出（后端返回的中文错误信息可直接阅读）。
 */
fun friendlyErrorMsg(raw: String?): String {
    val s = raw.orEmpty()
    val httpCode = Regex("""HTTP\s*(\d{3})""").find(s)?.groupValues?.get(1)
    return when {
        httpCode == "401" || httpCode == "403" -> "登录失效，请打开 App 重新登录"
        httpCode == "404" -> "服务器地址有误（404），请检查服务器设置"
        httpCode != null && httpCode.startsWith("5") -> "服务器异常（HTTP $httpCode），稍后自动重试"
        s.contains("Unable to resolve host", ignoreCase = true) ||
            s.contains("failed to connect", ignoreCase = true) ||
            s.contains("Network is unreachable", ignoreCase = true) ||
            s.contains("timeout", ignoreCase = true) ||
            s.contains("SSL", ignoreCase = true) -> "网络连不上服务器，恢复后自动重试"
        s.isNotBlank() -> "连接失败：$s"
        else -> "连接失败，稍后自动重试"
    }
}
