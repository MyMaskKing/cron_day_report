package xyz.a10023456.todowidget

import android.content.Context
import androidx.annotation.DrawableRes
import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** 「我的」原生菜单：与网页侧栏底部同一套图标与中性卡片语言。 */
@Composable
fun MeScreen(
    baseUrl: String,
    currentUrl: () -> String,
    isAdmin: Boolean,
    onOpenPath: (String) -> Unit,
    onChangeBaseUrl: (String) -> Unit,
    onOpenInBrowser: () -> Unit,
    onThemeClick: () -> Unit,
    onTestNotification: () -> Unit,
    onLogout: () -> Unit
) {
    var showUrlDialog by remember { mutableStateOf(false) }
    var pendingUrl by remember { mutableStateOf(baseUrl) }
    val appContext = LocalContext.current.applicationContext
    var showAlarmManager by remember { mutableStateOf(false) }
    var taskAlarms by remember { mutableStateOf(TaskAlarmScheduler.listAlarms(appContext)) }
    var pendingDeleteAlarm by remember { mutableStateOf<StoredTaskAlarm?>(null) }
    val scheme = MaterialTheme.colorScheme

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

        MeGroup {
            MeItem(R.drawable.ic_me_dashboard, "仪表盘", "今日概览与功能入口") { onOpenPath("/dashboard") }
            MeItem(R.drawable.ic_me_monitor, "网站监控", "查看定时任务与访问记录", divider = true) { onOpenPath("/monitor") }
            MeItem(R.drawable.ic_me_channels, "通知渠道", "企业微信 / Webhook / 邮件", divider = true) { onOpenPath("/channels") }
            // 「推送与设置」仅当下方还有用户管理项时才画分隔线（末项不画）
            MeItem(R.drawable.ic_me_settings, "推送与个人设置", "日报推送、个人账号与系统设置", divider = isAdmin) { onOpenPath("/settings") }
            // 用户管理仅超管可见；普通用户不渲染入口（服务端 /admin 另有兜底拦截）
            if (isAdmin) {
                MeItem(R.drawable.ic_me_users, "用户管理", "管理员可用，切换身份/管理用户") { onOpenPath("/admin") }
            }
        }

        Spacer(Modifier.height(12.dp))
        MeGroup {
            MeItem(R.drawable.ic_chip_today, "闹钟管理", "查看并删除本机待办闹钟", divider = true) {
                taskAlarms = TaskAlarmScheduler.listAlarms(appContext)
                showAlarmManager = true
            }
            MeItem(R.drawable.ic_me_theme, "主题外观", "浅色 / 暗色 / 护眼，随账号同步") { onThemeClick() }
            MeItem(R.drawable.ic_me_browser, "在浏览器中打开", "用系统浏览器查看当前页面", divider = true) { onOpenInBrowser() }
            MeItem(R.drawable.ic_me_server, "服务器地址", baseUrl, divider = true) {
                pendingUrl = baseUrl
                showUrlDialog = true
            }
            if (isAdmin) {
                MeItem(R.drawable.ic_chip_today, "测试通知", "拉取真实待办数据并发送提醒") { onTestNotification() }
            }
        }

        Spacer(Modifier.height(12.dp))
        MeGroup {
            MeItem(R.drawable.ic_me_logout, "退出登录", "清除本机登录态", tint = scheme.error) { onLogout() }
        }

        Spacer(Modifier.height(16.dp))
        Text(
            "生活清单 v1.0 · $baseUrl",
            fontSize = 12.sp,
            color = scheme.onSurfaceVariant,
            modifier = Modifier.padding(horizontal = 4.dp)
        )
    }

    if (showUrlDialog) {
        AlertDialog(
            onDismissRequest = { showUrlDialog = false },
            title = { Text("修改服务器地址") },
            text = {
                OutlinedTextField(
                    value = pendingUrl,
                    onValueChange = { pendingUrl = it },
                    label = { Text("http(s)://...") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    val v = pendingUrl.trim().trimEnd('/')
                    if (v.startsWith("https://") || v.startsWith("http://")) {
                        onChangeBaseUrl(v)
                        showUrlDialog = false
                    }
                }) { Text("保存") }
            },
            dismissButton = {
                TextButton(onClick = { showUrlDialog = false }) { Text("取消") }
            }
        )
    }

    if (showAlarmManager) {
        AlertDialog(
            onDismissRequest = { showAlarmManager = false },
            title = { Text("闹钟管理") },
            text = {
                Column(
                    modifier = Modifier
                        .heightIn(max = 420.dp)
                        .verticalScroll(rememberScrollState())
                ) {
                    // 确保系统通知设置里存在「待办闹钟」渠道（幂等，已存在立即返回）
                    TaskAlarmScheduler.createChannel(appContext)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            "响铃、震动与音量",
                            modifier = Modifier.weight(1f),
                            fontWeight = FontWeight.Medium
                        )
                        TextButton(onClick = {
                            AlarmRingingService.startTest(appContext)
                        }) { Text("测试") }
                        TextButton(onClick = {
                            if (!TaskAlarmScheduler.openAlarmChannelSettings(appContext)) {
                                TaskAlarmScheduler.openNotificationSettings(appContext)
                            }
                        }) { Text("设置") }
                    }
                    Text(
                        "测试按真实闹钟试听；铃声、震动点「设置」修改；音量用手机的“闹钟音量”调节。",
                        fontSize = 12.sp,
                        color = scheme.onSurfaceVariant
                    )
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
                            // 闹钟必须挂在具体任务上：跳到待办页，新建/编辑任务时用 🔔 按钮设置
                            val intent = android.content.Intent(appContext, MainActivity::class.java).apply {
                                flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK or
                                    android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP
                                putExtra(Keys.Url.name, AppConfig.getBaseUrl(appContext) + "/todo")
                            }
                            appContext.startActivity(intent)
                            showAlarmManager = false
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) { Text("＋ 去待办页设置闹钟") }
                    if (taskAlarms.isEmpty()) {
                        Spacer(Modifier.height(10.dp))
                        Text("本机暂无待办闹钟。")
                    } else {
                        taskAlarms.forEach { alarm ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 6.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        alarm.title,
                                        fontWeight = FontWeight.Medium,
                                        maxLines = 1,
                                        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                                    )
                                    Spacer(Modifier.height(2.dp))
                                    Text(
                                        meAlarmSubtitle(alarm),
                                        fontSize = 12.sp,
                                        color = scheme.onSurfaceVariant
                                    )
                                }
                                TextButton(onClick = { pendingDeleteAlarm = alarm }) {
                                    Text("删除")
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showAlarmManager = false }) { Text("关闭") }
            }
        )
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
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp)
            .background(scheme.secondaryContainer, RoundedCornerShape(8.dp))
            .padding(8.dp)
    ) {
        Text("锁屏与通知权限说明", fontWeight = FontWeight.Medium)
        Spacer(Modifier.height(4.dp))
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

@Composable
private fun MeAlarmBackgroundCard(context: Context) {
    val scheme = MaterialTheme.colorScheme
    val ignored = TaskAlarmScheduler.isIgnoringBatteryOptimizations(context)
    val message = if (ignored) {
        "已放行系统电池优化。从最近任务划掉 App 通常仍会按时响铃；不要在系统设置中强行停止。"
    } else {
        "从最近任务划掉 App 通常仍会响铃，但国产 ROM 可能锁屏清理。请允许自启动、后台运行，并将电池管理设为不限制。"
    }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp)
            .background(scheme.secondaryContainer, RoundedCornerShape(8.dp))
            .padding(8.dp)
    ) {
        Text("后台运行设置", fontWeight = FontWeight.Medium)
        Spacer(Modifier.height(4.dp))
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

@Composable
private fun MeAlarmSettingWarning(text: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp),
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
    // 贪睡瞬态记录：标注再响时间，不显示内部 id
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
        shape = RoundedCornerShape(14.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
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
    divider: Boolean = false,
    tint: androidx.compose.ui.graphics.Color? = null,
    onClick: () -> Unit
) {
    // 默认图标色取品牌 primary；不能写在参数默认值里（默认表达式不是 @Composable 上下文）
    val iconTint = tint ?: MaterialTheme.colorScheme.primary
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
                    .size(32.dp)
                    .background(MaterialTheme.colorScheme.secondaryContainer, CircleShape),
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
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    subtitle,
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        if (divider) {
            Box(
                Modifier
                    .padding(start = 59.dp)
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(MaterialTheme.colorScheme.outlineVariant)
            )
        }
    }
}
