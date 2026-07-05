-- 迁移 0002: 基金持仓增加免密快速加仓 token
-- 执行: wrangler d1 execute <DB_NAME> --remote --file=migrations/0002_fund_share_token.sql

-- 免密加仓分享 token（长期有效，日报固定链接使用）
ALTER TABLE funds ADD COLUMN share_token TEXT;

CREATE INDEX IF NOT EXISTS idx_funds_share_token ON funds(share_token);
