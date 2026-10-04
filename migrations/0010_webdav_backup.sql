-- WebDAV 自动备份执行历史（兼做保留清理的事实源）
-- filename 唯一: 同一计划时间点的失败重试/手动触发/立即备份 PUT 同一文件, 日志 upsert 为一行
-- status: success / fail; 表名以 logs 结尾, 导出备份时被 isLogTable() 自动排除

CREATE TABLE IF NOT EXISTS webdav_backup_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  filename   TEXT NOT NULL UNIQUE,
  size       INTEGER,
  status     TEXT NOT NULL DEFAULT 'success',
  error      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
