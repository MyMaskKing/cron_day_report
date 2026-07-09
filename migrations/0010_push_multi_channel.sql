-- 迁移 0010: 推送配置支持绑定多个通知渠道
-- 执行: wrangler d1 execute <DB_NAME> --remote --file=migrations/0010_push_multi_channel.sql
-- channel_ids: 逗号分隔的渠道 id 列表, 如 "1,3"
-- 保留旧 channel_id 列存首值兼容, 迁移其值到新列

ALTER TABLE push_config ADD COLUMN channel_ids TEXT;

UPDATE push_config SET channel_ids = CAST(channel_id AS TEXT) WHERE channel_ids IS NULL AND channel_id IS NOT NULL;
