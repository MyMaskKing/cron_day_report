package xyz.a10023456.todowidget

import android.annotation.SuppressLint
import android.Manifest
import android.appwidget.AppWidgetManager
import android.app.DownloadManager
import android.app.TimePickerDialog
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Environment
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.net.http.SslError
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.WindowCompat
import androidx.core.content.ContextCompat
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.updateAll
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * App 主体：原生壳 + 单 WebView + 底部 5 Tab。
 * 待办/基金/体重/资产 在 WebView 内打开现有网页；「我的」是原生菜单。
 */
class MainActivity : ComponentActivity() {

    // 待权限授予后补发的测试通知时段：null=无待补发；true=晚档 false=早档（用户在测试弹窗里的选择）
    private var pendingTestEvening: Boolean? = null

    // 待权限授予后补发的自定义测试通知内容；与 pendingTestEvening 互斥，自定义内容优先
    private var pendingCustomText: String? = null

    // 音频读取权限：App 自己的 MediaPlayer 播放用户选择的自定义铃声需要
    private val audioPermissionLauncher =
        registerForActivityResult(androidx.activity.result.contract.ActivityResultContracts.RequestPermission()) { }

    private val notificationPermissionLauncher =
        registerForActivityResult(androidx.activity.result.contract.ActivityResultContracts.RequestPermission()) { granted ->
            val pendingEvening = pendingTestEvening
            pendingTestEvening = null
            val pendingCustom = pendingCustomText
            pendingCustomText = null
            if (granted) {
                if (pendingCustom != null) ReminderNotifier.showCustomTest(this, pendingCustom)
                if (pendingEvening != null) ReminderNotifier.showTest(this, pendingEvening)
            }
            if (!granted && (pendingEvening != null || pendingCustom != null)) {
                android.widget.Toast.makeText(
                    this,
                    "请在系统设置中允许通知",
                    android.widget.Toast.LENGTH_SHORT
                ).show()
            }
        }


    // 当前 WebView 实例引用：供 onSaveInstanceState 保存浏览状态（切后台被系统回收后恢复页面栈/表单）
    private var webViewRef: WebView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // 启动即建好全部通知渠道，系统通知设置里立即可见，不必等对应功能首次运行
        TaskAlarmScheduler.createChannel(this)
        AlarmRingingService.ensureChannel(this)
        ReminderNotifier.createChannel(this)
        maybeRequestAudioPermission()
        maybeRequestNotificationPermission()
        // 保持 targetSdk 35 默认 edge-to-edge：WebView 不随软键盘收缩，visualViewport 如实反映
        // 键盘高度（innerHeight 不变、vv.height 缩小），由网页 COMMON_JS 据 vv 把弹窗几何对齐到
        // 键盘上方。不能用 setDecorFitsSystemWindows(true)/adjustResize——那会让 WebView 整体收缩、
        // innerHeight 同步变小，visualViewport 算不出键盘高度(kb=0)，网页避让反而失效。
        val deepUrl = intent?.getStringExtra(Keys.Url.name)
        val savedWebState = savedInstanceState?.getBundle(KEY_WEBVIEW_STATE)
        setContent {
            // 原生主题跟随账号主题（light/dark/eye，与网页 data-theme 同源），MeScreen 切换即时重组
            var appTheme by remember {
                mutableStateOf(Prefs.getTheme(this@MainActivity))
            }
            AppTheme(themeKey = appTheme) {
                // edge-to-edge: 状态栏透明, 图标明暗按主题（light/eye 深图标，dark 浅图标）
                val darkIcons = appTheme != "dark"
                SideEffect {
                    WindowCompat.getInsetsController(
                        this@MainActivity.window,
                        this@MainActivity.window.decorView
                    ).isAppearanceLightStatusBars = darkIcons
                }
                Surface(modifier = Modifier.fillMaxSize()) {
                    AppShell(
                        initialUrl = deepUrl,
                        savedWebState = savedWebState,
                        appTheme = appTheme,
                        onWebView = { webViewRef = it },
                        onThemeSelected = { appTheme = it },
                        onTestNotification = { forceEvening -> testNotification(forceEvening) },
                        onTestCustomNotification = { content -> testCustomNotification(content) }
                    )
                }
            }
        }
    }

    private fun maybeRequestAudioPermission() {
        // Android 13+ 用细分的 READ_MEDIA_AUDIO；12 及以下用 READ_EXTERNAL_STORAGE
        val permission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            android.Manifest.permission.READ_MEDIA_AUDIO
        } else {
            android.Manifest.permission.READ_EXTERNAL_STORAGE
        }
        if (ContextCompat.checkSelfPermission(this, permission) ==
            PackageManager.PERMISSION_GRANTED
        ) return
        audioPermissionLauncher.launch(permission)
    }

    private fun maybeRequestNotificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
        ) return
        notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    private fun testNotification(forceEvening: Boolean) {
        if (ReminderNotifier.hasNotificationPermission(this)) {
            ReminderNotifier.showTest(this, forceEvening)
        } else {
            // 记住用户选择的时段，权限授予后按同一时段补发
            pendingTestEvening = forceEvening
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    private fun testCustomNotification(content: String) {
        val text = content.trim()
        if (text.isEmpty()) return
        if (ReminderNotifier.hasNotificationPermission(this)) {
            ReminderNotifier.showCustomTest(this, text)
        } else {
            // 记住自定义内容，权限授予后原样补发（与时段补发互斥，回调中自定义优先）
            pendingCustomText = text
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        // 后台 Activity 被系统回收前回调：序列化 WebView 历史栈与显示状态，
        // 返回重建时由 AppShell factory 调 restoreState 恢复，而非重新 loadUrl 丢光状态
        webViewRef?.let { wv ->
            val b = Bundle()
            wv.saveState(b)
            outState.putBundle(KEY_WEBVIEW_STATE, b)
        }
    }

    companion object {
        private const val KEY_WEBVIEW_STATE = "webview_state"
        /** 回前台小组件缓存过期阈值：对齐 RefreshWorker 周期 30 分钟。 */
        private const val RESUME_STALE_MS = 30L * 60 * 1000
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // 小组件深链：再次点入时加载指定 URL（AppShell 通过全局事件接收）
        intent.getStringExtra(Keys.Url.name)?.let { DeepLinkBus.emit(it) }
    }

    override fun onResume() {
        super.onResume()
        // App 回前台：周期刷新受 Doze/省电策略可能久未执行，桌面有小组件缓存超 30 分钟时
        // 入队一次持久化静默刷新（进程被杀也会重跑）；同时让网页待办在无弹窗时软刷新，
        // 避免打开 App 仍是昨天的列表
        maybeRefreshWidgets()
        webViewRef?.evaluateJavascript(
            "window._appShellResumeTodo && window._appShellResumeTodo();",
            null
        )
    }

    /** 回前台时检查桌面小组件缓存是否过期，过期则入队持久化刷新。 */
    private fun maybeRefreshWidgets() {
        kotlinx.coroutines.MainScope().launch(Dispatchers.IO) {
            val stale = runCatching {
                GlanceAppWidgetManager(this@MainActivity)
                    .getGlanceIds(TodoAppWidget::class.java)
                    .map { it.resolveAppWidgetId(this@MainActivity) }
                    .filter { it >= 0 }
                    .any {
                        Prefs.getCache(this@MainActivity, it) == null ||
                            System.currentTimeMillis() -
                            Prefs.getLastUpdated(this@MainActivity, it) > RESUME_STALE_MS
                    }
            }.getOrDefault(false)
            if (stale) RefreshWorker.enqueueImmediate(this@MainActivity)
        }
    }

}

/** 跨 onNewIntent 的简单深链总线。 */
object DeepLinkBus {
    var listener: ((String) -> Unit)? = null
    fun emit(url: String) { listener?.invoke(url) }
}

private data class Tab(val label: String, val iconRes: Int, val path: String?)

private data class TodoAlarmPickRequest(
    val requestId: String,
    val dueDate: String,
    val currentMinute: Int
)

private val TABS = listOf(
    Tab("待办", R.drawable.ic_tab_todo, "/todo"),
    Tab("基金", R.drawable.ic_tab_fund, "/fund"),
    Tab("体重", R.drawable.ic_tab_weight, "/weight"),
    Tab("资产", R.drawable.ic_tab_asset, "/asset"),
    Tab("我的", R.drawable.ic_tab_me, null)
)

// 条件展示的仪表盘 Tab：默认首页=仪表盘时插到最左（底部共 6 项）；不并入 TABS，现有顺序定义不动
private val DASH_TAB = Tab("仪表盘", R.drawable.ic_tab_dashboard, "/dashboard")

// 标记原生壳：每次 loadUrl 都带此头，服务端据此隐藏顶部网站导航（cookie 因 setCookie 异步有竞态，用头保证当次请求立即生效）
private val APP_HEADERS = mapOf("X-App-Shell" to "1")

/**
 * 深链/页面 URL → 底部 Tab 下标（按路径前缀匹配）。
 * null（App 冷启动无深链）→ 0；
 * 已登录但不属于当前业务 Tab 的页面（定时任务/渠道/设置等，均从「我的」进入；
 * 仪表盘仅在仪表盘 Tab 未展示时如此）→ -1，底部高亮「我的」（见 NavigationBarItem 选中判定）。
 */
private fun tabIndexFor(url: String?, tabs: List<Tab>): Int {
    if (url == null) return 0
    val path = runCatching { Uri.parse(url).path }.getOrNull() ?: return -1
    val idx = tabs.indexOfFirst { it.path != null && (path == it.path || path.startsWith(it.path + "/")) }
    return if (idx >= 0) idx else -1
}

// 核心业务 Tab 各自保活独立 WebView（切 Tab 不重载、保留滚动位置）；非核心页共用 AUX 槽位
private val CORE_TAB_PATHS = setOf("/dashboard", "/todo", "/fund", "/weight", "/asset")
private const val AUX_SLOT_KEY = "_aux"

private fun slotKeyForUrl(url: String?): String {
    val path = url?.let { runCatching { Uri.parse(it).path }.getOrNull() } ?: return AUX_SLOT_KEY
    return CORE_TAB_PATHS.firstOrNull { path == it || path.startsWith("$it/") } ?: AUX_SLOT_KEY
}

private fun postTodoAlarmPickResult(webView: WebView, requestId: String, minute: Int) {
    val encodedId = org.json.JSONObject.quote(requestId)
    webView.post {
        webView.evaluateJavascript(
            "window.__todoAlarmPickResult && window.__todoAlarmPickResult($encodedId, $minute);",
            null
        )
    }
}

@SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
@Composable
private fun AppShell(
    initialUrl: String?,
    savedWebState: Bundle? = null,
    appTheme: String = "light",
    onWebView: ((WebView?) -> Unit)? = null,
    onThemeSelected: (String) -> Unit = {},
    onTestNotification: (forceEvening: Boolean) -> Unit = {},
    onTestCustomNotification: (content: String) -> Unit = {}
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val haptic = LocalHapticFeedback.current
    var baseUrl by remember { mutableStateOf(AppConfig.getBaseUrl(context)) }
    // 当前账号角色与用户名：sid 变化时拉 /api/auth/me 更新
    var accountRole by remember { mutableStateOf(Prefs.getRole(context)) }
    var accountUsername by remember { mutableStateOf(Prefs.getUsername(context)) }
    var openServerSheetTrigger by remember { mutableIntStateOf(0) }
    // 底部仪表盘 Tab：默认首页=仪表盘时展示（由下方偏好同步与 AppShell 桥驱动）
    var dashTab by rememberSaveable { mutableStateOf(false) }
    val tabs = if (dashTab) listOf(DASH_TAB) + TABS else TABS
    var selected by rememberSaveable { mutableStateOf(tabIndexFor(initialUrl, tabs)) }
    var showMe by rememberSaveable { mutableStateOf(false) }

    // 冷启动（无深链）加载根路径，服务端按默认首页偏好 302；深链原样打开
    val startUrl = remember(initialUrl, baseUrl) { initialUrl ?: (baseUrl + "/") }
    val initialSlotKey = remember(startUrl) { slotKeyForUrl(startUrl) }
    var slotKeys by remember { mutableStateOf(listOf(initialSlotKey)) }
    var activeSlotKey by rememberSaveable { mutableStateOf(initialSlotKey) }
    val slotTargetUrls = remember {
        mutableStateMapOf<String, String>().apply { put(initialSlotKey, startUrl) }
    }
    val slotLastLoadedUrls = remember { mutableStateMapOf<String, String>() }
    val slotProgress = remember { mutableStateMapOf<String, Int>() }
    val slotErrors = remember { mutableStateMapOf<String, WebLoadError?>() }
    val slotWebViews = remember { mutableStateMapOf<String, WebView>() }

    val activeWebView = slotWebViews[activeSlotKey]
    LaunchedEffect(activeWebView) {
        onWebView?.invoke(activeWebView)
    }

    // WebViewClient 只在 factory 创建一次，用 rememberUpdatedState 让它始终读到最新值
    val currentBaseUrl by rememberUpdatedState(baseUrl)
    val currentActiveSlotKey by rememberUpdatedState(activeSlotKey)
    val primaryColorArgb = MaterialTheme.colorScheme.primary.toArgb()

    // 双击底栏当前 Tab 回顶
    var lastTapTabIdx by remember { mutableIntStateOf(-1) }
    var lastTapTimeMs by remember { mutableStateOf(0L) }

    // 已登录冷启动：拉默认首页偏好与账号信息（用户名+角色）
    LaunchedEffect(baseUrl) {
        val sid = Prefs.getSid(context)
        if (sid.isBlank()) return@LaunchedEffect
        val info = withContext(Dispatchers.IO) {
            runCatching { ApiClient.fetchAccountInfo(baseUrl, sid) }.getOrNull()
        }
        if (info != null) {
            accountUsername = info.first
            accountRole = info.second
            Prefs.setUsername(context, info.first)
            Prefs.setRole(context, info.second)
        }
        val home = withContext(Dispatchers.IO) {
            runCatching { ApiClient.fetchDefaultHome(baseUrl, sid) }.getOrNull()
        }
        if (home != null) dashTab = home == "dashboard"
    }

    // WebView <input type=file> 选择回调（待办附件上传）：网页发起文件选择 → 系统选择器 → 回传 Uri
    var filePathCallback by remember { mutableStateOf<android.webkit.ValueCallback<Array<Uri>>?>(null) }
    val fileChooserLauncher = rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val cb = filePathCallback
        filePathCallback = null
        cb?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data))
    }

    var pendingTodoAlarmPick by remember { mutableStateOf<TodoAlarmPickRequest?>(null) }
    fun showTodoAlarmTimePicker(request: TodoAlarmPickRequest) {
        val webView = slotWebViews[activeSlotKey] ?: return
        val now = java.util.Calendar.getInstance()
        val initialMinute = if (request.currentMinute in 0..1439) {
            request.currentMinute
        } else {
            now.get(java.util.Calendar.HOUR_OF_DAY) * 60 + now.get(java.util.Calendar.MINUTE)
        }
        TimePickerDialog(
            context,
            { _, hourOfDay, minute ->
                val pickedMinute = hourOfDay * 60 + minute
                val pickedAt = runCatching {
                    java.time.LocalDate.parse(request.dueDate)
                        .atTime(hourOfDay, minute)
                        .atZone(java.time.ZoneId.systemDefault())
                        .toInstant()
                        .toEpochMilli()
                }.getOrNull()
                if (pickedAt == null || pickedAt <= System.currentTimeMillis()) {
                    android.widget.Toast.makeText(
                        context,
                        "提醒时间已过，请重新选择",
                        android.widget.Toast.LENGTH_SHORT
                    ).show()
                    postTodoAlarmPickResult(webView, request.requestId, -1)
                } else {
                    postTodoAlarmPickResult(webView, request.requestId, pickedMinute)
                }
            },
            initialMinute / 60,
            initialMinute % 60,
            true
        ).apply {
            setOnCancelListener {
                postTodoAlarmPickResult(webView, request.requestId, -1)
            }
            show()
        }
    }

    val exactAlarmPermissionLauncher = rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.StartActivityForResult()
    ) {
        val request = pendingTodoAlarmPick
        pendingTodoAlarmPick = null
        val webView = slotWebViews[activeSlotKey]
        if (request != null && webView != null) {
            if (TaskAlarmScheduler.canScheduleExactAlarms(context.applicationContext)) {
                showTodoAlarmTimePicker(request)
            } else {
                postTodoAlarmPickResult(webView, request.requestId, -1)
            }
        }
    }

    // 软键盘高度（CSS px）：edge-to-edge 下 WebView 不随键盘收缩，且实测该 WebView 的
    // visualViewport 不反映键盘（vv.height≈innerHeight，网页算不出键盘高）。改由原生
    // WindowInsets.ime 实测键盘高，注入网页 CSS 变量 --kb-native，网页据此把弹窗/输入框抬到键盘上方。
    var kbCss by remember { mutableStateOf(0f) }
    val currentKbCss by rememberUpdatedState(kbCss)
    // 原生底部 Tab 栏高度（px）：WebView 铺在 Scaffold content 内、不延伸到 Tab 栏下，
    // 注入键盘高度时必须扣掉，否则网页会多抬一个 Tab 栏的高度（弹窗与键盘间留大缝）
    var bottomBarPx by remember { mutableStateOf(0f) }
    val density = LocalDensity.current
    val imeBottomPx = WindowInsets.ime.getBottom(density)
    LaunchedEffect(imeBottomPx, bottomBarPx) {
        val effectiveImePx = (imeBottomPx - bottomBarPx).coerceAtLeast(0f)
        kbCss = effectiveImePx / density.density
        // 注入键盘高度并通知网页：弹窗贴键盘上沿（.kb-on）+ 把当前聚焦框滚到键盘上方
        webViewRef?.evaluateJavascript(
            "document.documentElement.style.setProperty('--kb-native','${kbCss}px');" +
                "window.__onKb&&window.__onKb();",
            null
        )
    }

    // 小组件再次点入的深链：同步选中对应底部 Tab（待办/基金/体重/资产）
    androidx.compose.runtime.DisposableEffect(Unit) {
        // 强制重新加载：同一深链 URL 第二次点入也要重跑网页 init（?edit/?addChild 弹窗）。
        fun loadDeepLink(wv: WebView, url: String, slotKey: String) {
            CookieManager.getInstance().setCookie(baseUrl, "app_shell=1; Path=/")
            val sep = if (url.contains('?')) '&' else '?'
            wv.loadUrl("$url${sep}_t=${System.currentTimeMillis()}", APP_HEADERS)
            slotLastLoadedUrls[slotKey] = url // 记逻辑 URL（不含 nonce），供 update 去重
        }
        DeepLinkBus.listener = { url ->
            val slotKey = slotKeyForUrl(url)
            if (!slotKeys.contains(slotKey)) slotKeys = slotKeys + slotKey
            slotTargetUrls[slotKey] = url
            activeSlotKey = slotKey
            selected = tabIndexFor(url, tabs)
            showMe = false
            slotWebViews[slotKey]?.let { wv ->
                val targetUri = runCatching { Uri.parse(url) }.getOrNull()
                val targetRoot = targetUri?.getQueryParameter("root")
                val targetEdit = targetUri?.getQueryParameter("edit")
                if (targetRoot != null || targetEdit != null) {
                    wv.evaluateJavascript(
                        "window._appTodoDeeplinkState ? window._appTodoDeeplinkState() : 'null'"
                    ) { cur ->
                        val same = runCatching {
                            if (cur == null || cur == "null") false
                            else {
                                val o = org.json.JSONObject(cur)
                                fun field(k: String): String? =
                                    if (o.isNull(k)) null else o.get(k).toString()
                                field("root") == targetRoot && field("view") == targetEdit
                            }
                        }.getOrDefault(false)
                        if (!same) loadDeepLink(wv, url, slotKey)
                    }
                } else {
                    loadDeepLink(wv, url, slotKey)
                }
            }
        }
        onDispose { DeepLinkBus.listener = null }
    }

    fun openPath(path: String) {
        val url = baseUrl + path
        val slotKey = slotKeyForUrl(url)
        if (!slotKeys.contains(slotKey)) slotKeys = slotKeys + slotKey
        slotTargetUrls[slotKey] = url
        activeSlotKey = slotKey
        selected = tabIndexFor(url, tabs)
        showMe = false
    }

    // 系统返回（安卓边缘左滑手势 / 三键返回键）：
    BackHandler(enabled = true) {
        if (showMe) {
            showMe = false
            return@BackHandler
        }
        slotWebViews[activeSlotKey]?.evaluateJavascript(
            "(window._appShellBack && window._appShellBack()) === true",
            null
        )
    }

    Scaffold(
        bottomBar = {
            val navBarBorderColor = MaterialTheme.colorScheme.outlineVariant
            val brandColor = MaterialTheme.colorScheme.primary
            val unselectedColor = MaterialTheme.colorScheme.onSurfaceVariant
            NavigationBar(
                containerColor = MaterialTheme.colorScheme.surface,
                tonalElevation = 0.dp,
                modifier = Modifier.drawBehind {
                    drawRect(
                        color = navBarBorderColor,
                        topLeft = androidx.compose.ui.geometry.Offset.Zero,
                        size = androidx.compose.ui.geometry.Size(size.width, 1.dp.toPx())
                    )
                }
            ) {
                val sixTabs = tabs.size > 5
                tabs.forEachIndexed { i, tab ->
                    val isSel = if (tab.path == null) (showMe || selected == -1) else (!showMe && selected == i)
                    NavigationBarItem(
                        selected = isSel,
                        onClick = {
                            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                            if (tab.path == null) {
                                showMe = true
                                lastTapTabIdx = -1
                            } else {
                                val now = android.os.SystemClock.uptimeMillis()
                                if (!showMe && selected == i && lastTapTabIdx == i && now - lastTapTimeMs < 450L) {
                                    slotWebViews[activeSlotKey]?.evaluateJavascript(
                                        "(function(){window.scrollTo({top:0,behavior:'smooth'});var c=document.querySelector('.todo-fs-list,.container');if(c&&c.scrollTo)c.scrollTo({top:0,behavior:'smooth'});})();",
                                        null
                                    )
                                    lastTapTimeMs = 0L
                                } else {
                                    lastTapTabIdx = i
                                    lastTapTimeMs = now
                                    selected = i
                                    openPath(tab.path)
                                }
                            }
                        },
                        icon = {
                            // 28dp 槽：选中时顶部 22×2.5 短条，图标 22dp 居中
                            androidx.compose.foundation.layout.Box(
                                modifier = Modifier
                                    .width(28.dp)
                                    .height(28.dp),
                                contentAlignment = androidx.compose.ui.Alignment.Center
                            ) {
                                if (isSel) {
                                    androidx.compose.foundation.layout.Box(
                                        modifier = Modifier
                                            .align(androidx.compose.ui.Alignment.TopCenter)
                                            .width(if (sixTabs) 20.dp else 22.dp)
                                            .height(2.5.dp)
                                            .clip(androidx.compose.foundation.shape.RoundedCornerShape(2.dp))
                                            .background(brandColor)
                                    )
                                }
                                Icon(
                                    painter = painterResource(tab.iconRes),
                                    contentDescription = tab.label,
                                    modifier = Modifier.size(if (sixTabs) 20.dp else 22.dp)
                                )
                            }
                        },
                        label = {
                            Text(
                                tab.label,
                                fontSize = if (sixTabs) 10.sp else 11.sp,
                                fontWeight = if (isSel) FontWeight.Bold else FontWeight.Medium
                            )
                        },
                        colors = NavigationBarItemDefaults.colors(
                            indicatorColor = androidx.compose.ui.graphics.Color.Transparent,
                            selectedIconColor = brandColor,
                            selectedTextColor = brandColor,
                            unselectedIconColor = unselectedColor,
                            unselectedTextColor = unselectedColor
                        )
                    )
                }
            }
        }
    ) { padding ->
        // 记录底部 Tab 栏实际高度供键盘高度换算（值恒定，同值赋值不触发重组）
        bottomBarPx = with(density) { padding.calculateBottomPadding().toPx() }
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            // 核心业务 Tab 按需懒加载并保活各自 WebView，切换不重载、保留滚动位置
            slotKeys.forEach { slotKey ->
                key(slotKey) {
                    val isActiveSlot = !showMe && activeSlotKey == slotKey
                    AndroidView(
                        factory = { ctx ->
                    // 先创建下拉刷新容器，WebView 的 WebViewClient 需要在页面加载完成时收起它的指示器
                    val swipe = LockableSwipeRefreshLayout(ctx)
                    val wv = WebView(ctx).apply {
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        settings.databaseEnabled = true
                        settings.cacheMode = WebSettings.LOAD_DEFAULT
                        settings.loadWithOverviewMode = true
                        settings.useWideViewPort = true
                        // 关闭 WebView 页面级双指缩放：图片预览的缩放由网页灯箱自行接管，
                        // 否则双指放大的是整个页面，关闭图片后界面会卡在放大态且无缩放按钮可还原
                        settings.setSupportZoom(false)
                        settings.builtInZoomControls = false
                        settings.displayZoomControls = false
                        settings.mediaPlaybackRequiresUserGesture = false
                        CookieManager.getInstance().setAcceptCookie(true)
                        CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
                        // 标记原生壳环境：服务端据此隐藏顶部网站导航，底部由原生 Tab 提供导航
                        CookieManager.getInstance().setCookie(currentBaseUrl, "app_shell=1; Path=/")
                        setBackgroundColor(Color.TRANSPARENT)
                        // 关闭系统滚动条：网页 CSS 在 WebView 内不可靠，滚动时浮现的系统条会遮挡内容
                        isVerticalScrollBarEnabled = false
                        isHorizontalScrollBarEnabled = false
                        webViewClient = object : WebViewClient() {
                            override fun shouldOverrideUrlLoading(
                                view: WebView, request: WebResourceRequest
                            ): Boolean {
                                val uri = request.url
                                val sameHost = uri.host == Uri.parse(currentBaseUrl).host
                                return if (sameHost) {
                                    false // 留在 WebView
                                } else {
                                    context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                                    true
                                }
                            }

                            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                                super.onPageStarted(view, url, favicon)
                                slotErrors[slotKey] = null
                                slotProgress[slotKey] = 10
                                swipe.isRefreshing = false
                            }

                            override fun onReceivedError(
                                view: WebView?,
                                request: WebResourceRequest,
                                error: WebResourceError
                            ) {
                                super.onReceivedError(view, request, error)
                                if (request.isForMainFrame) {
                                    swipe.isRefreshing = false
                                    slotErrors[slotKey] = WebLoadError(ssl = false, code = error.errorCode)
                                }
                            }

                            override fun onReceivedSslError(
                                view: WebView?,
                                handler: SslErrorHandler,
                                error: SslError?
                            ) {
                                handler.cancel()
                                swipe.isRefreshing = false
                                slotErrors[slotKey] = WebLoadError(ssl = true)
                            }

                            override fun doUpdateVisitedHistory(view: WebView?, url: String?, isReload: Boolean) {
                                super.doUpdateVisitedHistory(view, url, isReload)
                                if (slotKey != currentActiveSlotKey) return
                                val path = url?.let { runCatching { Uri.parse(it).path }.getOrNull() } ?: return
                                val idx = tabs.indexOfFirst {
                                    it.path != null && (path == it.path || path.startsWith(it.path + "/"))
                                }
                                if (idx >= 0) {
                                    selected = idx
                                    showMe = false
                                    return
                                }
                                val hasSid = CookieManager.getInstance().getCookie(url)
                                    ?.let { Regex("(?:^|;)\\s*sid=([^;]+)").find(it)?.groupValues?.get(1)?.isNotBlank() } == true
                                if (hasSid && path != "/login" && path != "/setup") selected = -1
                            }

                            override fun onPageFinished(view: WebView, url: String?) {
                                super.onPageFinished(view, url)
                                slotProgress[slotKey] = 100
                                view.evaluateJavascript(
                                    "document.documentElement.style.setProperty('--kb-native','${currentKbCss}px');" +
                                        "window.__onKb&&window.__onKb();",
                                    null
                                )
                                swipe.isRefreshing = false
                                val cookieUrl = url ?: currentBaseUrl
                                val cookies = CookieManager.getInstance().getCookie(cookieUrl) ?: ""
                                val sid = Regex("(?:^|;)\\s*sid=([^;]+)").find(cookies)?.groupValues?.get(1)
                                val oldSid = Prefs.getSid(context)
                                when {
                                    !sid.isNullOrBlank() && sid != oldSid -> {
                                        Prefs.setSid(context, sid)
                                        val roleBaseUrl = currentBaseUrl
                                        kotlinx.coroutines.MainScope().launch(Dispatchers.IO) {
                                            val info = runCatching {
                                                ApiClient.fetchAccountInfo(roleBaseUrl, sid)
                                            }.getOrNull()
                                            val role = info?.second ?: "user"
                                            val username = info?.first.orEmpty()
                                            Prefs.setRole(context, role)
                                            if (username.isNotBlank()) Prefs.setUsername(context, username)
                                            withContext(Dispatchers.Main) {
                                                accountRole = role
                                                if (username.isNotBlank()) accountUsername = username
                                            }
                                        }
                                        kotlinx.coroutines.MainScope().launch(Dispatchers.IO) {
                                            val home = runCatching {
                                                ApiClient.fetchDefaultHome(roleBaseUrl, sid)
                                            }.getOrNull()
                                            if (home != null) {
                                                withContext(Dispatchers.Main) { dashTab = home == "dashboard" }
                                            }
                                        }
                                        RefreshWorker.refreshAllNow(context)
                                    }
                                    sid.isNullOrBlank() && oldSid.isNotBlank() -> {
                                        Prefs.clearSid(context)
                                        Prefs.clearRole(context)
                                        Prefs.clearUsername(context)
                                        accountRole = "user"
                                        accountUsername = ""
                                        dashTab = false
                                        kotlinx.coroutines.MainScope().launch(Dispatchers.IO) {
                                            withContext(Dispatchers.Main) { TodoAppWidget().updateAll(context) }
                                        }
                                    }
                                }
                            }
                        }
                        webChromeClient = object : WebChromeClient() {
                            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                                slotProgress[slotKey] = newProgress
                            }
                            // 待办备注附件：支持网页 input[type=file] 选图片/任意文件（accept 由网页指定）
                            override fun onShowFileChooser(
                                webView: WebView?,
                                callback: android.webkit.ValueCallback<Array<Uri>>?,
                                params: WebChromeClient.FileChooserParams?
                            ): Boolean {
                                filePathCallback?.onReceiveValue(null)
                                filePathCallback = callback
                                return try {
                                    val intent = params?.createIntent()
                                        ?: Intent(Intent.ACTION_GET_CONTENT).apply { type = "*/*" }
                                    fileChooserLauncher.launch(intent)
                                    true
                                } catch (e: Exception) {
                                    filePathCallback = null
                                    false
                                }
                            }
                        }
                        // 待办普通附件：服务端回 Content-Disposition: attachment，WebView 默认不下载，
                        // 交给系统 DownloadManager（带会话 cookie，完成后通知栏可见，落「下载」目录）
                        setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
                            try {
                                val fileName = parseDownloadName(contentDisposition) ?: "todo-attachment"
                                val req = DownloadManager.Request(Uri.parse(url)).apply {
                                    setMimeType(if (mimeType.isNullOrBlank()) "*/*" else mimeType)
                                    addRequestHeader(
                                        "Cookie",
                                        CookieManager.getInstance().getCookie(url) ?: ""
                                    )
                                    setNotificationVisibility(
                                        DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED
                                    )
                                    setDestinationInExternalPublicDir(
                                        Environment.DIRECTORY_DOWNLOADS, fileName
                                    )
                                }
                                val dm = context.getSystemService(android.content.Context.DOWNLOAD_SERVICE) as DownloadManager
                                dm.enqueue(req)
                            } catch (e: Exception) {
                                // 无下载器等极端情况：退回外部浏览器打开
                                context.startActivity(
                                    Intent(Intent.ACTION_VIEW, Uri.parse(url))
                                )
                            }
                        }
                        // 待办全屏/弹窗等页面在网页"内部容器"里滚动，WebView 原生 scrollY 恒为 0，
                        // SwipeRefreshLayout 会误判在顶部而拦截向下拖拽（卡片/弹窗卡死无法下滑）。
                        // 网页经 AppShell 桥实时上报"是否在顶部"，据此开关下拉刷新。
                        val bridgeWebView: WebView = this
                        addJavascriptInterface(object {
                            @JavascriptInterface
                            fun setPullRefresh(enable: Boolean) {
                                // volatile 即时闸门：JS 在 touchstart 调用，若只靠 post 切主线程，
                                // 首批 MOVE 会先执行（进度圈闪现但不会真刷新）
                                swipe.touchLocked = !enable
                                Handler(Looper.getMainLooper()).post {
                                    swipe.isEnabled = enable
                                    // 清掉锁定生效前已冒出的进度圈；真刷新中(isRefreshing)保留
                                    if (!enable && !swipe.isRefreshing) swipe.isRefreshing = false
                                }
                            }

                            // 网页内待办增删改/勾选/排序后，网页 loadTodos 收尾经桥回调：
                            // 主线程防抖 800ms（拖拽排序等连续变更合并为一次）后直连刷新所有桌面
                            // 小组件，不等 15 分钟周期 Worker（WorkManager 一次性任务可能被系统延迟）。
                            private val widgetHandler = Handler(Looper.getMainLooper())
                            // 进程内直连 + WorkManager 持久化兜底：用户刷新后立即退出、进程被杀时
                            // 直连任务可能来不及完成，持久化任务保证数据落盘（唯一任务 REPLACE 去重）
                            private val widgetRefresh = Runnable {
                                RefreshWorker.refreshAllNow(ctx)
                                RefreshWorker.enqueueImmediate(ctx)
                            }
                            @JavascriptInterface
                            fun todoChanged() {
                                widgetHandler.removeCallbacks(widgetRefresh)
                                widgetHandler.postDelayed(widgetRefresh, 800L)
                            }

                            @JavascriptInterface
                            fun pickTodoAlarm(requestId: String, dueDate: String, currentMinute: Int) {
                                Handler(Looper.getMainLooper()).post {
                                    val request = TodoAlarmPickRequest(requestId, dueDate, currentMinute)
                                    if (TaskAlarmScheduler.canScheduleExactAlarms(ctx.applicationContext)) {
                                        showTodoAlarmTimePicker(request)
                                        return@post
                                    }

                                    pendingTodoAlarmPick = request
                                    android.app.AlertDialog.Builder(ctx)
                                        .setTitle("允许精确闹钟")
                                        .setMessage("待办闹钟需要“闹钟和提醒”权限，才能在设置的时间准时响铃或震动。授权后会自动打开时间选择器。")
                                        .setPositiveButton("去授权") { _, _ ->
                                            val intent = TaskAlarmScheduler.exactAlarmSettingsIntent(ctx.applicationContext)
                                            if (intent == null) {
                                                pendingTodoAlarmPick = null
                                                postTodoAlarmPickResult(bridgeWebView, requestId, -1)
                                            } else {
                                                try {
                                                    exactAlarmPermissionLauncher.launch(intent)
                                                } catch (e: Exception) {
                                                    try {
                                                        exactAlarmPermissionLauncher.launch(
                                                            TaskAlarmScheduler.applicationDetailsSettingsIntent(ctx.applicationContext)
                                                        )
                                                    } catch (e2: Exception) {
                                                        pendingTodoAlarmPick = null
                                                        postTodoAlarmPickResult(bridgeWebView, requestId, -1)
                                                    }
                                                }
                                            }
                                        }
                                        .setNegativeButton("取消") { _, _ ->
                                            pendingTodoAlarmPick = null
                                            postTodoAlarmPickResult(bridgeWebView, requestId, -1)
                                        }
                                        .setOnCancelListener {
                                            pendingTodoAlarmPick = null
                                            postTodoAlarmPickResult(bridgeWebView, requestId, -1)
                                        }
                                        .show()
                                }
                            }

                            @JavascriptInterface
                            fun setTodoAlarm(raw: String): String {
                                val appContext = ctx.applicationContext
                                val baseUrl = AppConfig.getBaseUrl(appContext)
                                return try {
                                    TaskAlarmScheduler.setFromJson(appContext, baseUrl, raw)
                                } catch (e: Throwable) {
                                    android.util.Log.e("TodoTaskAlarm", "setTodoAlarm failed: $raw", e)
                                    "本地闹钟设置失败：${e.javaClass.simpleName}：${e.message ?: "未知异常"}"
                                }
                            }

                            @JavascriptInterface
                            fun getTodoAlarm(todoId: String): Int {
                                val appContext = ctx.applicationContext
                                return try {
                                    TaskAlarmScheduler.minuteOf(
                                        appContext,
                                        AppConfig.getBaseUrl(appContext),
                                        todoId
                                    )
                                } catch (e: Throwable) {
                                    android.util.Log.e("TodoTaskAlarm", "getTodoAlarm failed", e)
                                    -1
                                }
                            }

                            @JavascriptInterface
                            fun cancelTodoAlarm(todoId: String) {
                                val appContext = ctx.applicationContext
                                try {
                                    TaskAlarmScheduler.cancel(
                                        appContext,
                                        AppConfig.getBaseUrl(appContext),
                                        todoId
                                    )
                                } catch (e: Throwable) {
                                    android.util.Log.e("TodoTaskAlarm", "cancelTodoAlarm failed", e)
                                }
                            }

                            @JavascriptInterface
                            fun reconcileTodoAlarms(raw: String) {
                                val appContext = ctx.applicationContext
                                try {
                                    TaskAlarmScheduler.reconcile(
                                        appContext,
                                        AppConfig.getBaseUrl(appContext),
                                        raw
                                    )
                                } catch (e: Throwable) {
                                    android.util.Log.e("TodoTaskAlarm", "reconcileTodoAlarms failed", e)
                                }
                            }

                            // 网页设置页保存默认首页时即时驱动底部仪表盘 Tab 显隐（无需等 onResume）
                            @JavascriptInterface
                            fun setDefaultHome(home: String) {
                                Handler(Looper.getMainLooper()).post { dashTab = home == "dashboard" }
                            }

                        }, "AppShell")
                        // 长按任务行拖拽排序的下拉刷新冲突, 在原生主线程同步处理:
                        // 网页 JS 长按检测经 bridge 关闭下拉刷新有跨线程延迟, 拖拽首帧可能已被
                        // SwipeRefreshLayout 抢走手势. 这里 OnTouchListener 只观察不消费(返回 false),
                        // 按住 350ms 且移动 < touchSlop 即判定长按, 当场在主线程 isEnabled=false;
                        // 抬手/取消恢复(之后由网页 AppShell 桥按滚动位置纠正). 零 JS 延迟.
                        val touchSlop = ViewConfiguration.get(ctx).scaledTouchSlop
                        val lpHandler = Handler(Looper.getMainLooper())
                        var lpX = 0f
                        var lpY = 0f
                        var lpFired = false
                        val lpRunnable = Runnable { lpFired = true; swipe.isEnabled = false }
                        setOnTouchListener { _, ev ->
                            when (ev.actionMasked) {
                                MotionEvent.ACTION_DOWN -> {
                                    lpX = ev.rawX; lpY = ev.rawY; lpFired = false
                                    lpHandler.removeCallbacks(lpRunnable)
                                    lpHandler.postDelayed(lpRunnable, 350)
                                }
                                MotionEvent.ACTION_MOVE -> {
                                    if (!lpFired && kotlin.math.hypot(
                                            (ev.rawX - lpX).toDouble(),
                                            (ev.rawY - lpY).toDouble()
                                        ) > touchSlop
                                    ) {
                                        lpHandler.removeCallbacks(lpRunnable) // 已滑动, 非长按
                                    }
                                }
                                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                                    lpHandler.removeCallbacks(lpRunnable)
                                    if (lpFired) { swipe.isEnabled = true; lpFired = false }
                                }
                            }
                            false // 不消费, WebView 正常处理并继续派发给网页
                        }
                        // 后台回收后重建：普通打开优先恢复历史栈；通知/小组件深链以目标页为准，
                        // 避免恢复到旧页面；restoreState 成功返回 RestoreResult、失败返回 null
                        val initUrl = slotTargetUrls[slotKey] ?: (currentBaseUrl + "/")
                        val restored = if (initialUrl == null && slotKey == initialSlotKey) {
                            savedWebState?.let { restoreState(it) } != null
                        } else {
                            false
                        }
                        if (!restored) {
                            loadUrl(initUrl, APP_HEADERS)
                        }
                        slotLastLoadedUrls[slotKey] = initUrl
                        slotWebViews[slotKey] = this
                    }
                    swipe.addView(
                        wv,
                        ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                    )
                    swipe.setColorSchemeColors(primaryColorArgb)
                    swipe.setOnRefreshListener { wv.reload() }
                    swipe
                },
                update = { swipe ->
                    swipe.visibility = if (isActiveSlot) View.VISIBLE else View.INVISIBLE
                    swipe.setColorSchemeColors(primaryColorArgb)
                    val wv = slotWebViews[slotKey]
                    val target = slotTargetUrls[slotKey]
                    if (wv != null && target != null && target != slotLastLoadedUrls[slotKey]) {
                        CookieManager.getInstance().setCookie(baseUrl, "app_shell=1; Path=/")
                        wv.loadUrl(target, APP_HEADERS)
                        slotLastLoadedUrls[slotKey] = target
                    }
                },
                modifier = Modifier.fillMaxSize(),
                onRelease = { swipe ->
                    slotWebViews.remove(slotKey)
                    for (i in 0 until swipe.childCount) {
                        val child = swipe.getChildAt(i)
                        if (child is WebView) {
                            swipe.removeView(child)
                            child.destroy()
                            break
                        }
                    }
                }
            )
                }
            }
            // 顶部 2.5dp 加载进度条（仅当前激活 WebView 加载中展示）
            val activeProgress = slotProgress[activeSlotKey] ?: 100
            if (!showMe && activeProgress in 1..99) {
                LinearProgressIndicator(
                    progress = { activeProgress / 100f },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(2.5.dp)
                        .align(Alignment.TopCenter),
                    color = MaterialTheme.colorScheme.primary,
                    trackColor = androidx.compose.ui.graphics.Color.Transparent
                )
            }
            // 主文档加载/证书失败覆盖层：替代白屏，给出原因、重试与切换服务器入口；SSL 错误仅提示不放行
            slotErrors[activeSlotKey]?.let { err ->
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.surface
                ) {
                    Column(
                        modifier = Modifier.fillMaxSize().padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            painter = painterResource(R.drawable.ic_error_network),
                            contentDescription = null,
                            tint = if (err.ssl) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(Modifier.height(14.dp))
                        Text(
                            if (err.ssl) "安全连接失败" else "网络连接失败",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            if (err.ssl)
                                "服务器证书校验未通过，可能遇到网络劫持或代理/VPN 干扰。"
                            else
                                "页面暂时无法加载，请检查网络连接或服务器地址。",
                            fontSize = 13.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center
                        )
                        if (err.ssl) {
                            Spacer(Modifier.height(4.dp))
                            Text(
                                "请切换网络或关闭代理后重试。",
                                fontSize = 13.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.Center
                            )
                        } else if (err.code != null) {
                            Spacer(Modifier.height(4.dp))
                            Text(
                                "错误代码 ${err.code}",
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.Center
                            )
                        }
                        Spacer(Modifier.height(22.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            OutlinedButton(onClick = {
                                showMe = true
                                openServerSheetTrigger++
                            }) {
                                Text("切换服务器")
                            }
                            Button(onClick = { activeWebView?.reload() }) {
                                Text("重新加载")
                            }
                        }
                    }
                }
            }
            if (showMe) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    MeScreen(
                        baseUrl = baseUrl,
                        username = accountUsername,
                        isLoggedIn = Prefs.getSid(context).isNotBlank(),
                        currentThemeKey = appTheme,
                        isAdmin = accountRole == "admin",
                        openServerSheetTrigger = openServerSheetTrigger,
                        onOpenPath = { path -> openPath(path) },
                        onChangeBaseUrl = { newUrl ->
                            AppConfig.setBaseUrl(context, newUrl)
                            CookieManager.getInstance().removeAllCookies(null)
                            Prefs.clearSid(context)
                            Prefs.clearRole(context)
                            Prefs.clearUsername(context)
                            accountRole = "user"
                            accountUsername = ""
                            dashTab = false
                            baseUrl = AppConfig.normalize(newUrl)
                            val todoUrl = baseUrl + "/todo"
                            slotKeys.forEach { k -> slotLastLoadedUrls.remove(k) }
                            slotKeys = listOf("/todo")
                            slotTargetUrls.clear()
                            slotTargetUrls["/todo"] = todoUrl
                            activeSlotKey = "/todo"
                            selected = 0
                            showMe = false
                        },
                        onOpenInBrowser = {
                            val sid = Prefs.getSid(context)
                            val curUrl = activeWebView?.url ?: baseUrl
                            val url = if (sid.isNotBlank()) {
                                val path = runCatching { Uri.parse(curUrl).path }.getOrNull()
                                val to = if (!path.isNullOrBlank()) path else "/todo"
                                baseUrl + "/auth/bridge?sid=" + Uri.encode(sid) + "&to=" + Uri.encode(to)
                            } else {
                                curUrl
                            }
                            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                        },
                        onSelectTheme = { t ->
                            Prefs.setTheme(context, t)
                            onThemeSelected(t)
                            val js = "window.__applyTheme && window.__applyTheme('$t', true);"
                            slotWebViews.values.forEach { wv -> wv.evaluateJavascript(js, null) }
                        },
                        onTestNotification = onTestNotification,
                        onTestCustomNotification = onTestCustomNotification,
                        onLogout = {
                            CookieManager.getInstance().removeAllCookies(null)
                            Prefs.clearSid(context)
                            Prefs.clearRole(context)
                            Prefs.clearUsername(context)
                            accountRole = "user"
                            accountUsername = ""
                            dashTab = false
                            val loginUrl = baseUrl + "/login"
                            slotKeys = listOf(AUX_SLOT_KEY)
                            slotTargetUrls.clear()
                            slotLastLoadedUrls.clear()
                            slotTargetUrls[AUX_SLOT_KEY] = loginUrl
                            activeSlotKey = AUX_SLOT_KEY
                            showMe = false
                            slotWebViews[AUX_SLOT_KEY]?.loadUrl(loginUrl, APP_HEADERS)
                        }
                    )
                }
            }
        }
    }
}

/**
 * 从 Content-Disposition 取下载文件名：优先 filename*=UTF-8''（服务端对中文名用此编码），
 * 其次 filename="ascii"；都没有返回 null。结果做一次路径分隔符清洗，防目录穿越。
 */
private fun parseDownloadName(disposition: String?): String? {
    if (disposition.isNullOrBlank()) return null
    val star = Regex("filename\\*\\s*=\\s*[^']*''([^;]+)", RegexOption.IGNORE_CASE).find(disposition)
    val raw = if (star != null) {
        runCatching { java.net.URLDecoder.decode(star.groupValues[1].trim(), "UTF-8") }.getOrNull()
    } else {
        val plain = Regex("filename\\s*=\\s*\"?([^\";]+)\"?", RegexOption.IGNORE_CASE).find(disposition)
        plain?.groupValues?.get(1)?.trim()
    }
    return raw?.substringAfterLast('/')?.substringAfterLast('\\')?.takeIf { it.isNotBlank() }
}

/**
 * WebView 主文档加载失败状态：ssl=true 为证书校验失败（不放行、提示切换网络）；
 * code 为普通网络错误码（WebResourceError.errorCode），仅展示辅助排查。
 */
private data class WebLoadError(val ssl: Boolean, val code: Int? = null)

/**
 * 下拉刷新容器：支持触摸手势期间「即时锁定」。
 * touchLocked 为 @Volatile，@JavascriptInterface 线程写入后主线程立即可见，
 * 无需 post——右滑起手即移动，post 到主线程会晚于首批 MOVE，刷新圈仍会闪现。
 */
private class LockableSwipeRefreshLayout(context: Context) : SwipeRefreshLayout(context) {
    @Volatile
    var touchLocked = false

    // 传统触摸路径
    override fun onInterceptTouchEvent(ev: MotionEvent): Boolean =
        !touchLocked && super.onInterceptTouchEvent(ev)

    override fun onTouchEvent(ev: MotionEvent): Boolean =
        !touchLocked && super.onTouchEvent(ev)

    // 嵌套滑动路径（WebView 为 NestedScrollingChild；Parent2 版本最终也回落到本方法）
    override fun onStartNestedScroll(child: View, target: View, axes: Int): Boolean =
        !touchLocked && super.onStartNestedScroll(child, target, axes)
}
