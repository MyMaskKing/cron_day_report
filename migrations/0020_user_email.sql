-- 0020: 用户邮箱（可选；用于注册/换绑的验证码校验、邮箱登录与找回密码）
-- email 在应用层 trim + 转小写归一化后存储；NULL = 未绑定。
-- 非空邮箱即视为已验证：唯一写入入口（注册验码 / 登录后换绑验码）强制 6 位验证码校验。
ALTER TABLE users ADD COLUMN email TEXT;

-- 邮箱唯一：partial index 仅约束非空邮箱，多个 NULL（未绑定）互不冲突
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
