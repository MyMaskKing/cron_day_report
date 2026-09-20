package xyz.a10023456.todowidget

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** 到点接收 AlarmManager 回调，并由 TaskAlarmScheduler 发出闹钟通知。 */
class TaskAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != ACTION_FIRE) return
        val key = intent.getStringExtra(TaskAlarmScheduler.EXTRA_KEY) ?: return
        TaskAlarmScheduler.fire(context.applicationContext, key)
    }

    companion object {
        const val ACTION_FIRE = "xyz.a10023456.todowidget.TASK_ALARM_FIRE"
    }
}

/** 开机或 App 更新后重新注册仍在未来的本地闹钟。 */
class TaskAlarmBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        when (intent?.action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED -> TaskAlarmScheduler.rescheduleAll(context.applicationContext)
        }
    }
}