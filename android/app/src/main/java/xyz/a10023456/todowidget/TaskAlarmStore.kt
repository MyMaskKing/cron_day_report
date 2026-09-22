package xyz.a10023456.todowidget

import android.content.Context
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json

/** 闹钟携带的第一子层级子任务快照（随网页 reconcile 刷新）。 */
@Serializable
data class TaskAlarmChild(
    val id: String,
    val title: String = "",
    @SerialName("due_date") val dueDate: String? = null,
    val done: Boolean = false
)

@Serializable
data class StoredTaskAlarm(
    val baseUrl: String,
    val todoId: String,
    val title: String,
    val dueDate: String,
    val minute: Int,
    val requestCode: Int,
    val children: List<TaskAlarmChild> = emptyList(),
    @SerialName("child_due") val childDue: Boolean = false,
    val priority: Int? = null,
    val category: String? = null,
    val recurrence: String? = null,
    @SerialName("shared_cat") val sharedCat: Boolean = false,
    @SerialName("snooze_from_ms") val snoozeFromMs: Long? = null
) {
    val key: String get() = taskAlarmKey(baseUrl, todoId)

    companion object {
        fun taskAlarmKey(baseUrl: String, todoId: String): String = "$baseUrl|$todoId"
    }
}

/** 任务级本地闹钟存储；仅保存在本机，不进入服务端待办数据。 */
object TaskAlarmStore {
    private const val PREFS = "task_alarms"
    private const val KEY_ALARMS = "alarms"
    private const val FIRST_REQUEST_CODE = 30000

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    fun list(context: Context): List<StoredTaskAlarm> {
        val raw = prefs(context).getString(KEY_ALARMS, null) ?: return emptyList()
        return runCatching {
            json.decodeFromString(ListSerializer(StoredTaskAlarm.serializer()), raw)
        }.getOrDefault(emptyList())
    }

    fun find(context: Context, key: String): StoredTaskAlarm? =
        list(context).firstOrNull { it.key == key }

    fun upsert(
        context: Context,
        baseUrl: String,
        todoId: String,
        title: String,
        dueDate: String,
        minute: Int,
        children: List<TaskAlarmChild> = emptyList(),
        childDue: Boolean = false,
        priority: Int? = null,
        category: String? = null,
        recurrence: String? = null,
        sharedCat: Boolean = false,
        snoozeFromMs: Long? = null
    ): StoredTaskAlarm {
        val key = StoredTaskAlarm.taskAlarmKey(baseUrl, todoId)
        val current = list(context).toMutableList()
        val index = current.indexOfFirst { it.key == key }
        if (index >= 0) {
            val updated = current[index].copy(
                title = title,
                dueDate = dueDate,
                minute = minute,
                children = children,
                childDue = childDue,
                priority = priority,
                category = category,
                recurrence = recurrence,
                sharedCat = sharedCat,
                snoozeFromMs = snoozeFromMs
            )
            current[index] = updated
            save(context, current)
            return updated
        }

        val requestCode = (current.maxOfOrNull { it.requestCode } ?: FIRST_REQUEST_CODE - 1) + 1
        val alarm = StoredTaskAlarm(
            baseUrl = baseUrl,
            todoId = todoId,
            title = title,
            dueDate = dueDate,
            minute = minute,
            requestCode = requestCode,
            children = children,
            childDue = childDue,
            priority = priority,
            category = category,
            recurrence = recurrence,
            sharedCat = sharedCat,
            snoozeFromMs = snoozeFromMs
        )
        current.add(alarm)
        save(context, current)
        return alarm
    }

    fun remove(context: Context, key: String) {
        save(context, list(context).filterNot { it.key == key })
    }

    private fun save(context: Context, alarms: List<StoredTaskAlarm>) {
        prefs(context).edit()
            .putString(KEY_ALARMS, json.encodeToString(ListSerializer(StoredTaskAlarm.serializer()), alarms))
            .apply()
    }

    private fun prefs(context: Context) =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
