-- 推送日志: 每次真正调用 sendNotification 都记一条, 汇总 5 类模块
-- module: fund | weight | asset | todo | monitor
-- trigger_by: cron(定时) | manual(手动"立即推送")
-- success: 1 成功 / 0 失败
-- error: 失败原因(截断到 500 字), 成功则为 NULL
-- 只落发送动作本身, 不含消息正文, 保持轻量
-- 无自动清理机制, 由超管在管理页面按时间区间手动删除
-- 执行: wrangler d1 execute cron_db --remote --file=migrations/0010_push_log.sql
-- 注意: 所有注释独立成行, 不使用行内注释, 以兼容 D1 控制台
CREATE TABLE IF NOT EXISTS push_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL,
  module       TEXT NOT NULL,
  channel_id   INTEGER,
  channel_name TEXT,
  channel_type TEXT,
  format       TEXT,
  trigger_by   TEXT NOT NULL DEFAULT 'cron',
  success      INTEGER NOT NULL DEFAULT 0,
  error        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_push_log_user_time ON push_log (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_push_log_module_time ON push_log (module, created_at);
CREATE INDEX IF NOT EXISTS idx_push_log_created ON push_log (created_at);
