-- 完整建库脚本（合并原 0001-0011 全部迁移）
-- 执行: wrangler d1 execute cron_db --remote --file=migrations/0001_schema.sql
-- 本地: wrangler d1 execute cron_db --local --file=migrations/0001_schema.sql
-- 注意: 所有注释独立成行, 不使用行内注释, 以兼容 D1 控制台逐条/合并执行
-- 全部 CREATE 用 IF NOT EXISTS, 数据初始化用 INSERT OR IGNORE, 对已部署库重跑安全

-- ==================== 用户 ====================
-- role: user | admin  status: active | disabled
-- weight_unit: jin(斤, 默认) | kg(公斤), 库内统一存公斤, 显示按此偏好换算(1公斤=2斤)
-- nickname: 显示用昵称, 可改; username 为登录名不可改
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user',
  status        TEXT NOT NULL DEFAULT 'active',
  weight_unit   TEXT NOT NULL DEFAULT 'jin',
  nickname      TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ==================== 通知渠道 ====================
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

-- ==================== 监控任务 ====================
-- return_type: text | html
-- channel_id: 关联通知渠道, 可空
-- standalone=1: 该任务结果单独一条消息发送; =0(默认): 与同渠道其他任务合并发送
CREATE TABLE IF NOT EXISTS monitor_tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  return_type TEXT NOT NULL DEFAULT 'text',
  channel_id  INTEGER,
  enabled     INTEGER NOT NULL DEFAULT 1,
  standalone  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_monitor_tasks_user ON monitor_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_monitor_tasks_enabled ON monitor_tasks(enabled);

-- ==================== 监控执行日志 ====================
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

-- ==================== 基金持仓 ====================
-- shares: 持有份额  cost_nav: 持仓成本净值
-- 本金=shares*cost_nav  现值=shares*最新净值  收益=现值-本金
-- share_token: 免密快速加仓分享 token, 长期有效
CREATE TABLE IF NOT EXISTS funds (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  code        TEXT NOT NULL,
  name        TEXT,
  shares      REAL NOT NULL DEFAULT 0,
  cost_nav    REAL NOT NULL DEFAULT 0,
  share_token TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_funds_user ON funds(user_id);
CREATE INDEX IF NOT EXISTS idx_funds_share_token ON funds(share_token);

-- ==================== 基金净值缓存 ====================
-- nav: 最新单位净值  gsz: 估算净值  nav_date: 净值日期
CREATE TABLE IF NOT EXISTS fund_nav_cache (
  code       TEXT PRIMARY KEY,
  nav        REAL,
  gsz        REAL,
  nav_date   TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ==================== 基金日报配置（旧, 保留兼容, 已迁移至 push_config） ====================
-- format: text | html
CREATE TABLE IF NOT EXISTS fund_report_config (
  user_id    INTEGER PRIMARY KEY,
  channel_id INTEGER,
  format     TEXT NOT NULL DEFAULT 'text',
  enabled    INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ==================== 基金每日总收益快照 ====================
-- 每天 15 点刷新净值后, 为每个有持仓的用户记录当日 本金/现值/总收益
-- 同一用户同一天仅一条(重复覆盖), 供曲线图/表格/推送差额读取
CREATE TABLE IF NOT EXISTS fund_profit_daily (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  record_date TEXT NOT NULL,
  cost        REAL NOT NULL DEFAULT 0,
  value       REAL NOT NULL DEFAULT 0,
  profit      REAL NOT NULL DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fpd_user_date ON fund_profit_daily (user_id, record_date);

-- ==================== 体重成员 ====================
-- share_token: 免密快速填写链接 token
CREATE TABLE IF NOT EXISTS weight_members (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  name        TEXT NOT NULL,
  share_token TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_weight_members_user ON weight_members(user_id);
CREATE INDEX IF NOT EXISTS idx_weight_members_share_token ON weight_members(share_token);

-- ==================== 体重记录 ====================
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

-- ==================== 资产钱包 ====================
-- type: bank(银行卡) | alipay(支付宝) | wechat(微信) | investment(投资) | credit(信用支付, 负债) | cash(现金)
-- share_token: 免密录入链接 token
CREATE TABLE IF NOT EXISTS wallets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  type        TEXT NOT NULL,
  name        TEXT NOT NULL,
  share_token TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_share_token ON wallets(share_token);

-- ==================== 资产钱包月度记录 ====================
-- month: YYYY-MM
-- balance: 普通钱包月末余额; 投资钱包用 principal(本金)+profit(收益), balance 存两者之和
CREATE TABLE IF NOT EXISTS wallet_records (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_id  INTEGER NOT NULL,
  user_id    INTEGER NOT NULL,
  month      TEXT NOT NULL,
  balance    REAL NOT NULL DEFAULT 0,
  principal  REAL NOT NULL DEFAULT 0,
  profit     REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (wallet_id) REFERENCES wallets(id)
);
CREATE INDEX IF NOT EXISTS idx_wallet_records_wallet ON wallet_records(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_records_month ON wallet_records(month);

-- ==================== 资产年度目标 ====================
-- 每个用户每年一条目标净资产
CREATE TABLE IF NOT EXISTS asset_goals (
  user_id       INTEGER NOT NULL,
  year          TEXT NOT NULL,
  target_amount REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, year)
);

-- ==================== 统一推送配置 ====================
-- module: fund(基金日报) | weight(体重日报) | asset(资产月报) | monitor(监控)
-- 触发方式: Worker 每小时唤醒, 读此表用 shouldRun 判断是否到点
-- channel_id/hour/day: 旧单值列, 保留兼容; 新逻辑优先读多值列
-- channel_ids: 逗号分隔多渠道 id, 如 "1,3"
-- hours: 逗号分隔推送小时(0-23), 如 "9,18"; days: 逗号分隔每月第几天(1-28)
-- report_token: 该用户该模块的免密报告查看链接 token
CREATE TABLE IF NOT EXISTS push_config (
  user_id      INTEGER NOT NULL,
  module       TEXT NOT NULL,
  channel_id   INTEGER,
  channel_ids  TEXT,
  format       TEXT NOT NULL DEFAULT 'text',
  enabled      INTEGER NOT NULL DEFAULT 0,
  hour         INTEGER NOT NULL DEFAULT 9,
  day          INTEGER NOT NULL DEFAULT 15,
  hours        TEXT,
  days         TEXT,
  report_token TEXT,
  PRIMARY KEY (user_id, module)
);

-- 迁移原基金日报配置到 push_config(module='fund'), 默认每天 15 点
INSERT OR IGNORE INTO push_config (user_id, module, channel_id, format, enabled, hour, day)
SELECT user_id, 'fund', channel_id, format, enabled, 15, 15 FROM fund_report_config;

-- ==================== 全局应用设置 ====================
-- 键值对, 存放平台级全局配置
-- tz_offset: 相对 UTC 的小时偏移, 中国为 8; 影响所有推送/显示时间换算
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('tz_offset', '8');
