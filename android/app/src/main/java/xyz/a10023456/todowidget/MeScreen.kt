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
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** 「我的」原生菜单：与网页侧栏底部同一套图标与中性卡片语言。 */
@Composable
fun MeScreen(
    baseUrl: String,
    currentUrl: () -> String,
    onOpenPath: (String) -> Unit,
    onChangeBaseUrl: (String) -> Unit,
    onOpenInBrowser: () -> Unit,
    onThemeClick: () -> Unit,
    onLogout: () -> Unit
) {
    var showUrlDialog by remember { mutableStateOf(false) }
    var pendingUrl by remember { baseUrl }
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
            MeItem(R.drawable.ic_me_monitor, "网站监控", "查看定时任务与访问记录") { onOpenPath("/monitor") }
            MeItem(R.drawable.ic_me_channels, "通知渠道", "企业微信 / Webhook / 邮件", divider = true) { onOpenPath("/channels") }
            MeItem(R.drawable.ic_me_settings, "推送与设置", "日报推送、账号与系统设置", divider = true) { onOpenPath("/settings") }
            MeItem(R.drawable.ic_me_users, "用户管理", "管理员可用，切换身份/管理用户") { onOpenPath("/admin") }
        }

        Spacer(Modifier.height(12.dp))
        MeGroup {
            MeItem(R.drawable.ic_me_theme, "主题外观", "浅色 / 暗色 / 护眼，随账号同步") { onThemeClick() }
            MeItem(R.drawable.ic_me_browser, "在浏览器中打开", "用系统浏览器查看当前页面", divider = true) { onOpenInBrowser() }
            MeItem(R.drawable.ic_me_server, "服务器地址", baseUrl, divider = true) {
                pendingUrl = baseUrl
                showUrlDialog = true
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
