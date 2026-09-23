package xyz.a10023456.todowidget

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.util.concurrent.ConcurrentHashMap

/**
 * 小组件渲染状态的进程级可观察存储：每个 appWidgetId 一个 [StateFlow]，组合内用
 * collectAsState 订阅，任何线程写入（StateFlow.value）都会驱动存活 session 的内容重组。
 *
 * 架构背景（2026-08-27 重构）：此前内容 lambda 直接读 SharedPreferences、依赖 Glance
 * update() 对存活 session 发的 UpdateGlanceState 事件（glanceState -> LocalState）触发重组，
 * 真机日志证明该转发链不生效（45s 窗口内多次 update() 均未重组，遮罩/结果提示全部不上屏），
 * 且已连修三轮未根治。现改为 Compose 原生可观察状态：StateFlow 写入 -> collectAsState 的
 * produceState 快照写入 -> Recomposer 重组（Glance 自身的 AppWidgetSession 也用同一机制），
 * 不再依赖 glance 会话事件；SP 仍是唯一持久层，[publish] 每次从 SP 全量重读。
 */
object WidgetStateStore {

    /** 单个小组件的渲染帧。data class 相等性保证 StateFlow 只在内容真实变化时发射。 */
    data class WidgetFrame(
        val ready: Boolean,
        val data: WidgetResponse?,
        val failed: Boolean,
        val collapsed: Set<Long>,
        val uiState: String, // idle | loading | done | error
        val uiMsg: String,
        val updated: Long,
        val opacity: Int, // 背景不透明度 0-100
        val fontScale: Int, // 字号档位 0=小 1=中 2=大
        val wrapChild: Boolean, // 子任务标题：false=单行省略（默认），true=过长换行完整显示
        val simpleMode: Boolean, // 显示模式：false=分组卡片（默认），true=简洁列表（每任务一张卡片）
        val widgetTheme: String, // 小组件主题："light"（默认）| "dark"，手动切换不跟随系统
        val failedMsg: String // 最近一次拉取失败的原始错误信息（空串表示无失败）
    )

    private val flows = ConcurrentHashMap<Int, MutableStateFlow<WidgetFrame>>()

    /** 取（不存在则从 SP 初始化）某小组件的状态流，供组合订阅。 */
    fun observe(context: Context, widgetId: Int): StateFlow<WidgetFrame> =
        flows.getOrPut(widgetId) { MutableStateFlow(readFrame(context, widgetId)) }

    /** 从 SP 全量重读并发布。任何写 SP 的代码路径之后调用，驱动存活 session 重组。 */
    fun publish(context: Context, widgetId: Int) {
        flows.getOrPut(widgetId) { MutableStateFlow(readFrame(context, widgetId)) }
            .value = readFrame(context, widgetId)
    }

    /** 删除小组件时清掉其进程级状态流（含持有的缓存数据），防止反复增删造成积累。 */
    fun remove(widgetId: Int) {
        flows.remove(widgetId)
    }

    /** 遮罩/结果状态：写 SP（进程死亡兜底）+ 发布到流（驱动重组）。 */
    fun setUiState(context: Context, widgetId: Int, state: String, msg: String) {
        Prefs.setUiState(context, widgetId, state, msg)
        publish(context, widgetId)
    }

    private fun readFrame(context: Context, widgetId: Int): WidgetFrame {
        val (state, msg) = Prefs.getUiState(context, widgetId)
        return WidgetFrame(
            ready = Prefs.isLoggedIn(context) || Prefs.isConfigured(context, widgetId),
            data = WidgetRepo.cached(context, widgetId),
            failed = Prefs.isFailed(context, widgetId),
            collapsed = Prefs.getCollapsedIds(context, widgetId),
            uiState = state,
            uiMsg = msg,
            updated = Prefs.getLastUpdated(context, widgetId),
            opacity = Prefs.getOpacity(context, widgetId),
            fontScale = Prefs.getFontScale(context, widgetId),
            wrapChild = Prefs.getWrapChild(context, widgetId),
            simpleMode = Prefs.getSimpleMode(context, widgetId),
            widgetTheme = Prefs.getWidgetTheme(context, widgetId),
            failedMsg = Prefs.getFailedMsg(context, widgetId)
        )
    }
}
