package xyz.a10023456.todowidget

import android.content.Context
import org.json.JSONObject

/** 按 appWidgetId 存储小组件配置、折叠状态与最近一次缓存。 */
object Prefs {
    private const val PREFS = "todo_widget_prefs"

    private fun sp(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    // ── 全局登录会话（App WebView 登录后由 MainActivity 同步）──
    fun setSid(context: Context, sid: String) =
        sp(context).edit().putString("sid", sid.trim()).apply()

    fun getSid(context: Context): String = sp(context).getString("sid", "") ?: ""

    fun clearSid(context: Context) = sp(context).edit().remove("sid").apply()

    /** 已在 App 内登录（存在会话 Cookie）。 */
    fun isLoggedIn(context: Context): Boolean = getSid(context).isNotBlank()

    // ── 界面主题（light|dark|eye）：权威值在账号（网页 __applyTheme 会 PUT 同步），
    //    这里仅记录本机最近选择，供「我的」页对话框标记当前项 ──
    fun getTheme(context: Context): String = sp(context).getString("app_theme", "light") ?: "light"

    fun setTheme(context: Context, theme: String) =
        sp(context).edit().putString("app_theme", theme).apply()

    // ── 当前登录账号角色（admin|user）：sid 变化时由 ApiClient 拉 /api/auth/me 刷新，
    //    「我的」页据此隐藏超管入口；登出/换服务器清除，默认 user ──
    fun getRole(context: Context): String = sp(context).getString("account_role", "user") ?: "user"

    fun setRole(context: Context, role: String) =
        sp(context).edit().putString("account_role", role).apply()

    fun clearRole(context: Context) = sp(context).edit().remove("account_role").apply()

    fun getToken(context: Context, widgetId: Int): String =
        sp(context).getString("token_$widgetId", "") ?: ""

    fun setToken(context: Context, widgetId: Int, token: String) =
        sp(context).edit().putString("token_$widgetId", token.trim()).apply()

    /** scope ∈ cur|today|overdue|all，默认 cur */
    fun getScope(context: Context, widgetId: Int): String =
        sp(context).getString("scope_$widgetId", "cur") ?: "cur"

    fun setScope(context: Context, widgetId: Int, scope: String) =
        sp(context).edit().putString("scope_$widgetId", scope).apply()

    /** 小组件背景不透明度 0-100，默认 100（完全不透明） */
    fun getOpacity(context: Context, widgetId: Int): Int =
        sp(context).getInt("opacity_$widgetId", 100)

    fun setOpacity(context: Context, widgetId: Int, opacity: Int) =
        sp(context).edit().putInt("opacity_$widgetId", opacity.coerceIn(0, 100)).apply()

    /** 小组件字号档位：0=小 1=中（默认） 2=大 */
    fun getFontScale(context: Context, widgetId: Int): Int =
        sp(context).getInt("font_$widgetId", 1).coerceIn(0, 2)

    fun setFontScale(context: Context, widgetId: Int, scale: Int) =
        sp(context).edit().putInt("font_$widgetId", scale.coerceIn(0, 2)).apply()

    /** 子任务标题显示模式：false=单行省略（默认），true=过长换行完整显示 */
    fun getWrapChild(context: Context, widgetId: Int): Boolean =
        sp(context).getBoolean("wrapchild_$widgetId", false)

    fun setWrapChild(context: Context, widgetId: Int, wrap: Boolean) =
        sp(context).edit().putBoolean("wrapchild_$widgetId", wrap).apply()

    /** 显示模式：false=分组卡片（默认），true=简洁列表（只平铺子任务行，无任务组标题/折叠） */
    fun getSimpleMode(context: Context, widgetId: Int): Boolean =
        sp(context).getBoolean("simple_$widgetId", false)

    fun setSimpleMode(context: Context, widgetId: Int, simple: Boolean) =
        sp(context).edit().putBoolean("simple_$widgetId", simple).apply()

    /** 小组件主题："light"（默认）| "dark"，在小组件设置里手动切换，不跟随系统深色。
     *  注意区别于全局 app_theme（App 内网页的浅色/暗色/护眼，见 getTheme）。 */
    fun getWidgetTheme(context: Context, widgetId: Int): String =
        sp(context).getString("wtheme_$widgetId", "light") ?: "light"

    fun setWidgetTheme(context: Context, widgetId: Int, theme: String) =
        sp(context).edit().putString("wtheme_$widgetId", theme).apply()

    fun getBaseUrl(context: Context, widgetId: Int): String {
        val per = sp(context).getString("baseurl_$widgetId", "") ?: ""
        return if (per.isNotBlank()) AppConfig.normalize(per) else AppConfig.getBaseUrl(context)
    }

    fun isConfigured(context: Context, widgetId: Int): Boolean =
        getToken(context, widgetId).isNotBlank()

    fun isCollapsed(context: Context, widgetId: Int, rootId: Long): Boolean =
        sp(context).getBoolean("collapsed_${widgetId}_$rootId", false)

    /** 该小组件当前所有已折叠分组的 rootId 集合（WidgetStateStore 全量重读用）。 */
    fun getCollapsedIds(context: Context, widgetId: Int): Set<Long> {
        val s = sp(context)
        return s.all.keys
            .filter { it.startsWith("collapsed_${widgetId}_") && s.getBoolean(it, false) }
            .mapNotNull { it.removePrefix("collapsed_${widgetId}_").toLongOrNull() }
            .toSet()
    }

    fun setCollapsed(context: Context, widgetId: Int, rootId: Long, value: Boolean) =
        sp(context).edit().putBoolean("collapsed_${widgetId}_$rootId", value).apply()

    fun toggleCollapsed(context: Context, widgetId: Int, rootId: Long) {
        val cur = isCollapsed(context, widgetId, rootId)
        setCollapsed(context, widgetId, rootId, !cur)
    }

    fun setCache(context: Context, widgetId: Int, json: String) {
        sp(context).edit()
            .putString("cache_$widgetId", json)
            .putLong("updated_$widgetId", System.currentTimeMillis())
            .putBoolean("failed_$widgetId", false)
            .remove("failed_msg_$widgetId")
            .apply()
    }

    fun getCache(context: Context, widgetId: Int): String? =
        sp(context).getString("cache_$widgetId", null)

    fun getLastUpdated(context: Context, widgetId: Int): Long =
        sp(context).getLong("updated_$widgetId", 0L)

    /** 失败时同时记录原始错误信息（异常 message），供界面映射为友好文案；恢复成功由 setCache 清除。 */
    fun setFailed(context: Context, widgetId: Int, failed: Boolean, msg: String? = null) {
        val e = sp(context).edit().putBoolean("failed_$widgetId", failed)
        if (failed) e.putString("failed_msg_$widgetId", msg ?: "") else e.remove("failed_msg_$widgetId")
        e.apply()
    }

    fun isFailed(context: Context, widgetId: Int): Boolean =
        sp(context).getBoolean("failed_$widgetId", false)

    fun getFailedMsg(context: Context, widgetId: Int): String =
        sp(context).getString("failed_msg_$widgetId", "") ?: ""

    // ── 瞬时操作状态（点击遮罩/结果提示）：idle | loading | done | error ──
    // 带过期时间，进程被杀来不及清除时也能自动回落到 idle，避免遮罩常驻
    fun setUiState(context: Context, widgetId: Int, state: String, msg: String) {
        val e = sp(context).edit()
        if (state == "idle") {
            e.remove("ui_state_$widgetId").remove("ui_msg_$widgetId").remove("ui_until_$widgetId")
        } else {
            e.putString("ui_state_$widgetId", state)
                .putString("ui_msg_$widgetId", msg)
                .putLong("ui_until_$widgetId", System.currentTimeMillis() + 6000L)
        }
        e.apply()
    }

    /** 返回 (state, msg)，过期或不存在返回 ("idle", "")。 */
    fun getUiState(context: Context, widgetId: Int): Pair<String, String> {
        val until = sp(context).getLong("ui_until_$widgetId", 0L)
        if (until < System.currentTimeMillis()) return "idle" to ""
        val s = sp(context).getString("ui_state_$widgetId", "idle") ?: "idle"
        if (s == "idle") return "idle" to ""
        return s to (sp(context).getString("ui_msg_$widgetId", "") ?: "")
    }

    /** 删除某小组件时清理其全部键 */
    fun clear(context: Context, widgetId: Int) {
        val e = sp(context).edit()
        sp(context).all.keys.filter { it.endsWith("_$widgetId") || it.contains("_${widgetId}_") }
            .forEach { e.remove(it) }
        e.remove("cache_$widgetId").remove("updated_$widgetId")
            .remove("failed_$widgetId").remove("token_$widgetId")
            .remove("scope_$widgetId").remove("baseurl_$widgetId")
            .remove("opacity_$widgetId").remove("font_$widgetId").apply()
    }

    /** 返回所有已配置（有 token）的 widgetId，用于周期刷新。 */
    fun allConfiguredWidgetIds(context: Context): List<Int> {
        val ids = mutableListOf<Int>()
        sp(context).all.keys.forEach { key ->
            if (key.startsWith("token_")) {
                val v = sp(context).getString(key, "") ?: ""
                if (v.isNotBlank()) {
                    key.removePrefix("token_").toIntOrNull()?.let { ids.add(it) }
                }
            }
        }
        return ids
    }

    // 保留 JSON 构造引用，避免极简后端响应下 proguard 误删（debug 不混淆，冗余安全）
    @Suppress("unused")
    private fun touchJson() { JSONObject() }
}
