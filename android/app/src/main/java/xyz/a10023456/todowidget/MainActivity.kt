package xyz.a10023456.todowidget

import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.Intent
import android.os.Environment
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.MotionEvent
import android.view.ViewConfiguration
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // 保持 targetSdk 35 默认 edge-to-edge：WebView 不随软键盘收缩，visualViewport 如实反映
        // 键盘高度（innerHeight 不变、vv.height 缩小），由网页 COMMON_JS 据 vv 把弹窗几何对齐到
        // 键盘上方。不能用 setDecorFitsSystemWindows(true)/adjustResize——那会让 WebView 整体收缩、
        // innerHeight 同步变小，visualViewport 算不出键盘高度(kb=0)，网页避让反而失效。
        val deepUrl = intent?.getStringExtra(Keys.Url.name)
        setContent {
            MaterialTheme(
                colorScheme = if (isNight()) darkColorScheme() else lightColorScheme()
            ) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    AppShell(initialUrl = deepUrl)
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // 小组件深链：再次点入时加载指定 URL（AppShell 通过全局事件接收）
        intent.getStringExtra(Keys.Url.name)?.let { DeepLinkBus.emit(it) }
    }

    private fun isNight(): Boolean =
        resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK ==
            android.content.res.Configuration.UI_MODE_NIGHT_YES
}

/** 跨 onNewIntent 的简单深链总线。 */
object DeepLinkBus {
    var listener: ((String) -> Unit)? = null
    fun emit(url: String) { listener?.invoke(url) }
}

private data class Tab(val label: String, val emoji: String, val path: String?)

private val TABS = listOf(
    Tab("待办", "📝", "/todo"),
    Tab("基金", "📈", "/fund"),
    Tab("体重", "⚖️", "/weight"),
    Tab("资产", "💰", "/asset"),
    Tab("我的", "👤", null)
)

// 标记原生壳：每次 loadUrl 都带此头，服务端据此隐藏顶部网站导航（cookie 因 setCookie 异步有竞态，用头保证当次请求立即生效）
private val APP_HEADERS = mapOf("X-App-Shell" to "1")

/** 深链 URL → 对应底部 Tab 下标（按路径前缀匹配），默认 0（待办）。 */
private fun tabIndexFor(url: String?): Int {
    val path = url?.let { runCatching { Uri.parse(it).path }.getOrNull() } ?: return 0
    val idx = TABS.indexOfFirst { it.path != null && (path == it.path || path.startsWith(it.path + "/")) }
    return if (idx >= 0) idx else 0
}

@SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
@Composable
private fun AppShell(initialUrl: String?) {
    val context = androidx.compose.ui.platform.LocalContext.current
    var baseUrl by remember { mutableStateOf(AppConfig.getBaseUrl(context)) }
    var selected by rememberSaveable { mutableStateOf(tabIndexFor(initialUrl)) }
    var showMe by rememberSaveable { mutableStateOf(false) }
    var targetUrl by rememberSaveable { mutableStateOf(initialUrl ?: (baseUrl + TABS[0].path)) }
    var webViewRef by remember { mutableStateOf<WebView?>(null) }
    // 最近一次实际 loadUrl 的地址（自己维护，不用 wv.url——网页 replaceState 清深链参数后
    // wv.url 不可靠）。深链即使与目标相同也要强制重载，保证 ?edit/?addChild 弹窗每次都重跑。
    var lastLoadedUrl by remember { mutableStateOf<String?>(null) }
    // WebViewClient 只在 factory 创建一次，用 rememberUpdatedState 让它始终读到最新 baseUrl
    val currentBaseUrl by rememberUpdatedState(baseUrl)

    // WebView <input type=file> 选择回调（待办附件上传）：网页发起文件选择 → 系统选择器 → 回传 Uri
    var filePathCallback by remember { mutableStateOf<android.webkit.ValueCallback<Array<Uri>>?>(null) }
    val fileChooserLauncher = rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val cb = filePathCallback
        filePathCallback = null
        cb?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data))
    }

    // 软键盘高度（CSS px）：edge-to-edge 下 WebView 不随键盘收缩，且实测该 WebView 的
    // visualViewport 不反映键盘（vv.height≈innerHeight，网页算不出键盘高）。改由原生
    // WindowInsets.ime 实测键盘高，注入网页 CSS 变量 --kb-native，网页据此把弹窗/输入框抬到键盘上方。
    var kbCss by remember { mutableStateOf(0f) }
    val currentKbCss by rememberUpdatedState(kbCss)
    val density = LocalDensity.current
    val imeBottomPx = WindowInsets.ime.getBottom(density)
    LaunchedEffect(imeBottomPx) {
        kbCss = imeBottomPx / density.density
        // 注入键盘高度并通知网页：切换 .kb-on（弹窗靠顶）+ 把当前聚焦框滚到键盘上方
        webViewRef?.evaluateJavascript(
            "document.documentElement.style.setProperty('--kb-native','${kbCss}px');" +
                "window.__onKb&&window.__onKb();",
            null
        )
    }

    // 小组件再次点入的深链：同步选中对应底部 Tab（待办/基金/体重/资产）
    androidx.compose.runtime.DisposableEffect(Unit) {
        DeepLinkBus.listener = { url ->
            targetUrl = url
            selected = tabIndexFor(url)
            showMe = false
            // 强制重新加载：同一深链 URL 第二次点入也要重跑网页 init（?edit/?addChild 弹窗）。
            // wv.url 在 replaceState 清参后不可靠，直接 loadUrl；加时间戳 nonce 保证同 URL 也必重载，
            // 页面只认 root/edit/addChild 参数、replaceState(pathname) 会把 nonce 一起清掉。
            webViewRef?.let { wv ->
                CookieManager.getInstance().setCookie(baseUrl, "app_shell=1; Path=/")
                val sep = if (url.contains('?')) '&' else '?'
                wv.loadUrl("$url${sep}_t=${System.currentTimeMillis()}", APP_HEADERS)
                lastLoadedUrl = url // 记逻辑 URL（不含 nonce），供 update 去重
            }
        }
        onDispose { DeepLinkBus.listener = null }
    }

    fun openPath(path: String) {
        targetUrl = baseUrl + path
        showMe = false
    }

    // App 内禁用网页返回：网页内跳转不与底部 Tab 同步，goBack 会造成画面与 Tab 错位。
    // 「我的」原生面板打开时，返回键仅关闭面板回到网页。
    BackHandler(enabled = true) {
        if (showMe) showMe = false
    }

    Scaffold(
        bottomBar = {
            NavigationBar {
                TABS.forEachIndexed { i, tab ->
                    NavigationBarItem(
                        selected = if (tab.path == null) showMe else (!showMe && selected == i),
                        onClick = {
                            if (tab.path == null) {
                                showMe = true
                            } else {
                                selected = i
                                openPath(tab.path)
                            }
                        },
                        icon = { Text(tab.emoji) },
                        label = { Text(tab.label) }
                    )
                }
            }
        }
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            // WebView 始终存在（保留登录态/历史），仅在「我的」页隐藏
            AndroidView(
                factory = { ctx ->
                    // 先创建下拉刷新容器，WebView 的 WebViewClient 需要在页面加载完成时收起它的指示器
                    val swipe = SwipeRefreshLayout(ctx)
                    val wv = WebView(ctx).apply {
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        settings.databaseEnabled = true
                        settings.cacheMode = WebSettings.LOAD_DEFAULT
                        settings.loadWithOverviewMode = true
                        settings.useWideViewPort = true
                        settings.builtInZoomControls = false
                        settings.displayZoomControls = false
                        settings.mediaPlaybackRequiresUserGesture = false
                        CookieManager.getInstance().setAcceptCookie(true)
                        CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
                        // 标记原生壳环境：服务端据此隐藏顶部网站导航，底部由原生 Tab 提供导航
                        CookieManager.getInstance().setCookie(currentBaseUrl, "app_shell=1; Path=/")
                        setBackgroundColor(Color.TRANSPARENT)
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

                            override fun onPageFinished(view: WebView, url: String?) {
                                super.onPageFinished(view, url)
                                // 新页面 document 会重置 CSS 变量，重新注入当前键盘高度（--kb-native）并通知网页
                                view.evaluateJavascript(
                                    "document.documentElement.style.setProperty('--kb-native','${currentKbCss}px');" +
                                        "window.__onKb&&window.__onKb();",
                                    null
                                )
                                // 下拉刷新触发的 reload 完成后收起指示器
                                swipe.isRefreshing = false
                                // 同步登录会话给小组件：从 Cookie 取 sid（native 可读 HttpOnly Cookie）
                                val cookieUrl = url ?: currentBaseUrl
                                val cookies = CookieManager.getInstance().getCookie(cookieUrl) ?: ""
                                val sid = Regex("(?:^|;)\\s*sid=([^;]+)").find(cookies)?.groupValues?.get(1)
                                val oldSid = Prefs.getSid(context)
                                when {
                                    !sid.isNullOrBlank() && sid != oldSid -> {
                                        // 登录/会话变更：写入 sid
                                        Prefs.setSid(context, sid)
                                        // 登录成功后若停在登录页/dashboard 等非 Tab 页，自动切到待办 Tab
                                        val path = url?.let { Uri.parse(it).path } ?: ""
                                        val onTab = TABS.any { t ->
                                            t.path != null && (path == t.path || path.startsWith(t.path + "/"))
                                        }
                                        if (!onTab) {
                                            selected = 0
                                            showMe = false
                                            targetUrl = currentBaseUrl + "/todo"
                                        }
                                        // 立即直接拉取所有桌面小组件数据并刷新（WorkManager 一次性任务可能被系统延迟，
                                        // 这里进程内直连拉取保证登录后马上出数据；成功会清掉旧的 failed 标志）。
                                        // 与网页内待办变更后的 todoChanged 桥回调走同一入口（RefreshWorker.refreshAllNow）。
                                        RefreshWorker.refreshAllNow(context)
                                    }
                                    sid.isNullOrBlank() && oldSid.isNotBlank() -> {
                                        // 登出/会话失效：清除并刷新小组件
                                        Prefs.clearSid(context)
                                        kotlinx.coroutines.MainScope().launch(Dispatchers.IO) {
                                            withContext(Dispatchers.Main) { TodoAppWidget().updateAll(context) }
                                        }
                                    }
                                }
                            }
                        }
                        webChromeClient = object : WebChromeClient() {
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
                        addJavascriptInterface(object {
                            @JavascriptInterface
                            fun setPullRefresh(enable: Boolean) {
                                Handler(Looper.getMainLooper()).post { swipe.isEnabled = enable }
                            }

                            // 网页内待办增删改/勾选/排序后，网页 loadTodos 收尾经桥回调：
                            // 主线程防抖 800ms（拖拽排序等连续变更合并为一次）后直连刷新所有桌面
                            // 小组件，不等 15 分钟周期 Worker（WorkManager 一次性任务可能被系统延迟）。
                            private val widgetHandler = Handler(Looper.getMainLooper())
                            private val widgetRefresh = Runnable { RefreshWorker.refreshAllNow(ctx) }
                            @JavascriptInterface
                            fun todoChanged() {
                                widgetHandler.removeCallbacks(widgetRefresh)
                                widgetHandler.postDelayed(widgetRefresh, 800L)
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
                        loadUrl(targetUrl, APP_HEADERS)
                        lastLoadedUrl = targetUrl
                    }
                    // 下拉刷新：网页滚到顶部时下拉触发 reload，onPageFinished 收起指示器
                    swipe.addView(
                        wv,
                        ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                    )
                    swipe.setColorSchemeColors(0xFFA855F7.toInt())
                    swipe.setOnRefreshListener { wv.reload() }
                    webViewRef = wv
                    swipe
                },
                update = {
                    // 不能用 getChildAt(0)：SwipeRefreshLayout 内部自带一个 CircleImageView
                    // （下拉转圈 mCircleView）占住 index 0，WebView 在 index 1，强转会崩溃。
                    // 直接用 factory 中保存的 webViewRef。用 lastLoadedUrl 去重而非 wv.url：
                    // 深链页 replaceState 清参后 wv.url 不可靠，且相同深链由 DeepLinkBus 强制重载。
                    val wv = webViewRef
                    if (wv != null && targetUrl != lastLoadedUrl) {
                        CookieManager.getInstance().setCookie(baseUrl, "app_shell=1; Path=/")
                        wv.loadUrl(targetUrl, APP_HEADERS)
                        lastLoadedUrl = targetUrl
                    }
                },
                modifier = Modifier.fillMaxSize()
            )
            if (showMe) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    MeScreen(
                    baseUrl = baseUrl,
                    currentUrl = { webViewRef?.url ?: baseUrl },
                    onOpenPath = { path -> openPath(path) },
                    onChangeBaseUrl = { newUrl ->
                        AppConfig.setBaseUrl(context, newUrl)
                        CookieManager.getInstance().removeAllCookies(null)
                        Prefs.clearSid(context)
                        baseUrl = AppConfig.normalize(newUrl)
                        targetUrl = baseUrl + "/todo"
                        selected = 0
                        showMe = false
                        // 由 update 回调统一带 X-App-Shell 头 + 重写 app_shell cookie 后加载
                    },
                    onOpenInBrowser = {
                        // 免密桥接：系统浏览器与 WebView cookie 仓库独立，sid 带不过去；
                        // 走服务端 /auth/bridge 用当前会话换 cookie 后 302 到当前页（未登录则直接打开原 URL）
                        val sid = Prefs.getSid(context)
                        val url = if (sid.isNotBlank()) {
                            val path = runCatching { Uri.parse(webViewRef?.url ?: baseUrl).path }.getOrNull()
                            val to = if (!path.isNullOrBlank()) path else "/todo"
                            baseUrl + "/auth/bridge?sid=" + Uri.encode(sid) + "&to=" + Uri.encode(to)
                        } else {
                            webViewRef?.url ?: baseUrl
                        }
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    },
                    onThemeClick = {
                        // 主题三选一：网页 __applyTheme 统一切 data-theme 并 PUT 同步到账号；
                        // 原生 Prefs 仅记录本机最近选择，供对话框勾选
                        val keys = arrayOf("light", "dark", "eye")
                        val labels = arrayOf("浅色", "暗色", "护眼")
                        val checked = keys.indexOf(Prefs.getTheme(context)).coerceAtLeast(0)
                        android.app.AlertDialog.Builder(context)
                            .setTitle("主题外观")
                            .setSingleChoiceItems(labels, checked) { dlg, which ->
                                val t = keys[which]
                                Prefs.setTheme(context, t)
                                webViewRef?.evaluateJavascript(
                                    "window.__applyTheme && window.__applyTheme('$t', true);", null
                                )
                                dlg.dismiss()
                            }
                            .setNegativeButton("取消", null)
                            .show()
                    },
                    onLogout = {
                        CookieManager.getInstance().removeAllCookies(null)
                        Prefs.clearSid(context)
                        targetUrl = baseUrl + "/login"
                        showMe = false
                        webViewRef?.loadUrl(targetUrl)
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
