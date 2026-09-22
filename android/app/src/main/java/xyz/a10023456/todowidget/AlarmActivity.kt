package xyz.a10023456.todowidget

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.serialization.json.Json
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter

/** 闹钟全屏响铃页：强制深色大字，可在锁屏之上显示。 */
class AlarmActivity : ComponentActivity() {

    private var alarm: StoredTaskAlarm? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // 锁屏显示与点亮屏幕（API 27+）；API 26 走窗口 flags
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        alarm = readAlarm()

        setContent {
            AlarmScreen(
                alarm = alarm,
                onStop = {
                    sendCommand(AlarmRingingService.ACTION_STOP)
                    finish()
                },
                onSnooze = {
                    sendCommand(AlarmRingingService.ACTION_SNOOZE)
                    finish()
                },
                onDetail = { data ->
                    sendCommand(AlarmRingingService.ACTION_STOP)
                    // 测试闹钟没有真实任务，查看详情只回到待办页
                    val path = if (data.todoId == AlarmRingingService.TEST_ALARM_TODO_ID) {
                        "/todo"
                    } else {
                        "/todo?edit=" + Uri.encode(data.todoId)
                    }
                    val deep = Intent(this@AlarmActivity, MainActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                            Intent.FLAG_ACTIVITY_CLEAR_TOP or
                            Intent.FLAG_ACTIVITY_SINGLE_TOP
                        putExtra(Keys.Url.name, data.baseUrl + path)
                    }
                    startActivity(deep)
                    finish()
                }
            )
            // 返回键等同贪睡：避免误退后铃声继续无处可停（BackHandler 是 composable，必须在 setContent 内）
            BackHandler {
                sendCommand(AlarmRingingService.ACTION_SNOOZE)
                finish()
            }
        }

        // Service 超时/通知栏停铃后，页面同步关闭
        AlarmUiBus.listener = { event ->
            if (event == AlarmRingingService.EVENT_DISMISS) finish()
        }
    }

    private fun readAlarm(): StoredTaskAlarm? {
        val raw = intent.getStringExtra(AlarmRingingService.EXTRA_ALARM_JSON) ?: return null
        return runCatching {
            Json { ignoreUnknownKeys = true }
                .decodeFromString(StoredTaskAlarm.serializer(), raw)
        }.getOrNull()
    }

    private fun sendCommand(action: String) {
        val intent = Intent(this, AlarmRingingService::class.java).apply { this.action = action }
        runCatching { startService(intent) }
    }

    override fun onDestroy() {
        if (AlarmUiBus.listener != null) AlarmUiBus.listener = null
        super.onDestroy()
    }
}

// ---------- 颜色（强制深色，不随用户主题，保证锁屏可读） ----------

private val AlarmBg = Color(0xFF0E0E14)
private val AlarmSurface = Color(0xFF1A1B24)
private val AlarmText = Color(0xFFEDEDF2)
private val AlarmMuted = Color(0xFF9AA0B0)
private val AlarmAccent = Color(0xFFB97BFF)
private val AlarmDanger = Color(0xFFE5484D)

@Composable
private fun AlarmScreen(
    alarm: StoredTaskAlarm?,
    onStop: () -> Unit,
    onSnooze: () -> Unit,
    onDetail: (StoredTaskAlarm) -> Unit
) {
    Surface(color = AlarmBg, contentColor = AlarmText) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 22.dp, vertical = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            var now by remember { mutableStateOf(LocalTime.now()) }
            LaunchedEffect(Unit) {
                while (true) {
                    now = LocalTime.now()
                    delay(1000L)
                }
            }
            Text(
                now.format(DateTimeFormatter.ofPattern("HH:mm:ss")),
                fontSize = 46.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                color = AlarmAccent
            )
            // 临时诊断行：定位铃声链路问题后移除
            if (AlarmRingingService.lastRingDiagnostic.isNotEmpty()) {
                Spacer(Modifier.height(8.dp))
                Text(
                    AlarmRingingService.lastRingDiagnostic,
                    fontSize = 10.sp,
                    color = AlarmMuted,
                    textAlign = TextAlign.Start
                )
            }
            Spacer(Modifier.height(20.dp))
            Text(
                alarm?.title ?: "待办提醒",
                fontSize = 30.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(14.dp))
            MetaChips(alarm)
            Spacer(Modifier.height(22.dp))
            ChildrenSection(alarm)
            Spacer(Modifier.height(28.dp))

            Button(
                onClick = onStop,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(64.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = AlarmDanger,
                    contentColor = Color.White
                )
            ) {
                Text("停止", fontSize = 22.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.height(12.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedButton(
                    onClick = onSnooze,
                    modifier = Modifier
                        .weight(1f)
                        .height(52.dp),
                    shape = RoundedCornerShape(14.dp),
                    border = BorderStroke(1.dp, AlarmMuted)
                ) {
                    Text("贪睡 5 分钟", color = AlarmText, fontSize = 15.sp)
                }
                if (alarm != null) {
                    OutlinedButton(
                        onClick = { onDetail(alarm) },
                        modifier = Modifier
                            .weight(1f)
                            .height(52.dp),
                        shape = RoundedCornerShape(14.dp),
                        border = BorderStroke(1.dp, AlarmMuted)
                    ) {
                        Text("查看详情", color = AlarmText, fontSize = 15.sp)
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun MetaChips(alarm: StoredTaskAlarm?) {
    if (alarm == null) return
    val today = LocalDate.now()
    val chips = mutableListOf<String>()

    val due = runCatching { LocalDate.parse(alarm.dueDate) }.getOrNull()
    if (due != null) {
        val label = when (due) {
            today -> "📅 今天"
            today.plusDays(1) -> "📅 明天"
            else -> "📅 " + due.format(DateTimeFormatter.ofPattern("MM-dd"))
        }
        chips.add(label)
    }
    if (alarm.recurrence != null) chips.add("🔁 重复")
    if (alarm.category != null) chips.add("〔${alarm.category}〕")
    if (alarm.sharedCat) chips.add("👥 共享")
    alarm.priority?.let { p ->
        val name = when (p) {
            0 -> "⚪ 低"
            1 -> "🟡 中"
            2 -> "🔴 高"
            else -> null
        }
        if (name != null) chips.add("⭐ $name")
    }
    if (alarm.childDue) chips.add("🔀 各自截止")

    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        chips.forEach { chip ->
            Box(
                modifier = Modifier
                    .background(AlarmSurface, RoundedCornerShape(999.dp))
                    .padding(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Text(chip, color = AlarmMuted, fontSize = 14.sp)
            }
        }
    }
}

@Composable
private fun ChildrenSection(alarm: StoredTaskAlarm?) {
    if (alarm == null || alarm.children.isEmpty()) return
    val today = LocalDate.now()

    val total = alarm.children.size
    val pending = alarm.children.filter { !it.done }
    val doneCount = total - pending.size

    val focusOne = alarm.childDue
    val viewList = if (focusOne) {
        // 有自身日期者优先、日期升序，再按 id；只显示 1 项（与眼睛详情同规则）
        pending.sortedWith(
            compareBy(
                { it.dueDate == null },
                { it.dueDate ?: "" },
                { it.id }
            )
        ).take(1)
    } else {
        pending
    }

    Column(modifier = Modifier.fillMaxWidth()) {
        val headMeta = if (focusOne) {
            if (total > 1) "  共 $total 项，只显示最近到期 1 项" else ""
        } else {
            "  ${pending.size} 项待办" + if (doneCount > 0) " · $doneCount 项已完成" else ""
        }
        Text(
            (if (focusOne) "最近到期" else "子任务") + headMeta,
            color = AlarmText,
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold
        )
        Spacer(Modifier.height(10.dp))
        if (viewList.isEmpty()) {
            Text("🎉 子任务已全部完成", color = AlarmMuted, fontSize = 16.sp)
        } else {
            viewList.forEach { child -> ChildRow(child, today) }
        }
    }
}

@Composable
private fun ChildRow(child: TaskAlarmChild, today: LocalDate) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(20.dp)
                .border(1.5.dp, AlarmMuted, CircleShape)
        )
        Spacer(Modifier.width(12.dp))
        Text(
            child.title,
            color = AlarmText,
            fontSize = 17.sp,
            modifier = Modifier.weight(1f)
        )
        val due = child.dueDate?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
        if (due != null) {
            val label = when (due) {
                today -> "今天"
                today.plusDays(1) -> "明天"
                else -> due.format(DateTimeFormatter.ofPattern("MM-dd"))
            }
            Text(label, color = AlarmMuted, fontSize = 14.sp)
        }
    }
}
