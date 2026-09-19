package xyz.a10023456.todowidget

import kotlinx.serialization.Serializable

/** 小组件数据：后端 /api/public/todo-widget/:token 的响应 */
@Serializable
data class WidgetResponse(
    val success: Boolean = false,
    val owner_name: String? = null,
    val today: String? = null,
    val stats: WidgetStats = WidgetStats(),
    val groups: List<WidgetGroup> = emptyList()
)

@Serializable
data class WidgetStats(
    val total: Int = 0,
    val done: Int = 0,
    val pending: Int = 0,
    val overdue: Int = 0,
    val memo: Int = 0,
    /** 今日到期的未完成叶子任务数（标题栏 📅 统计；旧后端不下发时为 0） */
    val today: Int = 0,
    /** 明日到期的未完成叶子任务数（晚间本地提醒用；旧后端不下发时为 0） */
    val tomorrow: Int = 0
)

@Serializable
data class WidgetGroup(
    val id: Long,
    val title: String,
    val due_label: String = "",
    val overdue: Boolean = false,
    val recurring: Boolean = false,
    val collapsible: Boolean = false,
    val children: List<WidgetItem> = emptyList()
)

@Serializable
data class WidgetItem(
    val id: Long,
    val title: String,
    /** 祖先标题链（不含顶层分组、不含自身）；直接子节点为空，用于标题上方显示面包屑。 */
    val path: List<String> = emptyList(),
    /** 有效截止日期标签（新模式子任务为自身日期；旧后端不下发时为空串，旧版 App 忽略不崩）。 */
    val due_label: String = "",
    /** 是否逾期（未完成且过期），控制日期徽章颜色。 */
    val overdue: Boolean = false
)

/** PUT /api/public/todo-all/:token/:id/done 响应 */
@Serializable
data class DoneResponse(
    val success: Boolean = false,
    val message: String? = null,
    val cloned: Boolean = false,
    val next_id: Long? = null,
    val next_due: String? = null
)

/** 通用错误体（后端失败时返回 {success:false, message}） */
@Serializable
data class ErrorResponse(
    val success: Boolean = false,
    val message: String? = null
)
