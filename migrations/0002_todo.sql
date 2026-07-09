-- Todo 待办功能建表
-- 执行: wrangler d1 execute cron_db --remote --file=migrations/0002_todo.sql
-- 本地: wrangler d1 execute cron_db --local --file=migrations/0002_todo.sql
-- 注意: 所有注释独立成行, 不使用行内注释, 以兼容 D1 控制台逐条/合并执行
-- 全部 CREATE 用 IF NOT EXISTS, 对已部署库重跑安全

-- ==================== 待办任务 ====================
-- parent_id: 自引用, 顶层任务为 NULL, 子任务无限嵌套
-- done: 0 未完成 | 1 已完成
-- priority: 0 低 | 1 中(默认) | 2 高
-- due_date: 截止日期 YYYY-MM-DD, 可空
-- category: 分类/标签, 可空
-- sort_order: 同级手动排序, 越小越靠前
-- share_token: 仅顶层任务用于免密分享链接 /t/:token, 长期有效
CREATE TABLE IF NOT EXISTS todos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  parent_id   INTEGER,
  title       TEXT NOT NULL,
  done        INTEGER NOT NULL DEFAULT 0,
  priority    INTEGER NOT NULL DEFAULT 1,
  due_date    TEXT,
  category    TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  share_token TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_todos_user ON todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_parent ON todos(parent_id);
CREATE INDEX IF NOT EXISTS idx_todos_share_token ON todos(share_token);
