-- 免密公开页「用本人账号登录」按钮显隐偏好：1=显示(默认)，0=隐藏
-- 仅控制免密页按钮是否输出，不影响 /api/public/quick-login 接口本身
ALTER TABLE users ADD COLUMN show_quicklogin_btn INTEGER NOT NULL DEFAULT 1;
