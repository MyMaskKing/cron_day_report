-- 初始化建表脚本
-- 执行: wrangler d1 execute <DB_NAME> --remote --file=migrations/0001_init.sql
-- 本地: wrangler d1 execute <DB_NAME> --local --file=migrations/0001_init.sql
-- 注意: 所有注释独立成行, 不使用行内注释, 以兼容 D1 控制台逐条/合并执行

-- 用户表
-- role: user | admin  status: active | disabled
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user',
  status        TEXT NOT NULL DEFAULT 'active',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 通知渠道表
-- type: wechat | webhook | email
-- headers_json: 自定义请求头 JSON
-- body_template: 自定义 body 模板, 含 {{content}} 占位符
CREATE TABLE IF NOT EXISTS notify_channels (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'wechat',
  url           TEXT NOT NULL,
  method        TEXT NOT NULL DEFAULT 'POST',
  headers_json  TEXT,
  body_template TEXT,
  enabled       INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_notify_channels_user ON notify_channels(user_id);

-- 监控任务表
-- return_type: text | html
-- channel_id: 关联通知渠道, 可空
CREATE TABLE IF NOT EXISTS monitor_tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  return_type TEXT NOT NULL DEFAULT 'text',
  channel_id  INTEGER,
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_monitor_tasks_user ON monitor_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_monitor_tasks_enabled ON monitor_tasks(enabled);

-- 监控执行日志表
CREATE TABLE IF NOT EXISTS monitor_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id       INTEGER NOT NULL,
  user_id       INTEGER NOT NULL,
  success       INTEGER NOT NULL DEFAULT 0,
  status        TEXT,
  status_text   TEXT,
  response_time INTEGER,
  response_size INTEGER,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (task_id) REFERENCES monitor_tasks(id)
);
CREATE INDEX IF NOT EXISTS idx_monitor_logs_task ON monitor_logs(task_id);

-- 基金持仓表
-- shares: 持有份额  cost_nav: 持仓成本净值
-- 本金=shares*cost_nav  现值=shares*最新净值  收益=现值-本金
CREATE TABLE IF NOT EXISTS funds (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  code       TEXT NOT NULL,
  name       TEXT,
  shares     REAL NOT NULL DEFAULT 0,
  cost_nav   REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_funds_user ON funds(user_id);

-- 基金净值缓存表
-- nav: 最新单位净值  gsz: 估算净值  nav_date: 净值日期
CREATE TABLE IF NOT EXISTS fund_nav_cache (
  code       TEXT PRIMARY KEY,
  nav        REAL,
  gsz        REAL,
  nav_date   TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 基金日报配置表
-- format: text | html
CREATE TABLE IF NOT EXISTS fund_report_config (
  user_id    INTEGER PRIMARY KEY,
  channel_id INTEGER,
  format     TEXT NOT NULL DEFAULT 'text',
  enabled    INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 体重成员表
CREATE TABLE IF NOT EXISTS weight_members (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_weight_members_user ON weight_members(user_id);

-- 体重记录表
-- record_date: YYYY-MM-DD
CREATE TABLE IF NOT EXISTS weight_records (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id   INTEGER NOT NULL,
  user_id     INTEGER NOT NULL,
  weight      REAL NOT NULL,
  record_date TEXT NOT NULL,
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (member_id) REFERENCES weight_members(id)
);
CREATE INDEX IF NOT EXISTS idx_weight_records_member ON weight_records(member_id);
CREATE INDEX IF NOT EXISTS idx_weight_records_date ON weight_records(record_date);
