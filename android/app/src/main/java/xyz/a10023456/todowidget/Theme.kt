package xyz.a10023456.todowidget

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/**
 * 原生端品牌主题，与网页新视觉语言对齐（src/web/layout.js 的 CSS token）：
 *  - 品牌主色 #7C3AED（对应网页 --brand-strong / --brand-grad 首段）
 *  - 中性白表面 + 1px 描边；暗色 #131319/#1D1E27；护眼沿用网页暖米底
 * 主题 key 与网页一致：light / dark / eye（Prefs.app_theme，由 MeScreen 切换后驱动重组）。
 */

private val Brand = Color(0xFF7C3AED)
private val BrandDark = Color(0xFFB97BFF)
private val BrandEye = Color(0xFF9333EA)

private val TintLight = Color(0xFFF3EEFE)
private val TintOnLight = Color(0xFF5B21B6)
private val TintDark = Color(0xFF3A2D57)
private val TintOnDark = Color(0xFFE9DDFF)

// 浅色：白底 + 浅灰描边
private val LightColors = lightColorScheme(
    primary = Brand,
    onPrimary = Color(0xFFFFFFFF),
    secondaryContainer = TintLight,
    onSecondaryContainer = TintOnLight,
    background = Color(0xFFF7F6F3),
    onBackground = Color(0xFF1B1D24),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF1B1D24),
    surfaceVariant = Color(0xFFF2F1EC),
    onSurfaceVariant = Color(0xFF5F6270),
    outline = Color(0xFFEAE8E1),
    outlineVariant = Color(0xFFE9ECF3)
)

// 暗色：与网页 data-theme=dark 同调
private val DarkColors = darkColorScheme(
    primary = BrandDark,
    onPrimary = Color(0xFF220049),
    secondaryContainer = TintDark,
    onSecondaryContainer = TintOnDark,
    background = Color(0xFF131319),
    onBackground = Color(0xFFECECF1),
    surface = Color(0xFF1D1E27),
    onSurface = Color(0xFFECECF1),
    surfaceVariant = Color(0xFF2A2B36),
    onSurfaceVariant = Color(0xFFA2A6B8),
    outline = Color(0xFF2D2F3C),
    outlineVariant = Color(0xFF2D2F3C)
)

// 护眼：暖米底 + 棕墨字（对应网页 [data-theme=eye]），品牌紫用更深的 #9333EA
private val EyeColors = lightColorScheme(
    primary = BrandEye,
    onPrimary = Color(0xFFFFFFFF),
    secondaryContainer = Color(0xFFF1E6F9),
    onSecondaryContainer = Color(0xFF6B21A8),
    background = Color(0xFFF3EEE0),
    onBackground = Color(0xFF4A4030),
    surface = Color(0xFFFBF8F0),
    onSurface = Color(0xFF4A4030),
    surfaceVariant = Color(0xFFF0EBDE),
    onSurfaceVariant = Color(0xFF7D7358),
    outline = Color(0xFFE3DBC4),
    outlineVariant = Color(0xFFE3DBC4)
)

@Composable
fun AppTheme(themeKey: String, content: @Composable () -> Unit) {
    val colors = when (themeKey) {
        "dark" -> DarkColors
        "eye" -> EyeColors
        else -> LightColors
    }
    MaterialTheme(colorScheme = colors, content = content)
}
