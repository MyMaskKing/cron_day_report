-- 同一基金同一天多次封存/解封只保留最后一次（后者覆盖前者），避免曲线同一位置出现矛盾标记
-- 先清理可能存在的同日重复（保留 id 最大的最后一次），再建唯一索引（防重复数据导致建索引失败卡住迁移）
DELETE FROM fund_archive_events
WHERE id NOT IN (
  SELECT MAX(id) FROM fund_archive_events GROUP BY user_id, fund_id, event_date
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fae_user_fund_date
  ON fund_archive_events(user_id, fund_id, event_date);
