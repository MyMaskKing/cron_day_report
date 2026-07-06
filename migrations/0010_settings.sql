-- 迁移 0010: 全局应用设置表（键值对）
-- 执行: wrangler d1 execute cron_db --remote --file=migrations/0010_settings.sql
-- 本地: wrangler d1 execute cron_db --local --file=migrations/0010_settings.sql
-- 用途: 存放平台级全局配置, 目前用于时区偏移 tz_offset
-- tz_offset: 相对 UTC 的小时偏移, 中国为 8; 影响所有推送/显示时间的换算

CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

INSERT OR IGNORE INTO app_settings (key, value) VALUES ('tz_offset', '8');
