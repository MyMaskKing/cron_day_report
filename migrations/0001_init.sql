-- 初始化建表脚本
-- 执行: wrangler d1 execute <DB_NAME> --file=migrations/0001_init.sql
-- 本地: wrangler d1 execute <DB_NAME> --local --file=migrations/0001_init.sql

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user',   -- 'user' | 'admin'
  status        TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'disabled'
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 通知渠道表
CREATE TABLE IF NOT EXISTS notify_channels (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'wechat',  -- 'wechat' | 'webhook' | 'email'
  url           TEXT NOT NULL,
  method        TEXT NOT NULL DEFAULT 'POST',
  headers_json  TEXT,                            -- 自定义请求头 JSON
  body_template TEXT,                            -- 自定义 body 模板, 含 {{content}} 占位符
  enabled       INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_notify_channels_user ON notify_channels(user_id);

-- 监控任务表
CREATE TABLE IF NOT EXISTS monitor_tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  return_type TEXT NOT NULL DEFAULT 'text',      -- 'text' | 'html'
  channel_id  INTEGER,                           -- 关联通知渠道, 可空
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
CREATE TABLE IF NOT EXISTS funds (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  code       TEXT NOT NULL,                      -- 基金代码
  name       TEXT,                               -- 基金名称
  shares     REAL NOT NULL DEFAULT 0,            -- 持有份额
  cost_nav   REAL NOT NULL DEFAULT 0,            -- 持仓成本净值
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_funds_user ON funds(user_id);

-- 基金净值缓存表
CREATE TABLE IF NOT EXISTS fund_nav_cache (
  code       TEXT PRIMARY KEY,
  nav        REAL,                               -- 最新单位净值
  gsz        REAL,                               -- 估算净值
  nav_date   TEXT,                               -- 净值日期
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 基金日报配置表
CREATE TABLE IF NOT EXISTS fund_report_config (
  user_id    INTEGER PRIMARY KEY,
  channel_id INTEGER,
  format     TEXT NOT NULL DEFAULT 'text',       -- 'text' | 'html'
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
CREATE TABLE IF NOT EXISTS weight_records (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id   INTEGER NOT NULL,
  user_id     INTEGER NOT NULL,
  weight      REAL NOT NULL,
  record_date TEXT NOT NULL,                     -- YYYY-MM-DD
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (member_id) REFERENCES weight_members(id)
);
CREATE INDEX IF NOT EXISTS idx_weight_records_member ON weight_records(member_id);
CREATE INDEX IF NOT EXISTS idx_weight_records_date ON weight_records(record_date);
