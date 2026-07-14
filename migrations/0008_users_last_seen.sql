-- users 表新增最后登录/最后免密访问时间列
-- 用于超管用户管理页查看用户活跃度
-- 值均以 UTC 存储(datetime('now') 结果), 前端按全局时区偏移换算显示
-- 注释独立成行以兼容 D1 控制台逐条执行
ALTER TABLE users ADD COLUMN last_login_at TEXT;
ALTER TABLE users ADD COLUMN last_public_at TEXT;
