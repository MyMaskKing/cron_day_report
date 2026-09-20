package xyz.a10023456.todowidget

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
                if (taskAlarms.isEmpty()) {
                    Text("本机暂无待办闹钟。")
                } else {
                    Column(
                        modifier = Modifier
                            .heightIn(max = 420.dp)
                            .verticalScroll(rememberScrollState())
                    ) {
                        if (!TaskAlarmScheduler.canScheduleExactAlarms(appContext)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    "精确闹钟权限未开启",
                                    modifier = Modifier.weight(1f),
                                    color = scheme.error,
                                    fontSize = 12.sp
                                )
                                TextButton(onClick = {
                                    TaskAlarmScheduler.openExactAlarmSettings(appContext)
                                }) { Text("去开启") }
                            }
                        }
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

private fun meAlarmSubtitle(alarm: StoredTaskAlarm): String {
    val hour = alarm.minute / 60
    val minute = alarm.minute % 60
    val hourText = if (hour < 10) "0$hour" else hour.toString()
    val minuteText = if (minute < 10) "0$minute" else minute.toString()
    val server = alarm.baseUrl.removePrefix("https://").removePrefix("http://")
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
