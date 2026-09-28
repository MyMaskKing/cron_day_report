-- 0009: 待办全屏背景（内置渐变 id；空串 = 默认奶白，仅待办全屏生效）
-- 合法值：''(默认奶白) / aurora 极光 / dawn 晨霞 / matcha 抹茶 / sea 海盐 / dusk 暮色
ALTER TABLE users ADD COLUMN todo_bg_theme TEXT NOT NULL DEFAULT '';
