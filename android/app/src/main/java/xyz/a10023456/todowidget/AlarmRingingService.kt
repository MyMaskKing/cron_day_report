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
import android.util.Log
import android.widget.Toast
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
        startSound(item.alarm)
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
        NotificationManagerCompat.from(this).cancel(FALLBACK_NOTIFICATION_ID)
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

    private fun startSound(alarm: StoredTaskAlarm) {
        val audioManager = getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        // 不能因静音模式不响：STREAM_ALARM 在静音、勿扰（默认允许闹钟穿透）下仍输出，
        // 与系统时钟闹钟同契约；仅用户在勿扰里明确禁用闹钟时才听不到（所有闹钟 App 皆然）

        // 铃声取自系统「闹钟铃声设置」渠道；用户在渠道里选"无声"时 sound==null，闹钟只震动
        val notifManager = getSystemService(NotificationManager::class.java)
        val channel = notifManager?.getNotificationChannel(TaskAlarmScheduler.CHANNEL_ID)
        if (channel?.sound != null) {
            // ① App 自己循环播放用户所选铃声
            val userUri = resolveAlarmUri(channel.sound)
            if (playLooping(userUri)) {
                checkAlarmVolumeHint(audioManager)
                return
            }
        }
        // ② 用户铃声播放失败：循环播放系统默认闹钟铃声（各品牌出厂默认，本机 vivo 为 Encounter；
        //    仍只保留控制通知一条，不产生第二条通知）
        val defaultUri = RingtoneManager.getActualDefaultRingtoneUri(
            this, RingtoneManager.TYPE_ALARM
        ) ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        if (defaultUri != null && playLooping(defaultUri)) {
            return
        }
        // ③ 所有 MediaPlayer 均失败（极罕见）：最后才发降级通知，由系统响一遍铃声
        if (channel?.sound != null && showFallbackNotification(alarm)) {
            return
        }
        Log.e(TAG, "全部候选闹钟铃声均播放失败")
        Toast.makeText(this, "闹钟铃声启动失败，请检查系统闹钟铃声设置", Toast.LENGTH_LONG).show()
    }

    /** MediaPlayer 循环播放指定铃声；成功持有 player 并申请音频焦点，失败仅记录日志。 */
    private fun playLooping(uri: Uri): Boolean {
        val mediaPlayer = runCatching {
            MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                setDataSource(this@AlarmRingingService, uri)
                isLooping = true
                prepare()
                start()
            }
        }.onFailure {
            Log.w(TAG, "闹钟铃声播放失败: $uri", it)
        }.getOrNull() ?: return false
        player = mediaPlayer
        requestAudioFocus()
        return true
    }

    /** 铃声启动但闹钟音量为 0 时提示用户调音量。 */
    private fun checkAlarmVolumeHint(audioManager: AudioManager?) {
        if ((audioManager?.getStreamVolume(AudioManager.STREAM_ALARM) ?: 0) == 0) {
            Toast.makeText(this, "闹钟音量为 0：请按音量键调大“闹钟音量”", Toast.LENGTH_LONG).show()
        }
    }

    /**
     * ③ 最后手段：用有声的「闹钟铃声设置」渠道发普通通知，
     * 系统收到后播放铃声（响一遍、不循环）；仅在两级 MediaPlayer 都失败时调用。
     */
    private fun showFallbackNotification(alarm: StoredTaskAlarm): Boolean {
        val path = when {
            alarm.todoId == TEST_ALARM_TODO_ID ||
                alarm.todoId.startsWith(TaskAlarmScheduler.SNOOZE_TODO_PREFIX) -> "/todo"
            else -> "/todo?edit=" + Uri.encode(alarm.todoId)
        }
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_CLEAR_TOP or
                Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(Keys.Url.name, alarm.baseUrl + path)
        }
        val pi = PendingIntent.getActivity(
            this, alarm.requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(this, TaskAlarmScheduler.CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_chip_today)
            .setContentTitle("待办闹钟")
            .setContentText(alarm.title)
            .setStyle(NotificationCompat.BigTextStyle().bigText(alarm.title))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setContentIntent(pi)
            .build()
        return runCatching {
            NotificationManagerCompat.from(this).notify(FALLBACK_NOTIFICATION_ID, notification)
        }.isSuccess
    }

    /**
     * 把系统默认铃声的逻辑 URI（content://settings/system/...）解析为实际音频地址；
     * 已是具体铃声（媒体/文件/resource）时原样返回。
     */
    private fun resolveAlarmUri(uri: Uri): Uri {
        if (uri.authority != "settings") return uri
        val type = when (uri.lastPathSegment) {
            "alarm_alert" -> RingtoneManager.TYPE_ALARM
            "notification_sound" -> RingtoneManager.TYPE_NOTIFICATION
            "ringtone" -> RingtoneManager.TYPE_RINGTONE
            else -> return uri
        }
        return RingtoneManager.getActualDefaultRingtoneUri(this, type) ?: uri
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
        private const val TAG = "TodoAlarm"
        const val CHANNEL_ID = "todo_task_alarm_svc"
        const val ACTION_STOP = "xyz.a10023456.todowidget.ALARM_STOP"
        const val ACTION_SNOOZE = "xyz.a10023456.todowidget.ALARM_SNOOZE"
        const val EXTRA_ALARM_JSON = "alarm_json"
        const val SVC_NOTIFICATION_ID = 40000
        const val FALLBACK_NOTIFICATION_ID = SVC_NOTIFICATION_ID + 10
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
         * 确保存在「闹钟通知栏及页面设置」渠道且**真正无声**（幂等）：
         * 不写 setSound(null,null) 时渠道会带系统默认通知音，故检测到任何声音就删旧重建；
         * 旧名"闹钟服务"同样在此迁移。App 启动时调用，无需用户手动关声音。
         */
        fun ensureChannel(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val manager = context.getSystemService(NotificationManager::class.java) ?: return
            val existing = manager.getNotificationChannel(CHANNEL_ID)
            if (existing != null) {
                if (existing.name?.toString() == CHANNEL_NAME && existing.sound == null) return
                manager.deleteNotificationChannel(CHANNEL_ID)
            }
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "响铃时出现在通知栏并拉起响铃页，提供停止/贪睡按钮；本渠道强制无声，铃声请看「闹钟铃声设置」"
                setShowBadge(false)
                enableVibration(false)
                // 必须显式置空：否则系统会给渠道挂默认通知铃声
                setSound(null, null)
            }
            manager.createNotificationChannel(channel)
        }
    }
}
