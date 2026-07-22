-- 用户表增加投资策略字段（Markdown 格式，每个用户一条）
ALTER TABLE users ADD COLUMN investment_strategy TEXT;