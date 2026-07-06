-- 迁移 0009: 推送配置支持多选时间/日 + 报告免密 token
-- 执行: wrangler d1 execute <DB_NAME> --remote --file=migrations/0009_push_multi.sql
-- hours: 逗号分隔的小时列表, 如 "9,18"; days: 逗号分隔的日列表, 如 "1,15"
-- report_token: 该用户该模块的免密报告查看链接 token
-- 保留旧 hour/day 列不再使用, 迁移其值到新列

ALTER TABLE push_config ADD COLUMN hours TEXT;
ALTER TABLE push_config ADD COLUMN days TEXT;
ALTER TABLE push_config ADD COLUMN report_token TEXT;

UPDATE push_config SET hours = CAST(hour AS TEXT) WHERE hours IS NULL;
UPDATE push_config SET days = CAST(day AS TEXT) WHERE days IS NULL;
