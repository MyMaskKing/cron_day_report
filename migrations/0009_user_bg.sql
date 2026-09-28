-- 0009: 用户界面背景（内置渐变 id；空串 = 默认，登录态全局生效）
-- 合法值：''(默认) / aurora 极光 / dawn 晨霞 / matcha 抹茶 / sea 海盐 / dusk 暮色
ALTER TABLE users ADD COLUMN bg_theme TEXT NOT NULL DEFAULT '';
