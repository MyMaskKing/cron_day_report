-- 迁移 0003: 体重成员增加免密快速填写 token
-- 执行: wrangler d1 execute <DB_NAME> --remote --file=migrations/0003_weight_share_token.sql

ALTER TABLE weight_members ADD COLUMN share_token TEXT;

CREATE INDEX IF NOT EXISTS idx_weight_members_share_token ON weight_members(share_token);
