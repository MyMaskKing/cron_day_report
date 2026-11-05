package xyz.a10023456.todowidget

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.glance.appwidget.GlanceAppWidgetManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.LocalTime

/** Local daily reminder notifications. */
object ReminderNotifier {
    private const val CHANNEL_ID = "todo_reminder"
    private const val TYPE_MORNING = "morning"
    private const val TYPE_EVENING = "evening"
    const val NOTIFICATION_MORNING = 1001
    const val NOTIFICATION_EVENING = 1002
    const val NOTIFICATION_TEST = 1003
    const val NOTIFICATION_ACTION_COMPLETE = 1004
    const val NOTIFICATION_ACTION_TOMORROW = 1005
    const val ACTION_COMPLETE = "complete"
    const val ACTION_TOMORROW = "tomorrow"

    // 任务闹钟刚响后的避让窗口：窗口内不发每日提醒，避免与闹钟铃声/抬头通知互相打断
    private const val FIRE_GUARD_MS = 5 * 60 * 1000L

    // 通知内任务条数上限（BigTextStyle 按逻辑条计，每条物理上可折成多行）；超限前 N-1 条放任务、末行放引导
    private const val MAX_INBOX_LINES = 6

    // 状态文字色：与 WidgetUi 的 W(dark).overdue/today 同源；绿色为明日态新增，跟随系统深浅色
    private const val OVERDUE_RED_LIGHT = 0xFFCF1322.toInt()
    private const val OVERDUE_RED_DARK = 0xFFFF6B6B.toInt()
    private const val TODAY_BLUE_LIGHT = 0xFF2563EB.toInt()
    private const val TODAY_BLUE_DARK = 0xFF60A5FA.toInt()
    private const val TOMORROW_GREEN_LIGHT = 0xFF16A34A.toInt()
    private const val TOMORROW_GREEN_DARK = 0xFF7CE39F.toInt()

    // 超限引导行颜色：与通知 accent（setColor）同品牌紫
    private const val HINT_PURPLE = 0xFFC026D3.toInt()

    fun check(context: Context, refreshedIds: List<Int>) {
        if (refreshedIds.isEmpty() || !hasNotificationPermission(context)) return
        // 本次跳过且不标记已发，等下一次刷新（15 分钟周期或打开 App）自动补发
        if (System.currentTimeMillis() - TaskAlarmScheduler.lastFireAtMillis(context) < FIRE_GUARD_MS) return

        val snapshot = reminderSnapshot(context, refreshedIds)
        val now = LocalTime.now()
        val morningStart = reminderTime(context, R.integer.reminder_morning_hour, R.integer.reminder_morning_minute)
        val eveningStart = reminderTime(context, R.integer.reminder_evening_hour, R.integer.reminder_evening_minute)
        when {
            now >= morningStart && now.isBefore(eveningStart) -> {
                val text = morningText(snapshot.todayCount, snapshot.overdueCount) ?: return
                show(context, TYPE_MORNING, NOTIFICATION_MORNING, snapshot.date, "待办提醒", text, snapshot.accountWidgetIds, true, snapshot.todayCount > 0,
                    inboxLines = reminderLines(context, snapshot.morningGroups))
            }
            now >= eveningStart -> {
                val text = eveningText(snapshot.tomorrowCount, snapshot.overdueCount) ?: return
                // 逾期组在前、明日组在后；超块数截断时自然先截明日组尾部，逾期优先保留
                show(context, TYPE_EVENING, NOTIFICATION_EVENING, snapshot.date, "待办提醒", text, snapshot.accountWidgetIds, snapshot.overdueCount > 0, false,
                    inboxLines = reminderLines(context, snapshot.eveningGroups + snapshot.tomorrowGroups))
            }
        }
    }

    private data class ReminderSnapshot(
        val date: String,
        val todayCount: Int,
        val overdueCount: Int,
        val tomorrowCount: Int,
        val accountWidgetIds: List<Int>,
        val morningGroups: List<ReminderGroup>,
        val eveningGroups: List<ReminderGroup>,
        val tomorrowGroups: List<ReminderGroup>
    )

    /** 通知分组：仅携带账号 owner 与其下通过口径过滤的叶子，渲染时拍平为任务块。 */
    private data class ReminderGroup(
        val owner: String,
        val leaves: List<ReminderLeaf>
    )

    /** 叶子状态：决定行首色点与日期文字色，ordinal 即聚拢排序优先级（逾期→今日→明日）。 */
    private enum class LeafStatus { OVERDUE, TODAY, TOMORROW }

    /**
     * 叶子渲染素材：dueLabel 为有效日期徽章（自身优先否则继承，保证主任务逾期时叶子也能看到日期）；
     * parent 只取直接上一级（path 末级，为空时回退组标题），solo 独立任务为空串表示无父级段。
     */
    private data class ReminderLeaf(
        val title: String,
        val dueLabel: String,
        val parent: String,
        val status: LeafStatus
    )

    private fun reminderSnapshot(context: Context, refreshedIds: List<Int>): ReminderSnapshot {
        val today = java.time.LocalDate.now().toString()
        var todayCount = 0
        var overdueCount = 0
        var tomorrowCount = 0
        val seenAccounts = HashSet<String>()
        val accountWidgetIds = mutableListOf<Int>()
        val morningGroups = mutableListOf<ReminderGroup>()
        val eveningGroups = mutableListOf<ReminderGroup>()
        val tomorrowGroups = mutableListOf<ReminderGroup>()

        for (id in refreshedIds) {
            val data = WidgetRepo.cached(context, id) ?: continue
            if (!data.success || data.today != today) continue
            val owner = data.owner_name?.takeIf { it.isNotBlank() }
                ?: Prefs.getToken(context, id).takeLast(8)
            val accountKey = Prefs.getBaseUrl(context, id) + "|" + owner
            if (!seenAccounts.add(accountKey)) continue
            accountWidgetIds.add(id)

            todayCount += data.stats.today
            overdueCount += data.stats.overdue
            tomorrowCount += data.stats.tomorrow

            // 明细与计数同账号去重口径；普通 groups 受小组件 scope 过滤，按早/晚通知口径各筛一份；
            // tomorrow_groups 服务端已限定有效日期=明天，端上整组收且不受 scope 影响
            for (group in data.groups) {
                filterGroup(group, owner, evening = false)?.let { morningGroups.add(it) }
                filterGroup(group, owner, evening = true)?.let { eveningGroups.add(it) }
            }
            for (group in data.tomorrow_groups) {
                tomorrowGroups.add(tomorrowGroup(group, owner))
            }
        }

        return ReminderSnapshot(
            today, todayCount, overdueCount, tomorrowCount, accountWidgetIds,
            morningGroups, eveningGroups, tomorrowGroups
        )
    }

    /**
     * 模拟一次提醒通知。forceEvening=null 按当前真实时间判档；
     * 「我的」页测试弹窗显式传 true/false，白天也能预览晚档（含明日组）效果。
     */
    fun showTest(context: Context, forceEvening: Boolean? = null) {
        if (!hasNotificationPermission(context)) return
        android.widget.Toast.makeText(context, "正在拉取最新待办…", android.widget.Toast.LENGTH_SHORT).show()

        val appContext = context.applicationContext
        CoroutineScope(Dispatchers.IO).launch {
            val ids = runCatching {
                GlanceAppWidgetManager(appContext)
                    .getGlanceIds(TodoAppWidget::class.java)
                    .map { it.resolveAppWidgetId(appContext) }
                    .filter { it >= 0 }
            }.getOrDefault(emptyList())
            val refreshedIds = mutableListOf<Int>()
            ids.forEach { id ->
                if (WidgetRepo.refresh(appContext, id, maxAttempts = 2)) refreshedIds.add(id)
            }
            showTestSnapshot(appContext, ids, refreshedIds, forceEvening)
        }
    }

    private fun showTestSnapshot(
        context: Context,
        ids: List<Int>,
        refreshedIds: List<Int>,
        forceEvening: Boolean? = null
    ) {
        val snapshot = reminderSnapshot(context, refreshedIds)
        val realEvening = LocalTime.now() >= reminderTime(
            context,
            R.integer.reminder_evening_hour,
            R.integer.reminder_evening_minute
        )
        val isEvening = forceEvening ?: realEvening
        val type = if (isEvening) TYPE_EVENING else TYPE_MORNING
        val text = when {
            ids.isEmpty() -> "请先添加桌面小组件后再模拟待办提醒"
            refreshedIds.isEmpty() -> "最新待办刷新失败，请检查网络或登录状态后重试"
            snapshot.accountWidgetIds.isEmpty() -> "暂无可模拟的待办提醒数据"
            isEvening -> eveningText(snapshot.tomorrowCount, snapshot.overdueCount)
                ?: "明日暂无待办，当前也没有逾期"
            else -> morningText(snapshot.todayCount, snapshot.overdueCount)
                ?: "今日暂无到期或逾期待办"
        }
        val hasActionData = refreshedIds.isNotEmpty() && snapshot.accountWidgetIds.isNotEmpty()
        val enableComplete = hasActionData && if (isEvening) {
            snapshot.overdueCount > 0
        } else {
            snapshot.todayCount > 0 || snapshot.overdueCount > 0
        }
        val enablePostpone = hasActionData && !isEvening && snapshot.todayCount > 0

        show(
            context,
            type,
            NOTIFICATION_TEST,
            snapshot.date,
            "待办提醒",
            text,
            snapshot.accountWidgetIds,
            enableComplete = enableComplete,
            enablePostpone = enablePostpone,
            markSent = false,
            inboxLines = reminderLines(
                context,
                if (isEvening) snapshot.eveningGroups + snapshot.tomorrowGroups
                else snapshot.morningGroups
            )
        )
    }

    fun cancelReminders(context: Context) {
        NotificationManagerCompat.from(context).cancel(NOTIFICATION_MORNING)
        NotificationManagerCompat.from(context).cancel(NOTIFICATION_EVENING)
    }

    fun cancelNotification(context: Context, notificationId: Int) {
        NotificationManagerCompat.from(context).cancel(notificationId)
    }

    fun showActionResult(context: Context, action: String, success: Boolean, count: Int, error: String? = null) {
        if (!hasNotificationPermission(context)) return
        createChannel(context)
        val title = "待办提醒"
        val text = if (!success) {
            "操作失败" + (error?.takeIf { it.isNotBlank() }?.let { "：$it" } ?: "")
        } else if (action == ACTION_COMPLETE) {
            if (count > 0) "已完成 ${count} 件待办" else "没有需要完成的待办"
        } else {
            if (count > 0) "已将 ${count} 件今日待办移到明天" else "没有需要改期的今日待办"
        }
        val notificationId = if (action == ACTION_COMPLETE) NOTIFICATION_ACTION_COMPLETE else NOTIFICATION_ACTION_TOMORROW
        NotificationManagerCompat.from(context).notify(
            notificationId,
            buildNotification(context, notificationId, title, text).build()
        )
    }

    private fun reminderTime(context: Context, hourRes: Int, minuteRes: Int): LocalTime =
        LocalTime.of(context.resources.getInteger(hourRes), context.resources.getInteger(minuteRes))

    private fun morningText(todayCount: Int, overdueCount: Int): String? = when {
        todayCount > 0 && overdueCount > 0 ->
            "今日到期 ${todayCount} 件，逾期 ${overdueCount} 件"
        todayCount > 0 -> "今日到期 ${todayCount} 件"
        overdueCount > 0 -> "有 ${overdueCount} 件逾期待办"
        else -> null
    }

    private fun eveningText(tomorrowCount: Int, overdueCount: Int): String? = when {
        tomorrowCount > 0 && overdueCount > 0 ->
            "明日有 ${tomorrowCount} 件待办；另有 ${overdueCount} 件逾期未完成"
        tomorrowCount > 0 -> "明日有 ${tomorrowCount} 件待办"
        overdueCount > 0 -> "有 ${overdueCount} 件逾期待办"
        else -> null
    }

    /** 普通 groups 的通知口径过滤：早档收逾期或今日叶子，晚档仅收逾期叶子；组内无候选则整组隐藏。 */
    private fun filterGroup(group: WidgetGroup, owner: String, evening: Boolean): ReminderGroup? {
        if (!group.collapsible) {
            // solo 组（无子任务的独立任务，服务端回退根自身一行）：按该行有效日期过滤，parent 留空不渲染父级
            val item = group.children.firstOrNull() ?: return null
            if (!reminderLeafPass(item, evening)) return null
            // 晚档通过 pass 的必为逾期；早档非逾期项由 pass 条件保证是今日
            val status = if (item.overdue) LeafStatus.OVERDUE else LeafStatus.TODAY
            return ReminderGroup(owner, listOf(ReminderLeaf(item.title, item.due_label, parent = "", status)))
        }
        val leaves = group.children.mapNotNull { item ->
            if (!reminderLeafPass(item, evening)) return@mapNotNull null
            // 只显示直接上一级：path 末级；root 直属叶子（path 为空）回退组标题
            val status = if (item.overdue) LeafStatus.OVERDUE else LeafStatus.TODAY
            ReminderLeaf(item.title, item.due_label, item.path.lastOrNull() ?: group.title, status)
        }
        if (leaves.isEmpty()) return null
        return ReminderGroup(owner, leaves)
    }

    /** 晚档只看逾期；早档看逾期或今日（due_label 含「今天」，规避 all scope 混入的未来/无日期项）。 */
    private fun reminderLeafPass(item: WidgetItem, evening: Boolean): Boolean =
        if (evening) item.overdue else (item.overdue || item.due_label.contains("今天"))

    /** 明日组：服务端已把叶子有效日期限定为明天，端上不再过滤，状态统一 TOMORROW。 */
    private fun tomorrowGroup(group: WidgetGroup, owner: String): ReminderGroup {
        if (!group.collapsible) {
            val item = group.children.firstOrNull() ?: return ReminderGroup(owner, emptyList())
            return ReminderGroup(owner, listOf(ReminderLeaf(item.title, item.due_label, parent = "", LeafStatus.TOMORROW)))
        }
        val leaves = group.children.map {
            ReminderLeaf(it.title, it.due_label, it.path.lastOrNull() ?: group.title, LeafStatus.TOMORROW)
        }
        return ReminderGroup(owner, leaves)
    }

    /**
     * 拍平为任务行（由 buildNotification 用 \n 拼进 BigTextStyle，长内容自动折行不省略）：
     * 先按状态聚拢（逾期→今日→明日，sortedBy 稳定保同态原序），每条叶子渲染一行，行首按状态挂 🔴/🔵/🟢；
     * 超 [MAX_INBOX_LINES] 时前 N-1 行放任务、末行放引导；多账号行内带 [昵称]。
     */
    private fun reminderLines(context: Context, groups: List<ReminderGroup>): List<CharSequence> {
        if (groups.isEmpty()) return emptyList()
        val multiAccount = groups.map { it.owner }.distinct().size > 1
        val rows = groups.flatMap { group ->
            val owner = if (multiAccount) group.owner else null
            group.leaves.map { leaf -> owner to leaf }
        }.sortedBy { it.second.status.ordinal }
        val lines = rows.map { (owner, leaf) -> buildLine(context, leaf, owner) }
        if (lines.size <= MAX_INBOX_LINES) return lines
        val hidden = lines.size - (MAX_INBOX_LINES - 1)
        return lines.take(MAX_INBOX_LINES - 1) + buildHintLine("还有 $hidden 件，点击查看全部 ➡️")
    }

    /**
     * 单任务行结构（用户指定样式）：状态色点紧贴标题（🔴逾期/🔵今日/🟢明日），[昵称]? 在前；
     * 日期与直接父级收进同一个 [] 复合块：[状态emoji 日期 ➽ 父级]，整块染状态色。
     * 逾期块内用 ⚠️ + 纯相对日期（剥掉服务端文案的「逾期 」前缀），今日/明日用 📅；
     * solo 任务无 ➽ 父级段；BigTextStyle 承载时过长自动折行。
     */
    private fun buildLine(context: Context, leaf: ReminderLeaf, owner: String?): CharSequence {
        val dark = isSystemDark(context)
        val builder = android.text.SpannableStringBuilder()
        // 色点紧贴标题（用户指定样式，无尾随空格）：🔴逾期 / 🔵今日 / 🟢明日
        builder.append(
            when (leaf.status) {
                LeafStatus.OVERDUE -> "🔴"
                LeafStatus.TODAY -> "🔵"
                LeafStatus.TOMORROW -> "🟢"
            }
        )
        if (owner != null) builder.append("[$owner] ")
        val titleStart = builder.length
        builder.append(leaf.title)
        builder.setSpan(
            // StyleSpan/ForegroundColorSpan 在 android.text.style 子包；Builder 才在 android.text
            android.text.style.StyleSpan(android.graphics.Typeface.BOLD),
            titleStart, builder.length,
            android.text.Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
        )
        if (leaf.dueLabel.isNotEmpty()) {
            // 服务端徽章形如「⚠️ 逾期 昨天」「📅 明天」：取首个空格之后，逾期再剥「逾期 」前缀
            // （块内 ⚠️ 已表义）；日期与直接父级收进同一个 [] 块、➽ 连接，整块统一染状态色
            val plainDate = leaf.dueLabel.substringAfter(' ', leaf.dueLabel)
                .let { if (leaf.status == LeafStatus.OVERDUE) it.removePrefix("逾期 ") else it }
            val blockStart = builder.length
            builder.append(" ▷ ")
            builder.append(if (leaf.status == LeafStatus.OVERDUE) "❄" else "☼")
            builder.append(plainDate)
            if (leaf.parent.isNotEmpty()) {
                builder.append(" ⇨ ")
                builder.append(leaf.parent)
            }
            val dateColor = when (leaf.status) {
                LeafStatus.OVERDUE -> if (dark) OVERDUE_RED_DARK else OVERDUE_RED_LIGHT
                LeafStatus.TODAY -> if (dark) TODAY_BLUE_DARK else TODAY_BLUE_LIGHT
                LeafStatus.TOMORROW -> if (dark) TOMORROW_GREEN_DARK else TOMORROW_GREEN_LIGHT
            }
            builder.setSpan(
                android.text.style.ForegroundColorSpan(dateColor),
                blockStart, builder.length,
                android.text.Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
            )
        }
        return builder
    }

    /** 超限引导行：品牌紫单行，点击行为复用通知 contentIntent（打开 App /todo），无需新 PendingIntent。 */
    private fun buildHintLine(text: String): CharSequence {
        val spannable = android.text.SpannableString(text)
        spannable.setSpan(
            android.text.style.ForegroundColorSpan(HINT_PURPLE),
            0, spannable.length,
            android.text.Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
        )
        return spannable
    }

    /** 系统是否处于深色模式（通知由 SystemUI 渲染，跟随系统配色而非 App 内主题）。 */
    private fun isSystemDark(context: Context): Boolean {
        val mode = context.resources.configuration.uiMode and
            android.content.res.Configuration.UI_MODE_NIGHT_MASK
        return mode == android.content.res.Configuration.UI_MODE_NIGHT_YES
    }

    private fun show(
        context: Context,
        type: String,
        notificationId: Int,
        date: String,
        title: String,
        text: String,
        accountWidgetIds: List<Int>,
        enableComplete: Boolean,
        enablePostpone: Boolean,
        markSent: Boolean = true,
        inboxLines: List<CharSequence> = emptyList()
    ) {
        if (!hasNotificationPermission(context) || (markSent && Prefs.getReminderSentDate(context, type) == date)) return
        createChannel(context)
        val builder = buildNotification(context, notificationId, title, text, inboxLines)
        if (enableComplete && accountWidgetIds.isNotEmpty()) {
            builder.addAction(
                R.drawable.ic_notification,
                "全部完成",
                actionPendingIntent(context, ACTION_COMPLETE, accountWidgetIds, notificationId)
            )
            if (enablePostpone) {
                builder.addAction(
                    R.drawable.ic_notification,
                    "放到明天",
                    actionPendingIntent(context, ACTION_TOMORROW, accountWidgetIds, notificationId)
                )
            }
        }
        NotificationManagerCompat.from(context).notify(notificationId, builder.build())
        if (markSent) Prefs.setReminderSentDate(context, type, date)
    }

    private fun buildNotification(
        context: Context,
        notificationId: Int,
        title: String,
        text: String,
        inboxLines: List<CharSequence> = emptyList()
    ): NotificationCompat.Builder {
        val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_CLEAR_TOP or
                Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(Keys.Url.name, AppConfig.getBaseUrl(context) + "/todo")
        }
        val pendingIntent = if (intent == null) null else PendingIntent.getActivity(
            context,
            notificationId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        // 明细统一挂 BigTextStyle：各任务行用 \n 拼接（append CharSequence 保留每行 Span），
        // 长标题/父级自动折行完整显示，不做 InboxStyle 的单行省略号；
        // 折叠态仍显示 contentText 计数句，summary 放同句兜底。
        // 显式声明 Style 统一两分支类型；显式 receiver 构建，不用 apply 嵌套（隐式 this 编译解析失败）
        val style: NotificationCompat.Style = if (inboxLines.isEmpty()) {
            NotificationCompat.BigTextStyle().bigText(text)
        } else {
            val bigText = android.text.SpannableStringBuilder()
            inboxLines.forEachIndexed { index, line ->
                if (index > 0) bigText.append("\n")
                bigText.append(line)
            }
            NotificationCompat.BigTextStyle()
                .bigText(bigText)
                .setSummaryText(text)
        }
        return NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(0xFFC026D3.toInt())
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(style)
            .apply { if (pendingIntent != null) setContentIntent(pendingIntent) }
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
    }

    private fun actionPendingIntent(
        context: Context,
        action: String,
        widgetIds: List<Int>,
        notificationId: Int
    ): PendingIntent {
        val intent = Intent(context, ReminderActionReceiver::class.java).apply {
            putExtra(ReminderActionReceiver.EXTRA_ACTION, action)
            putExtra(ReminderActionReceiver.EXTRA_WIDGET_IDS, widgetIds.toIntArray())
            putExtra(ReminderActionReceiver.EXTRA_NOTIFICATION_ID, notificationId)
        }
        val requestCode = notificationId * 10 + if (action == ACTION_COMPLETE) 1 else 2
        return PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    /** 确保系统通知设置里存在每日「待办提醒」渠道（幂等）。 */
    fun createChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "待办提醒",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "每日今日、逾期与明日待办摘要"
        }
        ContextCompat.getSystemService(context, NotificationManager::class.java)
            ?.createNotificationChannel(channel)
    }

    fun hasNotificationPermission(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(
                context,
                android.Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
}
