-- 基金每日总收益快照
-- 每天 15 点定时刷新净值后，为每个有持仓的用户记录当日 本金/现值/总收益
-- 同一用户同一天仅一条（重复则覆盖），供曲线图/表格/推送差额读取
CREATE TABLE IF NOT EXISTS fund_profit_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  record_date TEXT NOT NULL,
  cost REAL NOT NULL DEFAULT 0,
  value REAL NOT NULL DEFAULT 0,
  profit REAL NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fpd_user_date ON fund_profit_daily (user_id, record_date);
