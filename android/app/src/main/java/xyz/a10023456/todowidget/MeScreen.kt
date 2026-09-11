package xyz.a10023456.todowidget

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** 「我的」原生菜单：其余模块入口、地址设置、在浏览器打开、退出登录。 */
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
    var pendingUrl by remember { mutableStateOf(baseUrl) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(vertical = 8.dp)
    ) {
        Text(
            "我的",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp)
        )
        MeItem("🖥️", "网站监控", "查看定时任务与访问记录") { onOpenPath("/monitor") }
        MeItem("🔔", "通知渠道", "企业微信 / Webhook / 邮件") { onOpenPath("/channels") }
        MeItem("⚙️", "推送与设置", "日报推送、账号与系统设置") { onOpenPath("/settings") }
        MeItem("👑", "用户管理", "管理员可用，切换身份/管理用户") { onOpenPath("/admin") }
        HorizontalDivider()
        MeItem("🎨", "主题外观", "浅色 / 暗色 / 护眼，随账号同步") { onThemeClick() }
        MeItem("🌐", "在浏览器中打开", "用系统浏览器查看当前页面") { onOpenInBrowser() }
        MeItem("🔗", "服务器地址", baseUrl) {
            pendingUrl = baseUrl
            showUrlDialog = true
        }
        MeItem("🚪", "退出登录", "清除本机登录态") { onLogout() }

        Spacer(Modifier.height(20.dp))
        Text(
            "生活清单 v1.0 · $baseUrl",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(horizontal = 20.dp)
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

@Composable
private fun MeItem(emoji: String, title: String, subtitle: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(14.dp),
        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
    ) {
        Text(emoji, fontSize = 20.sp)
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyLarge)
            Text(
                subtitle,
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
