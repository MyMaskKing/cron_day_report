package xyz.a10023456.todowidget

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.annotation.DrawableRes
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** 「我的」原生菜单：账号身份卡 + 分组列表 + ModalBottomSheet 原生交互。 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MeScreen(
    baseUrl: String,
    username: String,
    isLoggedIn: Boolean,
    currentThemeKey: String,
    isAdmin: Boolean,
    openServerSheetTrigger: Int = 0,
    onOpenPath: (String) -> Unit,
    onChangeBaseUrl: (String) -> Unit,
    onOpenInBrowser: () -> Unit,
    onSelectTheme: (String) -> Unit,
    onTestNotification: (forceEvening: Boolean) -> Unit,
    onTestCustomNotification: (content: String) -> Unit,
    onLogout: () -> Unit
) {
    var showUrlSheet by remember { mutableStateOf(false) }
    var showThemeSheet by remember { mutableStateOf(false) }
    var showTestSheet by remember { mutableStateOf(false) }
    var pendingUrl by remember { mutableStateOf(baseUrl) }
    val appContext = LocalContext.current.applicationContext
    var showAlarmManager by remember { mutableStateOf(false) }
    var taskAlarms by remember { mutableStateOf(TaskAlarmScheduler.listAlarms(appContext)) }
    var pendingDeleteAlarm by remember { mutableStateOf<StoredTaskAlarm?>(null) }
    val scheme = MaterialTheme.colorScheme

    LaunchedEffect(openServerSheetTrigger) {
        if (openServerSheetTrigger > 0) {
            pendingUrl = baseUrl
            showUrlSheet = true
        }
    }

    val themeLabel = when (currentThemeKey) {
        "dark" -> "暗色"
        "eye" -> "护眼"
        else -> "浅色"
    }
    val displayHost = remember(baseUrl) {
        baseUrl.removePrefix("https://").removePrefix("http://").trimEnd('/')
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(scheme.background)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp)
            .padding(top = 8.dp, bottom = 24.dp)
    ) {
        Text(
            "我的",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            color = scheme.onBackground,
            modifier = Modifier.padding(horizontal = 4.dp, vertical = 12.dp)
        )

        // 顶部账号身份卡
        Surface(
            color = scheme.surface,
            shape = RoundedCornerShape(16.dp),
            border = BorderStroke(1.dp, scheme.outlineVariant),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(scheme.primary),
                    contentAlignment = Alignment.Center
                ) {
                    val initial = when {
                        !isLoggedIn -> "?"
                        username.isNotBlank() -> username.first().uppercase()
                        else -> "U"
                    }
                    Text(
                        text = initial,
                        color = scheme.onPrimary,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
                Column(modifier = Modifier.weight(1f)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = when {
                                !isLoggedIn -> "未登录"
                                username.isNotBlank() -> username
                                else -> "已登录用户"
                            },
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold,
                            color = scheme.onSurface,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        if (isLoggedIn && isAdmin) {
                            Surface(
                                color = scheme.secondaryContainer,
                                shape = AppShapes.Pill
                            ) {
                                Text(
                                    text = "管理员",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = scheme.onSecondaryContainer,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                                )
                            }
                        }
                    }
                    Spacer(Modifier.height(4.dp))
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(7.dp)
                                .clip(CircleShape)
                                .background(if (isLoggedIn) Color(0xFF22C55E) else scheme.onSurfaceVariant)
                        )
                        Text(
                            text = if (isLoggedIn) "$displayHost · 已连接" else "$displayHost · 未登录",
                            fontSize = 12.sp,
                            color = scheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }
        }

        Spacer(Modifier.height(14.dp))

        MeGroup {
            MeItem(R.drawable.ic_me_dashboard, "仪表盘", "今日概览与功能入口", divider = true) { onOpenPath("/dashboard") }
            MeItem(R.drawable.ic_me_monitor, "网站监控", "查看定时任务与访问记录", divider = true) { onOpenPath("/monitor") }
            MeItem(R.drawable.ic_me_channels, "通知渠道", "企业微信 / Webhook / 邮件", divider = true) { onOpenPath("/channels") }
            // 「推送与设置」仅当下方还有用户管理项时才画分隔线（末项不画）
            MeItem(R.drawable.ic_me_settings, "推送与个人设置", "日报推送、个人账号与系统设置", divider = isAdmin) { onOpenPath("/settings") }
            if (isAdmin) {
                MeItem(R.drawable.ic_me_users, "用户管理", "管理员可用，切换身份/管理用户") { onOpenPath("/admin") }
            }
        }

        Spacer(Modifier.height(12.dp))
        MeGroup {
            MeItem(
                iconRes = R.drawable.ic_chip_today,
                title = "闹钟管理",
                subtitle = "查看并删除本机待办闹钟",
                badge = if (taskAlarms.isNotEmpty()) "${taskAlarms.size} 个" else null,
                divider = true
            ) {
                taskAlarms = TaskAlarmScheduler.listAlarms(appContext)
                showAlarmManager = true
            }
            MeItem(
                iconRes = R.drawable.ic_me_theme,
                title = "主题外观",
                subtitle = "浅色 / 暗色 / 护眼，随账号同步",
                badge = themeLabel,
                divider = true
            ) { showThemeSheet = true }
            MeItem(R.drawable.ic_me_browser, "在浏览器中打开", "用系统浏览器查看当前页面", divider = true) { onOpenInBrowser() }
            MeItem(
                iconRes = R.drawable.ic_me_server,
                title = "服务器地址",
                subtitle = displayHost,
                divider = isAdmin
            ) {
                pendingUrl = baseUrl
                showUrlSheet = true
            }
            if (isAdmin) {
                MeItem(R.drawable.ic_chip_today, "测试通知", "拉取真实待办数据并发送提醒") { showTestSheet = true }
            }
        }

        Spacer(Modifier.height(12.dp))
        MeGroup {
            MeItem(R.drawable.ic_me_logout, "退出登录", "清除本机登录态", tint = scheme.error) { onLogout() }
        }

        Spacer(Modifier.height(16.dp))
        Text(
            "滴滴答答，缝补你的生活 · $displayHost",
            fontSize = 12.sp,
            color = scheme.onSurfaceVariant,
            modifier = Modifier.padding(horizontal = 4.dp)
        )
    }

    // 主题切换 BottomSheet
    if (showThemeSheet) {
        ModalBottomSheet(
            onDismissRequest = { showThemeSheet = false },
            containerColor = scheme.surface,
            shape = AppShapes.Sheet,
            dragHandle = { BottomSheetDefaults.DragHandle() }
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 24.dp)
            ) {
                Text("主题外观", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = scheme.onSurface)
                Spacer(Modifier.height(4.dp))
                Text("切换后将同步保存至当前账号", fontSize = 12.sp, color = scheme.onSurfaceVariant)
                Spacer(Modifier.height(16.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    val options = listOf(
                        Triple("light", "浅色", Color(0xFFF7F6F3)),
                        Triple("dark", "暗色", Color(0xFF131319)),
                        Triple("eye", "护眼", Color(0xFFF3EEE0))
                    )
                    options.forEach { (key, label, swatch) ->
                        val selected = currentThemeKey == key
                        Surface(
                            color = if (selected) scheme.secondaryContainer else scheme.surfaceVariant,
                            shape = AppShapes.Card,
                            border = BorderStroke(
                                if (selected) 2.dp else 1.dp,
                                if (selected) scheme.primary else scheme.outline
                            ),
                            modifier = Modifier
                                .weight(1f)
                                .clip(AppShapes.Card)
                                .clickable {
                                    onSelectTheme(key)
                                    showThemeSheet = false
                                }
                        ) {
                            Column(
                                modifier = Modifier.padding(vertical = 14.dp, horizontal = 8.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(36.dp)
                                        .clip(AppShapes.Small)
                                        .background(swatch)
                                        .border(1.dp, scheme.outline, AppShapes.Small)
                                )
                                Spacer(Modifier.height(8.dp))
                                Text(
                                    text = label,
                                    fontSize = 13.sp,
                                    fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                                    color = if (selected) scheme.onSecondaryContainer else scheme.onSurface
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // 服务器地址 BottomSheet
    if (showUrlSheet) {
        ModalBottomSheet(
            onDismissRequest = { showUrlSheet = false },
            containerColor = scheme.surface,
            shape = AppShapes.Sheet,
            dragHandle = { BottomSheetDefaults.DragHandle() }
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 24.dp)
            ) {
                Text("服务器地址", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = scheme.onSurface)
                Spacer(Modifier.height(4.dp))
                Text("修改后将清除当前会话并重新连接", fontSize = 12.sp, color = scheme.onSurfaceVariant)
                Spacer(Modifier.height(14.dp))
                OutlinedTextField(
                    value = pendingUrl,
                    onValueChange = { pendingUrl = it },
                    label = { Text("http(s)://...") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = AppShapes.Card
                )
                Spacer(Modifier.height(16.dp))
                Button(
                    onClick = {
                        val v = pendingUrl.trim().trimEnd('/')
                        if (v.startsWith("https://") || v.startsWith("http://")) {
                            onChangeBaseUrl(v)
                            showUrlSheet = false
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(46.dp),
                    shape = AppShapes.Card
                ) {
                    Text("保存并重新连接", fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }

    // 模拟待办提醒 BottomSheet
    if (showTestSheet) {
        var customTestText by remember { mutableStateOf("") }
        ModalBottomSheet(
            onDismissRequest = { showTestSheet = false },
            containerColor = scheme.surface,
            shape = AppShapes.Sheet,
            dragHandle = { BottomSheetDefaults.DragHandle() }
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 24.dp)
            ) {
                Text("模拟待办提醒", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = scheme.onSurface)
                Spacer(Modifier.height(4.dp))
                Text("选择要预览的推送时段或输入自定义内容", fontSize = 12.sp, color = scheme.onSurfaceVariant)
                Spacer(Modifier.height(14.dp))
                OutlinedButton(
                    onClick = {
                        showTestSheet = false
                        onTestNotification(false)
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = AppShapes.Card
                ) { Text("早档 · 今日到期 + 逾期") }
                Spacer(Modifier.height(8.dp))
                OutlinedButton(
                    onClick = {
                        showTestSheet = false
                        onTestNotification(true)
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = AppShapes.Card
                ) { Text("晚档 · 逾期 + 明日待办") }
                Spacer(Modifier.height(14.dp))
                Text("自定义测试内容（支持多行）：", fontSize = 12.sp, color = scheme.onSurfaceVariant)
                Spacer(Modifier.height(6.dp))
                OutlinedTextField(
                    value = customTestText,
                    onValueChange = { customTestText = it },
                    placeholder = { Text("例如：🔴 写周报\n🔵 取快递") },
                    minLines = 3,
                    maxLines = 5,
                    modifier = Modifier.fillMaxWidth(),
                    shape = AppShapes.Card
                )
                Spacer(Modifier.height(12.dp))
                Button(
                    onClick = {
                        val content = customTestText.trim()
                        if (content.isNotEmpty()) {
                            showTestSheet = false
                            onTestCustomNotification(content)
                        }
                    },
                    enabled = customTestText.isNotBlank(),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(44.dp),
                    shape = AppShapes.Card
                ) { Text("发送自定义测试通知") }
            }
        }
    }

    // 闹钟管理 BottomSheet
    if (showAlarmManager) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        var ringTipExpanded by remember { mutableStateOf(false) }
        ModalBottomSheet(
            onDismissRequest = { showAlarmManager = false },
            sheetState = sheetState,
            containerColor = scheme.surface,
            shape = AppShapes.Sheet,
            dragHandle = { BottomSheetDefaults.DragHandle() }
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .heightIn(max = 560.dp)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text("待办闹钟管理", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = scheme.onSurface)

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        "响铃与震动",
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.weight(1f),
                        color = scheme.onSurface
                    )
                    OutlinedButton(onClick = {
                        AlarmRingingService.startTest(appContext)
                    }) { Text("测试") }
                    TextButton(onClick = {
                        if (!TaskAlarmScheduler.openAlarmChannelSettings(appContext)) {
                            TaskAlarmScheduler.openNotificationSettings(appContext)
                        }
                    }) { Text("设置") }
                }

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(AppShapes.Small)
                        .clickable { ringTipExpanded = !ringTipExpanded }
                        .padding(vertical = 2.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        val rot by animateFloatAsState(if (ringTipExpanded) 90f else 0f, label = "ringTip")
                        Icon(
                            painter = painterResource(R.drawable.ic_chevron_right),
                            contentDescription = null,
                            tint = scheme.onSurfaceVariant,
                            modifier = Modifier.size(14.dp).rotate(rot)
                        )
                        Spacer(Modifier.width(4.dp))
                        Text("试听与铃声说明", fontSize = 12.sp, color = scheme.onSurfaceVariant)
                    }
                    AnimatedVisibility(visible = ringTipExpanded) {
                        Text(
                            "测试按真实闹钟试听；铃声、震动点「设置」修改；音量用手机的“闹钟音量”调节。",
                            fontSize = 12.sp,
                            color = scheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 4.dp, start = 18.dp)
                        )
                    }
                }

                if (!TaskAlarmScheduler.notificationsEnabled(appContext)) {
                    MeAlarmSettingWarning("通知权限未开启，闹钟无法响铃或震动") {
                        TaskAlarmScheduler.openNotificationSettings(appContext)
                    }
                }
                if (!TaskAlarmScheduler.canScheduleExactAlarms(appContext)) {
                    MeAlarmSettingWarning("精确闹钟权限未开启，提醒可能不准时") {
                        TaskAlarmScheduler.openExactAlarmSettings(appContext)
                    }
                }
                if (!TaskAlarmScheduler.canUseFullScreenIntent(appContext)) {
                    MeAlarmSettingWarning("锁屏全屏闹钟权限未开启，锁屏时只显示普通通知") {
                        TaskAlarmScheduler.openFullScreenIntentSettings(appContext)
                    }
                }

                MeAlarmPermissionCard(appContext)
                MeAlarmBackgroundCard(appContext)

                OutlinedButton(
                    onClick = {
                        showAlarmManager = false
                        onOpenPath("/todo")
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = AppShapes.Card
                ) { Text("＋ 去待办页设置闹钟") }

                if (taskAlarms.isEmpty()) {
                    Surface(
                        color = scheme.surfaceVariant,
                        shape = AppShapes.Card,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            "本机暂无待办闹钟",
                            fontSize = 13.sp,
                            color = scheme.onSurfaceVariant,
                            modifier = Modifier.padding(16.dp)
                        )
                    }
                } else {
                    taskAlarms.forEach { alarm ->
                        Surface(
                            color = scheme.surfaceVariant,
                            shape = AppShapes.Card,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 14.dp, vertical = 10.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        alarm.title,
                                        fontWeight = FontWeight.Medium,
                                        color = scheme.onSurface,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Spacer(Modifier.height(2.dp))
                                    Text(
                                        meAlarmSubtitle(alarm),
                                        fontSize = 12.sp,
                                        color = scheme.onSurfaceVariant
                                    )
                                }
                                TextButton(onClick = { pendingDeleteAlarm = alarm }) {
                                    Text("删除", color = scheme.error)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    pendingDeleteAlarm?.let { alarm ->
        AlertDialog(
            onDismissRequest = { pendingDeleteAlarm = null },
            title = { Text("删除闹钟？") },
            text = { Text("将取消“${alarm.title}”的本机响铃/震动提醒，不会删除待办本身。") },
            confirmButton = {
                TextButton(onClick = {
                    TaskAlarmScheduler.deleteAlarm(appContext, alarm.key)
                    pendingDeleteAlarm = null
                    taskAlarms = TaskAlarmScheduler.listAlarms(appContext)
                }) { Text("删除", color = scheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { pendingDeleteAlarm = null }) { Text("取消") }
            }
        )
    }
}

@Composable
private fun MeAlarmPermissionCard(context: Context) {
    val scheme = MaterialTheme.colorScheme
    var expanded by remember { mutableStateOf(false) }
    val arrowRotation by animateFloatAsState(if (expanded) 90f else 0f, label = "permArrow")
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(AppShapes.Small)
            .background(scheme.secondaryContainer)
            .padding(10.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { expanded = !expanded },
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                "锁屏与通知权限说明",
                fontWeight = FontWeight.Medium,
                fontSize = 13.sp,
                color = scheme.onSecondaryContainer,
                modifier = Modifier.weight(1f)
            )
            Icon(
                painter = painterResource(R.drawable.ic_chevron_right),
                contentDescription = null,
                tint = scheme.onSecondaryContainer,
                modifier = Modifier.size(16.dp).rotate(arrowRotation)
            )
        }
        AnimatedVisibility(visible = expanded) {
            Column {
                Spacer(Modifier.height(6.dp))
                Text(
                    "1. 应用设置 → 全部权限：请将「悬浮窗」「锁屏显示」「后台弹出界面」均设为允许；" +
                        "锁屏时不弹闹钟页，多为这三项被系统禁止。",
                    fontSize = 12.sp,
                    color = scheme.onSurfaceVariant
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    "2. 应用设置 → 通知设置：允许本 App 通知；其中「闹钟铃声设置」渠道管铃声与震动，" +
                        "「闹钟通知栏及页面设置」渠道管锁屏页面与通知按钮，两者均需保持开启。",
                    fontSize = 12.sp,
                    color = scheme.onSurfaceVariant
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = {
                        runCatching {
                            context.startActivity(TaskAlarmScheduler.applicationDetailsSettingsIntent(context))
                        }
                    }) { Text("全部权限") }
                    TextButton(onClick = {
                        TaskAlarmScheduler.openNotificationSettings(context)
                    }) { Text("通知设置") }
                }
            }
        }
    }
}

@Composable
private fun MeAlarmBackgroundCard(context: Context) {
    val scheme = MaterialTheme.colorScheme
    var expanded by remember { mutableStateOf(false) }
    val arrowRotation by animateFloatAsState(if (expanded) 90f else 0f, label = "bgArrow")
    val ignored = TaskAlarmScheduler.isIgnoringBatteryOptimizations(context)
    val message = if (ignored) {
        "已放行系统电池优化。从最近任务划掉 App 通常仍会按时响铃；不要在系统设置中强行停止。"
    } else {
        "从最近任务划掉 App 通常仍会响铃，但国产 ROM 可能锁屏清理。请允许自启动、后台运行，并将电池管理设为不限制。"
    }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(AppShapes.Small)
            .background(scheme.secondaryContainer)
            .padding(10.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { expanded = !expanded },
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                "后台运行设置",
                fontWeight = FontWeight.Medium,
                fontSize = 13.sp,
                color = scheme.onSecondaryContainer,
                modifier = Modifier.weight(1f)
            )
            Icon(
                painter = painterResource(R.drawable.ic_chevron_right),
                contentDescription = null,
                tint = scheme.onSecondaryContainer,
                modifier = Modifier.size(16.dp).rotate(arrowRotation)
            )
        }
        AnimatedVisibility(visible = expanded) {
            Column {
                Spacer(Modifier.height(6.dp))
                Text(message, fontSize = 12.sp, color = scheme.onSurfaceVariant)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = {
                        if (!TaskAlarmScheduler.openBatteryOptimizationSettings(context)) {
                            android.widget.Toast.makeText(
                                context,
                                "无法打开电池设置",
                                android.widget.Toast.LENGTH_SHORT
                            ).show()
                        }
                    }) { Text("电池设置") }
                    TextButton(onClick = {
                        runCatching {
                            context.startActivity(TaskAlarmScheduler.applicationDetailsSettingsIntent(context))
                        }
                    }) { Text("应用详情") }
                }
            }
        }
    }
}

@Composable
private fun MeAlarmSettingWarning(text: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text,
            modifier = Modifier.weight(1f),
            color = MaterialTheme.colorScheme.error,
            fontSize = 12.sp
        )
        TextButton(onClick = onClick) { Text("去开启") }
    }
}

private fun meAlarmSubtitle(alarm: StoredTaskAlarm): String {
    val hour = alarm.minute / 60
    val minute = alarm.minute % 60
    val hourText = if (hour < 10) "0$hour" else hour.toString()
    val minuteText = if (minute < 10) "0$minute" else minute.toString()
    val server = alarm.baseUrl.removePrefix("https://").removePrefix("http://")
    if (TaskAlarmScheduler.isSnoozeAlarm(alarm)) {
        return "贪睡中 · ${alarm.dueDate} $hourText:$minuteText 再响\n$server"
    }
    return "${alarm.dueDate} $hourText:$minuteText · #${alarm.todoId}\n$server"
}

/** 白/暗色表面的分组卡片 + 1px 描边，对齐网页 .card。 */
@Composable
private fun MeGroup(content: @Composable () -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = AppShapes.Card,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column { content() }
    }
}

@Composable
private fun MeItem(
    @DrawableRes iconRes: Int,
    title: String,
    subtitle: String,
    badge: String? = null,
    divider: Boolean = false,
    tint: Color? = null,
    onClick: () -> Unit
) {
    val scheme = MaterialTheme.colorScheme
    val iconTint = tint ?: scheme.primary
    Column {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(horizontal = 14.dp, vertical = 13.dp),
            horizontalArrangement = Arrangement.spacedBy(13.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(34.dp)
                    .background(
                        if (tint != null) scheme.error.copy(alpha = 0.12f) else scheme.secondaryContainer,
                        CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    painter = painterResource(iconRes),
                    contentDescription = null,
                    tint = iconTint,
                    modifier = Modifier.size(18.dp)
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    title,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    color = if (tint != null) tint else scheme.onSurface
                )
                Text(
                    subtitle,
                    fontSize = 12.sp,
                    color = scheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            if (!badge.isNullOrBlank()) {
                Surface(
                    color = scheme.surfaceVariant,
                    shape = AppShapes.Pill
                ) {
                    Text(
                        text = badge,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        color = scheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }
            }
            Icon(
                painter = painterResource(R.drawable.ic_chevron_right),
                contentDescription = null,
                tint = scheme.onSurfaceVariant.copy(alpha = 0.6f),
                modifier = Modifier.size(18.dp)
            )
        }
        if (divider) {
            Box(
                Modifier
                    .padding(start = 61.dp)
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(scheme.outlineVariant)
            )
        }
    }
}
