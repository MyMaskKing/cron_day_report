package xyz.a10023456.todowidget

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.glance.appwidget.updateAll
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class ReminderActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.getStringExtra(EXTRA_ACTION) ?: return
        if (action != ReminderNotifier.ACTION_COMPLETE && action != ReminderNotifier.ACTION_TOMORROW) return

        val preview = intent.getBooleanExtra(EXTRA_PREVIEW, false)
        val notificationId = intent.getIntExtra(
            EXTRA_NOTIFICATION_ID,
            ReminderNotifier.NOTIFICATION_MORNING
        )
        if (preview) {
            ReminderNotifier.cancelNotification(context, notificationId)
            return
        }
        ReminderNotifier.cancelReminders(context)
        ReminderNotifier.cancelNotification(context, notificationId)
        val widgetIds = intent.getIntArrayExtra(EXTRA_WIDGET_IDS) ?: return
        if (widgetIds.isEmpty()) return
        val request = OneTimeWorkRequestBuilder<ReminderActionWorker>()
            .setInputData(
                workDataOf(
                    ReminderActionWorker.KEY_ACTION to action,
                    ReminderActionWorker.KEY_WIDGET_IDS to widgetIds
                )
            )
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(
            "reminder_action_$action",
            ExistingWorkPolicy.APPEND_OR_REPLACE,
            request
        )
    }

    companion object {
        const val EXTRA_ACTION = "action"
        const val EXTRA_WIDGET_IDS = "widget_ids"
        const val EXTRA_NOTIFICATION_ID = "notification_id"
        const val EXTRA_PREVIEW = "preview"
    }
}

class ReminderActionWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val action = inputData.getString(KEY_ACTION) ?: return Result.success()
        if (action != ReminderNotifier.ACTION_COMPLETE && action != ReminderNotifier.ACTION_TOMORROW) {
            return Result.success()
        }
        val widgetIds = inputData.getIntArray(KEY_WIDGET_IDS)?.distinct().orEmpty()
        val sid = Prefs.getSid(applicationContext)
        var count = 0
        var failures = 0
        var lastError = ""
        val refreshedIds = mutableListOf<Int>()

        for (widgetId in widgetIds) {
            val token = Prefs.getToken(applicationContext, widgetId)
            if (sid.isBlank() && token.isBlank()) continue
            try {
                val response = withContext(Dispatchers.IO) {
                    ApiClient.reminderAction(
                        Prefs.getBaseUrl(applicationContext, widgetId),
                        sid,
                        token,
                        action
                    )
                }
                if (response.success) {
                    count += response.count
                    if (WidgetRepo.refresh(applicationContext, widgetId)) refreshedIds.add(widgetId)
                } else {
                    failures++
                    lastError = response.message ?: lastError
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                failures++
                lastError = e.message ?: lastError
            }
        }

        if (refreshedIds.isNotEmpty()) {
            withContext(Dispatchers.Main) { TodoAppWidget().updateAll(applicationContext) }
        }
        ReminderNotifier.showActionResult(
            applicationContext,
            action,
            failures == 0,
            count,
            lastError
        )
        return Result.success()
    }

    companion object {
        const val KEY_ACTION = "action"
        const val KEY_WIDGET_IDS = "widget_ids"
    }
}
