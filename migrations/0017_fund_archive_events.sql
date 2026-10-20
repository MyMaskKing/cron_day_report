-- 基金封存/解封事件流水（只追加）：供每日总收益曲线在口径切换日打竖线标记
-- action: archive=封存 | unarchive=解封；fund_name 存名称快照，基金删除/改名后标记仍可读
CREATE TABLE IF NOT EXISTS fund_archive_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  fund_id    INTEGER NOT NULL,
  fund_name  TEXT NOT NULL DEFAULT '',
  action     TEXT NOT NULL,
  event_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_fae_user_date ON fund_archive_events(user_id, event_date);
