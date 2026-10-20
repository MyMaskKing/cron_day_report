-- 资产月度异常分析：用户按月填写的 Markdown 复盘，不参与任何统计
CREATE TABLE IF NOT EXISTS asset_analyses (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  month      TEXT NOT NULL,
  content    TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, month)
);
CREATE INDEX IF NOT EXISTS idx_asset_analyses_user ON asset_analyses(user_id);
