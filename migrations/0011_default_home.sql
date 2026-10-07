-- 默认首页偏好：todo=待办（默认），dashboard=仪表盘
-- 手机浏览器 / App 登录落地页与底部「仪表盘」Tab 的显隐均据此
ALTER TABLE users ADD COLUMN default_home TEXT NOT NULL DEFAULT 'todo';
