package xyz.a10023456.todowidget

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import kotlinx.serialization.json.Json

/** Service ↔ AlarmActivity 事件总线：Service 停铃（含超时/通知栏操作）时通知页面关闭。 */
object AlarmUiBus {
    var listener: ((String) -> Unit)? = null
    fun emit(event: String) { listener?.invoke(event) }
}

/**
 * 闹钟响铃前台服务：循环铃声 + 循环震动 + WakeLock；维护同刻多闹钟队列与 5 分钟超时。
 * 响铃页被划掉也不影响响铃，可通过通知栏返回或通知动作操作。
 */
class AlarmRingingService : Service() {

    private data class RingingItem(
        val alarm: StoredTaskAlarm,
        val startedAtMs: Long
    )

    private val queue = ArrayDeque<RingingItem>()
    private var current: RingingItem? = null

    private var player: MediaPlayer? = null
    private var audioFocusRequest: AudioFocusRequest? = null
    private var vibrator: Vibrator? = null
    private var wakeLock: PowerManager.WakeLock? = null

    private val mainHandler = Handler(Looper.getMainLooper())
    private val timeoutRunnable = Runnable { timeoutCurrent() }

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        TaskAlarmScheduler.createChannel(this)
        ensureChannel(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopCurrent()
                advance()
            }
            ACTION_SNOOZE -> {
                snoozeCurrent()
                advance()
            }
            else -> {
                val alarm = parseAlarm(intent)
                if (alarm == null) {
                    if (current == null && queue.isEmpty()) stopSelf()
                    return START_REDELIVER_INTENT
                }
                queue.add(RingingItem(alarm, System.currentTimeMillis()))
                if (current == null) beginNext()
            }
        }
        return START_REDELIVER_INTENT
    }

    private fun parseAlarm(intent: Intent?): StoredTaskAlarm? {
        val raw = intent?.getStringExtra(EXTRA_ALARM_JSON) ?: return null
        return runCatching {
            json.decodeFromString(StoredTaskAlarm.serializer(), raw)
        }.getOrNull()
    }

    private fun beginNext() {
        val item = queue.removeFirstOrNull() ?: return
        current = item

        startForegroundCompat(SVC_NOTIFICATION_ID, buildNotification(item.alarm))
        acquireWakeLock()
        startSound()
        startVibration()
        launchActivity(item.alarm)

        mainHandler.removeCallbacks(timeoutRunnable)
        mainHandler.postDelayed(timeoutRunnable, RINGING_TIMEOUT_MS)
    }

    /** 停止当前响铃并通知页面关闭；不自动推进队列（调用方决定）。 */
    private fun stopCurrent() {
        mainHandler.removeCallbacks(timeoutRunnable)
        stopSound()
        stopVibration()
        releaseWakeLock()
        current = null
        NotificationManagerCompat.from(this).cancel(SVC_NOTIFICATION_ID)
        AlarmUiBus.emit(EVENT_DISMISS)
    }

    private fun snoozeCurrent() {
        val item = current ?: return
        // 测试闹钟不写真实闹钟表，贪睡对它无意义：仅停铃
        if (item.alarm.todoId != TEST_ALARM_TODO_ID) {
            runCatching {
                TaskAlarmScheduler.snooze(this, item.alarm, item.startedAtMs, SNOOZE_DELAY_MS)
            }
        }
        stopCurrent()
    }

    private fun timeoutCurrent() {
        val item = current
        stopCurrent()
        if (item != null) showResidualNotification(item.alarm)
    }

    /** 当前项结束后：队列有下一个立刻响，否则结束服务。 */
    private fun advance() {
        if (queue.isNotEmpty()) beginNext() else stopSelf()
    }

    // ---------- 铃声 / 震动 / WakeLock ----------

    private fun startSound() {
        val audioManager = getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        // 完全静音模式不响铃（震动由 startVibration 单独决定）
        if (audioManager?.ringerMode == AudioManager.RINGER_MODE_SILENT) return
        // 铃声取自系统「待办闹钟」渠道：用户在系统通知设置里换铃声、选无声即生效；
        // 渠道不存在时回退默认闹钟音
        val channel = getSystemService(NotificationManager::class.java)
            ?.getNotificationChannel(TaskAlarmScheduler.CHANNEL_ID)
        val soundUri = when {
            channel == null -> RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            channel.sound == null -> return
            else -> channel.sound
        } ?: return
        val mediaPlayer = runCatching {
            MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                setDataSource(this@AlarmRingingService, soundUri)
                isLooping = true
                prepare()
                start()
            }
        }.getOrNull() ?: return
        player = mediaPlayer
        requestAudioFocus()
    }

    /**
     * 申请闹钟音频焦点：部分 ROM（vivo OriginOS）会对未持焦点的闹钟声在震动节拍里压停，
     * 持焦点后铃声可与震动并行。minSdk 26，AudioFocusRequest 直接可用。
     */
    private fun requestAudioFocus() {
        val audioManager = getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
        val attrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
            .setAudioAttributes(attrs)
            .setAcceptsDelayedFocusGain(false)
            .setOnAudioFocusChangeListener({ }, mainHandler)
            .build()
        if (audioManager.requestAudioFocus(request) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
            audioFocusRequest = request
        }
    }

    private fun stopSound() {
        runCatching { player?.stop() }
        player?.release()
        player = null
        val audioManager = getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        audioFocusRequest?.let { audioManager?.abandonAudioFocusRequest(it) }
        audioFocusRequest = null
    }

    private fun startVibration() {
        val vib: Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            getSystemService(android.os.VibratorManager::class.java)?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
        if (vib == null || !vib.hasVibrator()) return
        // 是否震动跟随系统「待办闹钟」渠道
        val alarmChannel = getSystemService(NotificationManager::class.java)
            ?.getNotificationChannel(TaskAlarmScheduler.CHANNEL_ID)
        // NotificationChannel 无 isVibrationEnabled 读属性：震动关闭时 vibrationPattern 为 null
        if (alarmChannel != null && alarmChannel.vibrationPattern == null) return
        val pattern = longArrayOf(0, 800, 600, 800, 600)
        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vib.vibrate(VibrationEffect.createWaveform(pattern, 0))
            } else {
                @Suppress("DEPRECATION")
                vib.vibrate(pattern, 0)
            }
        }
        vibrator = vib
    }

    private fun stopVibration() {
        runCatching { vibrator?.cancel() }
        vibrator = null
    }

    private fun acquireWakeLock() {
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "todowidget:alarm").apply {
            acquire(RINGING_TIMEOUT_MS + 30_000L)
        }
    }

    private fun releaseWakeLock() {
        runCatching { if (wakeLock?.isHeld == true) wakeLock?.release() }
        wakeLock = null
    }

    // ---------- 响铃页 / 通知 ----------

    private fun launchActivity(alarm: StoredTaskAlarm) {
        val intent = Intent(this, AlarmActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
            putExtra(EXTRA_ALARM_JSON, json.encodeToString(StoredTaskAlarm.serializer(), alarm))
        }
        runCatching { startActivity(intent) }
    }

    private fun startForegroundCompat(id: Int, notification: Notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(id, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(id, notification)
        }
    }

    private fun buildNotification(alarm: StoredTaskAlarm): Notification {
        val payload = json.encodeToString(StoredTaskAlarm.serializer(), alarm)
        val openIntent = Intent(this, AlarmActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(EXTRA_ALARM_JSON, payload)
        }
        val openPi = PendingIntent.getActivity(
            this, SVC_NOTIFICATION_ID, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_chip_today)
            .setContentTitle("待办闹钟")
            .setContentText(alarm.title)
            .setOngoing(true)
            .setContentIntent(openPi)
            .addAction(R.drawable.ic_chip_today, "停止", commandPendingIntent(ACTION_STOP, 1))
            .addAction(R.drawable.ic_chip_today, "贪睡 5 分钟", commandPendingIntent(ACTION_SNOOZE, 2))
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun commandPendingIntent(action: String, requestSuffix: Int): PendingIntent {
        val intent = Intent(this, AlarmRingingService::class.java).apply { this.action = action }
        return PendingIntent.getForegroundService(
            this, SVC_NOTIFICATION_ID + requestSuffix, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    /** 超时后保留的静默通知（点击打开任务）。 */
    private fun showResidualNotification(alarm: StoredTaskAlarm) {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_CLEAR_TOP or
                Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(Keys.Url.name, alarm.baseUrl + "/todo?edit=" + Uri.encode(alarm.todoId))
        }
        val pi = PendingIntent.getActivity(
            this, alarm.requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_chip_today)
            .setContentTitle("待办提醒")
            .setContentText(alarm.title)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
        NotificationManagerCompat.from(this).notify(alarm.requestCode, notification)
    }


    override fun onDestroy() {
        mainHandler.removeCallbacks(timeoutRunnable)
        stopSound()
        stopVibration()
        releaseWakeLock()
        super.onDestroy()
    }

    companion object {
        const val CHANNEL_ID = "todo_task_alarm_svc"
        const val ACTION_STOP = "xyz.a10023456.todowidget.ALARM_STOP"
        const val ACTION_SNOOZE = "xyz.a10023456.todowidget.ALARM_SNOOZE"
        const val EXTRA_ALARM_JSON = "alarm_json"
        const val SVC_NOTIFICATION_ID = 40000
        const val EVENT_DISMISS = "dismiss"

        const val TEST_ALARM_TODO_ID = "__alarm_test__"
        private const val TEST_NOTIFICATION_ID = 29999
        private const val CHANNEL_NAME = "闹钟通知栏及页面设置"

        const val RINGING_TIMEOUT_MS = 5 * 60 * 1000L
        const val SNOOZE_DELAY_MS = 5 * 60 * 1000L

        /** 闹钟到点：以前台服务方式启动响铃。 */
        fun start(context: Context, alarm: StoredTaskAlarm) {
            val payload = Json {
                ignoreUnknownKeys = true
                encodeDefaults = true
            }.encodeToString(StoredTaskAlarm.serializer(), alarm)
            val intent = Intent(context, AlarmRingingService::class.java).apply {
                putExtra(EXTRA_ALARM_JSON, payload)
            }
            ContextCompat.startForegroundService(context, intent)
        }

        /**
         * 立即按真实闹钟方式响一次测试铃：同样走前台服务、循环铃声、震动与响铃页，
         * 点响铃页「停止」结束（不写入本机闹钟表）。
         */
        fun startTest(context: Context) {
            val baseUrl = AppConfig.getBaseUrl(context)
            val alarm = StoredTaskAlarm(
                baseUrl = baseUrl,
                todoId = TEST_ALARM_TODO_ID,
                title = "闹钟测试：铃声与震动正常即 OK，请点「停止」结束",
                dueDate = "2099-01-01",
                minute = 0,
                requestCode = TEST_NOTIFICATION_ID
            )
            start(context, alarm)
        }

        /**
         * 确保系统通知设置里存在「闹钟通知栏及页面设置」渠道（幂等）：
         * App 启动时即调用，不必等首次响铃；含旧名"闹钟服务"的一次性改名迁移。
         */
        fun ensureChannel(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val manager = context.getSystemService(NotificationManager::class.java) ?: return
            val existing = manager.getNotificationChannel(CHANNEL_ID)
            if (existing != null) {
                if (existing.name?.toString() == CHANNEL_NAME) return
                manager.deleteNotificationChannel(CHANNEL_ID)
            }
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "响铃时出现在通知栏并拉起响铃页，提供停止/贪睡按钮；本渠道无声，无需改铃声"
                setShowBadge(false)
            }
            manager.createNotificationChannel(channel)
        }
    }
}
