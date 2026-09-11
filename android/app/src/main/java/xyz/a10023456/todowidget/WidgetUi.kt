package xyz.a10023456.todowidget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.lazy.LazyColumn
import androidx.glance.appwidget.provideContent
import androidx.glance.ColorFilter
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.ColumnScope
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider

/**
 * 小组件配色：浅色/深色两套，由小组件设置里的主题手动选择（WidgetFrame.widgetTheme），
 * 不跟随系统深色。固定色用单参 ColorProvider（不随系统 uiMode 变化）。
 */
private class WColors(
    val text: ColorProvider,
    val sub: ColorProvider,
    val overdue: ColorProvider,
    val today: ColorProvider,
    val brand: ColorProvider
)
private val WLight = WColors(
    text = ColorProvider(Color(0xFF14141E)),
    // 次要文字（日期/面包屑/图标）：面板与卡片半透明时仍要可读
    sub = ColorProvider(Color(0xFF666E8F)),
    overdue = ColorProvider(Color(0xFFCF1322)),
    // 今日（进行中）：蓝，与逾期红组成状态色；浅 chip 底上用偏深蓝保证对比
    today = ColorProvider(Color(0xFF2563EB)),
    brand = ColorProvider(Color(0xFFA855F7))
)
private val WDark = WColors(
    text = ColorProvider(Color(0xFFF2F1F7)),
    sub = ColorProvider(Color(0xFFB6B0CC)),
    overdue = ColorProvider(Color(0xFFFF6B6B)),
    today = ColorProvider(Color(0xFF60A5FA)),
    brand = ColorProvider(Color(0xFFA855F7))
)

/** 按小组件主题取配色（dark=true 深色）。 */
private fun W(dark: Boolean): WColors = if (dark) WDark else WLight

/** 点击进入 App 的目标地址：登录态走 /todo，未登录且有 token 时走免密报告页 /tr/:token。 */
private fun openUrlOf(ctx: Context, baseUrl: String, token: String): String =
    if (Prefs.isLoggedIn(ctx) || token.isBlank()) "$baseUrl/todo" else "$baseUrl/tr/$token"

/** 点击「新增」：跳到 App 待办页并由网页识别 ?add=1 自动弹出新建表单。 */
private fun addUrlOf(ctx: Context, baseUrl: String, token: String): String =
    openUrlOf(ctx, baseUrl, token) + "?add=1"

/**
 * 主任务行「＋」添加子任务：先进该主任务的子任务详情（?root），再在详情上弹添加表单（?addChild）。
 * 登录态 /todo，未登录 /tr/:token。
 */
private fun addChildUrlOf(ctx: Context, baseUrl: String, token: String, rootId: Long): String =
    if (Prefs.isLoggedIn(ctx) || token.isBlank()) "$baseUrl/todo?root=$rootId&addChild=$rootId"
    else "$baseUrl/tr/$token?root=$rootId&addChild=$rootId"

/** 点主任务行：跳 App 进该主任务的子任务详情（等同网页卡片视图点主任务进入的画面），网页识别 ?root=<id>；未登录回退免密报告页同参。 */
private fun rootDetailUrlOf(ctx: Context, baseUrl: String, token: String, rootId: Long): String =
    if (Prefs.isLoggedIn(ctx) || token.isBlank()) "$baseUrl/todo?root=$rootId"
    else "$baseUrl/tr/$token?root=$rootId"

/** 点子任务行：先进所属主任务详情（?root），再在详情上弹该子任务的查看视图（?edit，网页端详情内可再进编辑）。 */
private fun editUrlOf(ctx: Context, baseUrl: String, token: String, itemId: Long, rootId: Long): String =
    if (Prefs.isLoggedIn(ctx) || token.isBlank()) "$baseUrl/todo?root=$rootId&edit=$itemId"
    else "$baseUrl/tr/$token?root=$rootId&edit=$itemId"

/** 小组件渲染入口。 */
class TodoAppWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val appWidgetId = id.resolveAppWidgetId(context)
        android.util.Log.d("TodoWidget", "provideGlance: widget=$appWidgetId（新 session 组合开始）")
        // 先从 SP 重读一帧：Prefs.getUiState 的 6s 惰性过期借此立即生效——session 超时重建时
        // 进程级 StateFlow 可能还留着 loading/done 旧帧，不重读就会沿用过期遮罩。
        WidgetStateStore.publish(context, appWidgetId)
        // 初始化自动刷新：新 session 组合（新组件、开机/进程重启后重建）时，若已配置且
        // 无缓存或缓存超过刷新周期（RefreshWorker 15 分钟）未更新，静默拉取一次（不弹遮罩）。
        maybeAutoRefresh(context, appWidgetId)
        provideContent {
            // 订阅进程级状态流：动作/Worker/Repo 调 WidgetStateStore.publish 写入 StateFlow，
            // 直接驱动存活 session 的内容重组（Compose 原生机制）。不再依赖 Glance update()
            // 对存活 session 发的会话事件--真机日志已证明该事件不触发重组（遮罩/结果提示
            // 全部不上屏）。嵌套的 SP 读取（token/baseUrl 等）随整体重组一并拿到最新值；
            // session 死亡后的重建由各处的 update() 兜底（新组合从 SP 读初值）。
            val frame by WidgetStateStore.observe(context, appWidgetId).collectAsState()
            android.util.Log.d(
                "TodoWidget",
                "compose: widget=$appWidgetId ui=(${frame.uiState},${frame.uiMsg}) " +
                    "data=${frame.data != null} ready=${frame.ready}"
            )
            WidgetRoot(
                ready = frame.ready,
                data = frame.data,
                failed = frame.failed,
                widgetId = appWidgetId,
                collapsed = frame.collapsed,
                overlayState = frame.uiState,
                overlayMsg = frame.uiMsg,
                opacity = frame.opacity,
                fontScale = frame.fontScale,
                wrapChild = frame.wrapChild,
                simpleMode = frame.simpleMode,
                dark = frame.widgetTheme == "dark",
                failedMsg = frame.failedMsg
            )
        }
    }
}

/** 初始化自动刷新的缓存过期阈值：对齐 RefreshWorker 周期（15 分钟）。 */
private const val AUTO_REFRESH_STALE_MS = 15L * 60 * 1000

/** 已配置但无缓存或缓存过期时，入队一次静默刷新 Worker（失败不弹遮罩）。 */
private fun maybeAutoRefresh(context: Context, appWidgetId: Int) {
    if (appWidgetId < 0) return
    val ready = Prefs.isLoggedIn(context) || Prefs.isConfigured(context, appWidgetId)
    if (!ready) return
    val updated = Prefs.getLastUpdated(context, appWidgetId)
    val stale = Prefs.getCache(context, appWidgetId) == null ||
        System.currentTimeMillis() - updated > AUTO_REFRESH_STALE_MS
    if (stale) {
        android.util.Log.d("TodoWidget", "auto refresh enqueued: widget=$appWidgetId, updated=$updated")
        WidgetActionWorker.enqueue(
            context, appWidgetId, WidgetActionWorker.ACTION_REFRESH, silent = true
        )
    }
}

/** 字号档位（Prefs.getFontScale）→ 缩放系数：0=小 1=中 2=大 */
private fun fontFactor(scale: Int): Float = when (scale) {
    0 -> 0.88f
    2 -> 1.15f
    else -> 1f
}

/** 按档位缩放后的字号（sp）。 */
private fun fs(scale: Int, baseSp: Int) = (baseSp * fontFactor(scale)).sp

/**
 * 内容区底色（中性浅灰，对齐微软 To Do 风格：灰底衬白卡片）：标题栏之下、卡片之外的
 * 区域，卡片间缝隙也露出这个颜色。纯色 background（setBackgroundColor）全版本稳定；
 * cornerRadius 仅 API31+ 生效（低版本直角降级）。
 *
 * 灰底比卡片/标题栏更透：最终 alpha = (不透明度/100) × PANEL_ALPHA_SCALE。
 * 倍率调小=更透（卡片缝隙透出更多壁纸），调到 1f=与卡片一样全实；卡片仍跟随滑块实底。
 */
private const val PANEL_ALPHA_SCALE = 0.9f

private fun panelBgColor(opacity: Int, dark: Boolean): ColorProvider =
    ColorProvider(
        (if (dark) Color(0xFF1C1C1E) else Color(0xFFEDEDED))
            .copy(alpha = (opacity / 100f) * PANEL_ALPHA_SCALE)
    )

/** 标题行底色：浅色=近白、深色=次级深灰，比内容区亮一档（与卡片同色系）。 */
private fun headerBgColor(opacity: Int, dark: Boolean): ColorProvider =
    ColorProvider(
        (if (dark) Color(0xFF2C2C2E) else Color(0xFFF5F5F5)).copy(alpha = opacity / 100f)
    )

/**
 * 卡片底色：浅色=纯白、深色=三级深灰，为最亮一档，与中性灰内容区拉开层次；
 * alpha 随不透明度设置（半透明时卡片仍比内容区亮，层次感保留）。
 */
private fun cardBgColor(opacity: Int, dark: Boolean): ColorProvider =
    ColorProvider(
        (if (dark) Color(0xFF38383A) else Color(0xFFFFFFFF)).copy(alpha = opacity / 100f)
    )

/** 卡片之间的垂直间距（dp）：调大更疏朗、调小更紧凑；分组卡片与简洁列表共用。 */
private val CARD_GAP = 5.dp

/** 卡片圆角半径（dp）。 */
private val CARD_RADIUS = 12.dp

/**
 * 一张圆角分组卡片的容器：卡片列自带底色/圆角/内边距。
 * 注意：Glance 的 padding 翻译成 View.setPadding，背景会铺满 padding 区，
 * 所以卡片间距不能用 padding，由调用方在卡片外放透明 Spacer。
 * 寸土寸金：上下内边距收紧（标题距顶 8dp、末行距底 6dp）。
 */
@Composable
private fun CardScaffold(opacity: Int, dark: Boolean, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = GlanceModifier
            .fillMaxWidth()
            .background(cardBgColor(opacity, dark))
            .cornerRadius(CARD_RADIUS)
            .padding(start = 12.dp, end = 12.dp, top = 6.dp, bottom = 3.dp),
        content = content
    )
}

@Composable
private fun WidgetRoot(
    ready: Boolean,
    data: WidgetResponse?,
    failed: Boolean,
    widgetId: Int,
    collapsed: Set<Long>,
    overlayState: String,
    overlayMsg: String,
    opacity: Int,
    fontScale: Int,
    wrapChild: Boolean,
    simpleMode: Boolean,
    dark: Boolean,
    failedMsg: String
) {
    Box(
        modifier = GlanceModifier
            .fillMaxSize()
            // 浅灰内容区面板（背景铺满整个小组件，S+ 圆角裁剪；标题条贴顶满宽在其之上）；
            // opacity/fontScale 随 WidgetStateStore 帧驱动重组，设置面板拖动即实时预览。
            .background(panelBgColor(opacity, dark))
            .cornerRadius(22.dp),
        contentAlignment = Alignment.TopStart
    ) {
        if (!ready) {
            NotReady(fontScale, dark)
        } else {
            WidgetBody(data, failed, widgetId, collapsed, opacity, fontScale, wrapChild, simpleMode, dark, failedMsg)
        }
        if (overlayState != "idle") WidgetOverlay(overlayState, overlayMsg, fontScale)
    }
}

/** 点击处理中的遮罩：半透明覆盖层拦截误触，居中显示状态图标 + 文案。 */
@Composable
private fun WidgetOverlay(state: String, msg: String, fontScale: Int) {
    val (emoji, bg) = when (state) {
        "loading" -> "⏳" to Color(0x9914141E)
        "error" -> "❌" to Color(0xDD14141E)
        else -> "🎉" to Color(0xDD14141E)
    }
    Box(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(ColorProvider(bg))
            .cornerRadius(22.dp)
            .clickable(actionRunCallback<NoopAction>()),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(emoji, style = TextStyle(fontSize = fs(fontScale, 30)))
            Spacer(GlanceModifier.height(8.dp))
            Text(
                msg,
                style = TextStyle(
                    color = ColorProvider(Color.White),
                    fontSize = fs(fontScale, 13),
                    fontWeight = FontWeight.Medium
                )
            )
        }
    }
}

@Composable
private fun NotReady(fontScale: Int, dark: Boolean) {
    Column(
        modifier = GlanceModifier.fillMaxSize().padding(16.dp).clickable(
            actionStartActivity<MainActivity>()
        ),
        verticalAlignment = Alignment.CenterVertically,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("📝", style = TextStyle(fontSize = 22.sp))
        Spacer(GlanceModifier.height(6.dp))
        Text(
            "打开 App 登录后显示待办",
            style = TextStyle(color = W(dark).brand, fontWeight = FontWeight.Medium, fontSize = fs(fontScale, 13))
        )
    }
}

@Composable
private fun WidgetBody(
    data: WidgetResponse?,
    failed: Boolean,
    widgetId: Int,
    collapsed: Set<Long>,
    opacity: Int,
    fontScale: Int,
    wrapChild: Boolean,
    simpleMode: Boolean,
    dark: Boolean,
    failedMsg: String
) {
    Column(modifier = GlanceModifier.fillMaxSize()) {
        // 标题行：自带深灰白条背景，贴面板顶部满宽（S+ 被面板圆角裁剪顶边两角）
        Header(data, widgetId, opacity, fontScale, dark)
        // 内容区：浅灰底（根 Box 面板色），卡片在其内；底部留白由末张卡片后的 Spacer 提供
        Column(
            modifier = GlanceModifier.fillMaxWidth().defaultWeight()
                .padding(start = 10.dp, end = 10.dp, top = 8.dp)
        ) {
            if (failed) {
                // 差异化失败原因：登录失效/服务器异常/网络不通等（friendlyErrorMsg 映射），
                // 有缓存时由下方列表继续展示上次数据
                Text(
                    "⚠️ ${friendlyErrorMsg(failedMsg)}",
                    style = TextStyle(color = W(dark).overdue, fontSize = fs(fontScale, 11)),
                    maxLines = 2
                )
                Spacer(GlanceModifier.height(2.dp))
            }
            val groups = data?.groups.orEmpty()
            if (groups.isEmpty()) {
                CardScaffold(opacity, dark) {
                    Box(
                        modifier = GlanceModifier.fillMaxWidth().padding(vertical = 14.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        // 从未拉取成功（无缓存）时失败不能伪装成"没有待办"
                        Text(
                            if (failed) "⚠️ 连接失败，暂无缓存数据，将自动重试" else "🎉 当前范围没有待办",
                            style = TextStyle(
                                color = if (failed) W(dark).overdue else W(dark).sub,
                                fontSize = fs(fontScale, 13)
                            )
                        )
                    }
                }
            } else {
                LazyColumn(modifier = GlanceModifier.fillMaxWidth().defaultWeight()) {
                    if (simpleMode) {
                        // 简洁模式：不按任务组分组，每个子任务（含无子任务主任务的回退行）
                        // 一张独立卡片、卡片间 8dp 缝隙（与分组模式一致），无分组标题/折叠/＋按钮。
                        // 每项带稳定 itemId（todo 全局 id），保证模式切换时 ListView 数据集可靠刷新。
                        groups.forEach { g ->
                            g.children.forEach { child ->
                                item(itemId = child.id) {
                                    // 卡片外的透明 Spacer 才是真缝隙（padding 会被卡片背景铺满）
                                    Column {
                                        CardScaffold(opacity, dark) {
                                            ChildRow(child, widgetId, fontScale, wrapChild, g.id, dark)
                                        }
                                        Spacer(GlanceModifier.height(CARD_GAP))
                                    }
                                }
                            }
                        }
                    } else {
                        groups.forEach { g ->
                            item(itemId = g.id) {
                                // 卡片外的透明 Spacer 才是真缝隙（padding 会被卡片背景铺满）
                                Column {
                                    GroupCard(g, widgetId, collapsed.contains(g.id), opacity, fontScale, wrapChild, dark)
                                    Spacer(GlanceModifier.height(CARD_GAP))
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * 分组卡片：一个主任务（顶层清单）一张圆角卡片。
 * 标题行恒为分组标题（主任务名）；下方列出子任务位的叶子任务行。
 * 单主任务（无子任务，后端回退项 id == 分组 id，collapsible=false）：不折叠，
 * 主任务自身作为唯一一行可勾选任务显示在子任务位（分组标题 + 缩进勾选行的层级）。
 */
@Composable
private fun GroupCard(
    g: WidgetGroup,
    widgetId: Int,
    isCollapsed: Boolean,
    opacity: Int,
    fontScale: Int,
    wrapChild: Boolean,
    dark: Boolean
) {
    CardScaffold(opacity, dark) {
        GroupTitleRow(g, widgetId, isCollapsed, fontScale, dark)
        // 仅多任务分组可折叠；折叠时隐藏子行。单主任务组恒显示其唯一子行（主任务自身）。
        if (g.collapsible && isCollapsed) return@CardScaffold
        g.children.forEach { child -> ChildRow(child, widgetId, fontScale, wrapChild, g.id, dark) }
    }
}

/**
 * 卡片标题行：分组名（主任务名）粗体。整行点击 = 跳 App 进该主任务子任务详情（等同网页卡片点主任务）；
 * 仅 ▼/▶ 箭头点击 = 折叠/展开（CollapseAction）；右侧「＋」= 添加子任务。子 View 点击优先于整行。
 */
@Composable
private fun GroupTitleRow(g: WidgetGroup, widgetId: Int, isCollapsed: Boolean, fontScale: Int, dark: Boolean) {
    val w = W(dark)
    val solo = !g.collapsible && g.children.firstOrNull()?.id == g.id
    val ctx = androidx.glance.LocalContext.current
    val baseUrl = Prefs.getBaseUrl(ctx, widgetId)
    val token = Prefs.getToken(ctx, widgetId)
    // 整行进 App 主任务详情；「＋」快速添加子任务（跳 App 深链，网页识别 root/addChild）
    val detailUrl = rootDetailUrlOf(ctx, baseUrl, token, g.id)
    val addChildUrl = addChildUrlOf(ctx, baseUrl, token, g.id)
    val rowModifier = GlanceModifier.fillMaxWidth().padding(vertical = 2.dp).clickable(
        actionStartActivity<MainActivity>(actionParametersOf(Keys.Url to detailUrl))
    )
    Row(modifier = rowModifier, verticalAlignment = Alignment.CenterVertically) {
        if (!solo) {
            // 箭头单独折叠/展开（子 View 点击优先，不触发行的进详情）；加 padding 扩大触点
            Text(
                if (g.collapsible) (if (isCollapsed) "▶ " else "▼ ") else "• ",
                style = TextStyle(color = w.sub, fontSize = fs(fontScale, 11)),
                modifier = GlanceModifier.padding(horizontal = 2.dp).clickable(
                    actionRunCallback<CollapseAction>(
                        actionParametersOf(
                            Keys.AppWidgetId to widgetId,
                            Keys.RootId to g.id
                        )
                    )
                )
            )
            Spacer(GlanceModifier.width(2.dp))
        }
        Text(
            g.title,
            style = TextStyle(fontWeight = FontWeight.Bold, fontSize = fs(fontScale, 13), color = w.text),
            maxLines = 1,
            modifier = GlanceModifier.defaultWeight()
        )
        if (g.recurring) {
            Spacer(GlanceModifier.width(6.dp))
            Text("🔁", style = TextStyle(fontSize = fs(fontScale, 11)))
        }
        if (g.due_label.isNotBlank()) {
            Spacer(GlanceModifier.width(6.dp))
            Text(
                g.due_label,
                style = TextStyle(
                    fontSize = fs(fontScale, 11),
                    color = if (g.overdue) w.overdue else w.sub
                ),
                maxLines = 1
            )
        }
        // 「＋」添加子任务：独立点击区，折叠组整行的折叠 clickable 不影响此按钮（子 View 点击优先）
        Spacer(GlanceModifier.width(8.dp))
        Text(
            "＋",
            style = TextStyle(fontSize = fs(fontScale, 15), color = w.brand, fontWeight = FontWeight.Bold),
            modifier = GlanceModifier.clickable(
                actionStartActivity<MainActivity>(actionParametersOf(Keys.Url to addChildUrl))
            )
        )
    }
}

/** 圆形勾选框（外层品牌圆 + 内层表面圆 = 环形），点击 → 完成。内心色随主题（=卡片色）。 */
@Composable
private fun CheckCircle(widgetId: Int, itemId: Long, dark: Boolean) {
    Box(
        modifier = GlanceModifier
            .size(22.dp)
            .background(imageProvider = ImageProvider(R.drawable.bg_circle_brand))
            .clickable(
                actionRunCallback<CompleteAction>(
                    actionParametersOf(
                        Keys.AppWidgetId to widgetId,
                        Keys.ItemId to itemId
                    )
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        Box(
            modifier = GlanceModifier.size(18.dp)
                .background(imageProvider = ImageProvider(
                    if (dark) R.drawable.bg_circle_surface_dark else R.drawable.bg_circle_surface
                ))
        ) {}
    }
}

/**
 * 标题行：深灰白底条，贴面板顶部满宽。左侧标题+统计（点击进 App），
 * 右侧收纳 ↻ 刷新 / ＋ 新增 / ⚙️ 设置三个动作（原底栏已删除，寸土寸金）。
 */
@Composable
private fun Header(data: WidgetResponse?, widgetId: Int, opacity: Int, fontScale: Int, dark: Boolean) {
    val w = W(dark)
    val ctx = androidx.glance.LocalContext.current
    val token = Prefs.getToken(ctx, widgetId)
    val baseUrl = Prefs.getBaseUrl(ctx, widgetId)
    val openUrl = openUrlOf(ctx, baseUrl, token)
    val addUrl = addUrlOf(ctx, baseUrl, token)
    Row(
        modifier = GlanceModifier.fillMaxWidth()
            .background(headerBgColor(opacity, dark))
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            modifier = GlanceModifier.defaultWeight().clickable(
                actionStartActivity<MainActivity>(actionParametersOf(Keys.Url to openUrl))
            ),
            verticalAlignment = Alignment.CenterVertically,
            horizontalAlignment = Alignment.Start
        ) {
            Text(
                "📝 待办",
                style = TextStyle(fontWeight = FontWeight.Bold, fontSize = fs(fontScale, 14), color = w.text)
            )
            // 统计胶囊: 今日 | 逾期 同处一个胶囊; 两者都为 0 时不渲染
            if (data != null && (data.stats.today > 0 || data.stats.overdue > 0)) {
                Spacer(GlanceModifier.width(6.dp))
                TodayOverdueChip(data.stats.today, data.stats.overdue, fontScale, dark)
            }
        }
        Spacer(GlanceModifier.width(6.dp))
        Text(
            "↻",
            style = TextStyle(fontSize = fs(fontScale, 16), color = w.brand, fontWeight = FontWeight.Bold),
            modifier = GlanceModifier.clickable(
                actionRunCallback<RefreshAction>(
                    actionParametersOf(Keys.AppWidgetId to widgetId)
                )
            )
        )
        Spacer(GlanceModifier.width(12.dp))
        Text(
            "＋",
            style = TextStyle(fontSize = fs(fontScale, 17), color = w.brand, fontWeight = FontWeight.Bold),
            modifier = GlanceModifier.clickable(
                actionStartActivity<MainActivity>(actionParametersOf(Keys.Url to addUrl))
            )
        )
        Spacer(GlanceModifier.width(12.dp))
        Text(
            "⚙️",
            style = TextStyle(fontSize = fs(fontScale, 14), color = w.sub),
            modifier = GlanceModifier.clickable(
                actionStartActivity<ConfigActivity>(
                    actionParametersOf(Keys.AppWidgetId to widgetId)
                )
            )
        )
    }
}

/** 胶囊内 13dp 单色小图标（vector 白底 + tint 着色，深浅色背景均跟随） */
@Composable
private fun ChipIcon(resId: Int, color: ColorProvider) {
    Image(
        provider = ImageProvider(resId),
        contentDescription = null,
        colorFilter = ColorFilter.tint(color),
        modifier = GlanceModifier.size(13.dp)
    )
}

/**
 * 标题栏统计胶囊（单胶囊，今日与逾期拆开显示）：
 *   今日>0 且逾期>0 → [日历]3 | [闹钟]1（今日蓝=进行中，竖线灰，逾期图标与数字红）
 *   仅今日         → [日历]3（蓝色）
 *   仅逾期（全逾期）→ [闹钟]2（图标数字整体红色）
 *   两者都为 0     → 调用方不渲染本胶囊
 */
@Composable
private fun TodayOverdueChip(today: Int, overdue: Int, fontScale: Int, dark: Boolean) {
    val w = W(dark)
    Box(
        modifier = GlanceModifier
            .background(imageProvider = ImageProvider(
                if (dark) R.drawable.bg_chip_dark else R.drawable.bg_chip
            ))
            .padding(horizontal = 7.dp, vertical = 2.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            when {
                today > 0 && overdue > 0 -> {
                    ChipIcon(R.drawable.ic_chip_today, w.today)
                    Spacer(GlanceModifier.width(4.dp))
                    Text(today.toString(), style = TextStyle(color = w.today, fontWeight = FontWeight.Bold, fontSize = fs(fontScale, 12)))
                    Spacer(GlanceModifier.width(5.dp))
                    Text("|", style = TextStyle(color = w.sub, fontSize = fs(fontScale, 12)))
                    Spacer(GlanceModifier.width(5.dp))
                    ChipIcon(R.drawable.ic_chip_overdue, w.overdue)
                    Spacer(GlanceModifier.width(3.dp))
                    Text(overdue.toString(), style = TextStyle(color = w.overdue, fontWeight = FontWeight.Bold, fontSize = fs(fontScale, 12)))
                }
                today > 0 -> {
                    ChipIcon(R.drawable.ic_chip_today, w.today)
                    Spacer(GlanceModifier.width(4.dp))
                    Text(today.toString(), style = TextStyle(color = w.today, fontWeight = FontWeight.Bold, fontSize = fs(fontScale, 12)))
                }
                else -> {
                    ChipIcon(R.drawable.ic_chip_overdue, w.overdue)
                    Spacer(GlanceModifier.width(4.dp))
                    Text(overdue.toString(), style = TextStyle(color = w.overdue, fontWeight = FontWeight.Bold, fontSize = fs(fontScale, 12)))
                }
            }
        }
    }
}

@Composable
private fun ChildRow(child: WidgetItem, widgetId: Int, fontScale: Int, wrapChild: Boolean, rootId: Long, dark: Boolean) {
    val w = W(dark)
    val ctx = androidx.glance.LocalContext.current
    val token = Prefs.getToken(ctx, widgetId)
    val baseUrl = Prefs.getBaseUrl(ctx, widgetId)
    val editUrl = editUrlOf(ctx, baseUrl, token, child.id, rootId)
    Row(
        modifier = GlanceModifier.fillMaxWidth().padding(start = 6.dp, top = 3.dp, bottom = 3.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        CheckCircle(widgetId, child.id, dark)
        Spacer(GlanceModifier.width(8.dp))
        Column(modifier = GlanceModifier.defaultWeight().clickable(
            actionStartActivity<MainActivity>(actionParametersOf(Keys.Url to editUrl))
        )) {
            if (child.path.isNotEmpty()) {
                Text(
                    child.path.joinToString(" → "),
                    style = TextStyle(color = w.sub, fontSize = fs(fontScale, 10)),
                    maxLines = 1
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    child.title,
                    style = TextStyle(fontSize = fs(fontScale, 13), color = w.text),
                    // 子任务显示模式：默认单行省略（maxLines=1）；选"完整换行"给具体大值 50。
                    // 不能用 Int.MAX_VALUE——Glance 对默认值(MAX_VALUE)不发射 setMaxLines，
                    // 而 LazyColumn→ListView 的 item TextView 被复用会保留旧 maxLines=1，导致切不换行。
                    maxLines = if (wrapChild) 50 else 1,
                    modifier = GlanceModifier.defaultWeight()
                )
                // 日期徽章: 新模式(child_due)子任务自带截止日期; 旧后端不下发时为空串不显示, 逾期标红
                if (child.due_label.isNotBlank()) {
                    Spacer(GlanceModifier.width(6.dp))
                    Text(
                        child.due_label,
                        style = TextStyle(
                            fontSize = fs(fontScale, 11),
                            color = if (child.overdue) w.overdue else w.sub
                        ),
                        maxLines = 1
                    )
                }
            }
        }
    }
}

/** 共享的 ActionParameters 键。 */
object Keys {
    val AppWidgetId = ActionParameters.Key<Int>("appWidgetId")
    val ItemId = ActionParameters.Key<Long>("itemId")
    val RootId = ActionParameters.Key<Long>("rootId")
    val Url = ActionParameters.Key<String>("extra_url")
}
