-- 免密快速登录访问限制开关
-- 1=开启（免密登录仅能访问对应模块页），默认开启
ALTER TABLE users ADD COLUMN restrict_quicklogin INTEGER NOT NULL DEFAULT 1;
