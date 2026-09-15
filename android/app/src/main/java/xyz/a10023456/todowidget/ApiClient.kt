package xyz.a10023456.todowidget

import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/**
 * 服务端 API 客户端。优先用 App 登录会话 Cookie（sid）调登录态接口；
 * 未登录时回退到免密 report_token 接口。15s 超时，所有方法为阻塞调用，需在 IO 线程执行。
 */
object ApiClient {
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        coerceInputValues = true
    }
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .followRedirects(false)
        .build()
    private val JSON_MEDIA = "application/json; charset=utf-8".toMediaType()

    /**
     * 手动跟随重定向：3xx 保持原 method 与 body 重发（最多 3 跳）。
     * OkHttp 自动跟随会把 301/302 的 PUT 降级为 GET：Cloudflare 的 http->https 301 曾把
     * PUT /api/todo/:id/done 变成 GET 打到不存在的路由返回 404。手动跟随不受影响，
     * 纯 http 部署（局域网 Docker）无 3xx 也不受影响。
     */
    private fun execute(req: Request): Response {
        var request = req
        var response = client.newCall(request).execute()
        var hops = 0
        while (hops < 3) {
            val location = when (response.code) {
                301, 302, 307, 308 -> response.header("Location")
                else -> null
            } ?: return response
            val newUrl = request.url.resolve(location)
            response.close()
            if (newUrl == null) throw RuntimeException("无效重定向: $location")
            request = request.newBuilder().url(newUrl).build()
            response = client.newCall(request).execute()
            hops++
        }
        return response
    }

    private fun baseUrlOf(baseUrl: String): String = AppConfig.normalize(baseUrl).trimEnd('/')

    /** 已登录则带 Cookie，否则附加 token 路径。 */
    private fun Request.Builder.auth(sid: String, token: String): Request.Builder {
        if (sid.isNotBlank()) header("Cookie", "sid=$sid")
        return this
    }

    /** GET 小组件分组数据；失败（网络/非 2xx/会话失效）抛异常。 */
    fun fetchWidget(baseUrl: String, sid: String, token: String, scope: String): WidgetResponse {
        val base = baseUrlOf(baseUrl)
        val url = if (sid.isNotBlank())
            "$base/api/todo-widget?scope=$scope&limit=20"
        else
            "$base/api/public/todo-widget/$token?scope=$scope&limit=20"
        val req = Request.Builder().url(url).get().auth(sid, token).build()
        execute(req).use { resp ->
            val body = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) {
                val err = runCatching { json.decodeFromString<ErrorResponse>(body) }.getOrNull()
                throw RuntimeException(err?.message ?: "HTTP ${resp.code}")
            }
            return json.decodeFromString<WidgetResponse>(body)
        }
    }

    /** 勾选完成（已完成的重复任务由后端自动滚动到下一次）。 */
    fun markDone(baseUrl: String, sid: String, token: String, id: Long): DoneResponse {
        val base = baseUrlOf(baseUrl)
        val url = if (sid.isNotBlank())
            "$base/api/todo/$id/done"
        else
            "$base/api/public/todo-all/$token/$id/done"
        val req = Request.Builder().url(url)
            .put("""{"done":true}""".toRequestBody(JSON_MEDIA))
            .auth(sid, token)
            .build()
        execute(req).use { resp ->
            val body = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) {
                val err = runCatching { json.decodeFromString<ErrorResponse>(body) }.getOrNull()
                // 带上 method+url，便于定位路由未命中/反代拦截等问题（404 HTML 页面无法解析为 ErrorResponse）
                throw RuntimeException(err?.message ?: "PUT $url → HTTP ${resp.code}")
            }
            return json.decodeFromString<DoneResponse>(body)
        }
    }
}
