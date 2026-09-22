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
import androidx.compose.foundation.layout.BoxWithConstraints
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
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.serialization.json.Json
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter

/** 闹钟全屏响铃页：深色玻璃风（A 方案），可在锁屏之上显示。 */
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
                    // 测试闹钟/贪睡瞬态没有真实任务，查看详情只回到待办页
                    val path = when {
                        data.todoId == AlarmRingingService.TEST_ALARM_TODO_ID ||
                            data.todoId.startsWith(TaskAlarmScheduler.SNOOZE_TODO_PREFIX) -> "/todo"
                        else -> "/todo?edit=" + Uri.encode(data.todoId)
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
            // 返回键等同再等一会：避免误退后铃声继续无处可停（BackHandler 是 composable，必须在 setContent 内）
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

// ---------- A 方案配色（强制深色，不随用户主题，保证锁屏可读） ----------

private val AlarmBg = Color(0xFF14141E)
private val GlassColor = Color(0xFF1E2230).copy(alpha = .62f)
private val GlassBorder = Color.White.copy(alpha = .08f)
private val AlarmText = Color(0xFFF2F3F8)
private val AlarmMuted = Color(0xFF8A90A6)
private val AccentText = Color(0xFFC9A4FF)
private val AccentBorder = Color(0xFFB97BFF).copy(alpha = .5f)
private val ChipColor = Color(0xFFA855F7).copy(alpha = .18f)
private val DangerBrush = Brush.horizontalGradient(listOf(Color(0xFFDC2626), Color(0xFFB91C1C)))

@Composable
private fun AlarmScreen(
    alarm: StoredTaskAlarm?,
    onStop: () -> Unit,
    onSnooze: () -> Unit,
    onDetail: (StoredTaskAlarm) -> Unit
) {
    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(AlarmBg)
    ) {
        // 背景氛围光：drawWithCache 在尺寸确定后按比例定位（Offset/Float 为 radialGradient 真实签名）
        Box(Modifier.matchParentSize().alarmGlow(
            Color(0xFFA855F7).copy(alpha = .30f),
            centerRatioX = .85f, centerRatioY = .08f, radiusRatio = .7f
        ))
        Box(Modifier.matchParentSize().alarmGlow(
            Color(0xFF3B82F6).copy(alpha = .18f),
            centerRatioX = .05f, centerRatioY = .62f, radiusRatio = .7f
        ))
        Box(Modifier.matchParentSize().alarmGlow(
            Color(0xFFFF7A59).copy(alpha = .13f),
            centerRatioX = .10f, centerRatioY = .30f, radiusRatio = .6f
        ))

        // 玻璃面板
        Column(
            modifier = Modifier
                .padding(14.dp)
                .fillMaxSize()
                .background(GlassColor, RoundedCornerShape(26.dp))
                .border(1.dp, GlassBorder, RoundedCornerShape(26.dp))
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 22.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            var now by remember { mutableStateOf(LocalTime.now()) }
            LaunchedEffect(Unit) {
                while (true) {
                    now = LocalTime.now()
                    delay(1000L)
                }
            }

            // 顶栏：闹钟徽章 + 日期
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    Modifier
                        .background(ChipColor, RoundedCornerShape(999.dp))
                        .padding(horizontal = 11.dp, vertical = 5.dp)
                ) {
                    Text("⏰ 待办闹钟", color = AccentText, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold)
                }
                Text(
                    LocalDate.now().format(DateTimeFormatter.ofPattern("M月d日 EEEE")),
                    color = AlarmMuted,
                    fontSize = 12.sp
                )
            }

            Spacer(Modifier.height(18.dp))

            // 当前时间（大字，C 方案样式）
            Text(
                now.format(DateTimeFormatter.ofPattern("HH:mm")),
                fontSize = 54.sp,
                fontWeight = FontWeight.Bold,
                color = AlarmText,
                lineHeight = 56.sp
            )

            Spacer(Modifier.height(18.dp))

            Text(
                alarm?.title ?: "待办提醒",
                fontSize = 21.sp,
                fontWeight = FontWeight.Bold,
                color = AlarmText,
                textAlign = TextAlign.Center,
                lineHeight = 28.sp
            )

            Spacer(Modifier.height(13.dp))

            if (alarm != null) MetaChips(alarm)

            Spacer(Modifier.height(20.dp))

            ChildrenSection(alarm)

            Spacer(Modifier.height(24.dp))

            // 停止（红色渐变，主操作）
            Button(
                onClick = onStop,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(60.dp)
                    .background(DangerBrush, RoundedCornerShape(14.dp)),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color.Transparent,
                    contentColor = Color.White
                )
            ) {
                Text("停止", fontSize = 19.sp, fontWeight = FontWeight.Bold)
            }

            Spacer(Modifier.height(10.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // 再等一会（贪睡 5 分钟）
                OutlinedButton(
                    onClick = onSnooze,
                    modifier = Modifier
                        .weight(1f)
                        .height(50.dp),
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, AccentBorder),
                    colors = ButtonDefaults.outlinedButtonColors(
                        containerColor = Color.Transparent,
                        contentColor = AccentText
                    )
                ) {
                    Text("再等一会", fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                }
                // 查看详情（弱化为纯文字）
                if (alarm != null) {
                    TextButton(
                        onClick = { onDetail(alarm) },
                        modifier = Modifier
                            .weight(1f)
                            .height(50.dp)
                    ) {
                        Text("查看详情", color = AlarmMuted, fontSize = 13.sp)
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun MetaChips(alarm: StoredTaskAlarm) {
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
                    .background(ChipColor, RoundedCornerShape(999.dp))
                    .padding(horizontal = 11.dp, vertical = 5.dp)
            ) {
                Text(chip, color = AccentText, fontSize = 12.sp, fontWeight = FontWeight.Medium)
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
            color = AlarmMuted,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold
        )
        Spacer(Modifier.height(8.dp))
        if (viewList.isEmpty()) {
            Text("🎉 子任务已全部完成", color = AlarmMuted, fontSize = 15.sp)
        } else {
            viewList.forEach { child -> ChildRow(child, today) }
        }
    }
}

/**
 * 在当前节点范围内绘制一团径向氛围光：中心按画布尺寸比例定位，
 * 半径取较短边的 radiusRatio；drawWithCache 使尺寸变化时才重建 Brush。
 */
private fun Modifier.alarmGlow(
    glowColor: Color,
    centerRatioX: Float,
    centerRatioY: Float,
    radiusRatio: Float
): Modifier = drawWithCache {
    val brush = Brush.radialGradient(
        colors = listOf(glowColor, Color.Transparent),
        center = Offset(size.width * centerRatioX, size.height * centerRatioY),
        radius = size.minDimension * radiusRatio
    )
    onDrawBehind { drawRect(brush) }
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
                .size(19.dp)
                .border(1.5.dp, Color(0xFF5A6280), CircleShape)
        )
        Spacer(Modifier.width(11.dp))
        Text(
            child.title,
            color = Color(0xFFD6D9E6),
            fontSize = 14.sp,
            modifier = Modifier.weight(1f)
        )
        val due = child.dueDate?.let { runCatching { LocalDate.parse(it) }.getOrNull() }
        if (due != null) {
            val label = when (due) {
                today -> "今天"
                today.plusDays(1) -> "明天"
                else -> due.format(DateTimeFormatter.ofPattern("MM-dd"))
            }
            Text(label, color = AlarmMuted, fontSize = 12.sp)
        }
    }
}
