-- 待办任务附件元数据表
-- 文件本体不入库: Cloudflare 存 R2(todo/<file_token>), Docker 存 DATA_DIR/files/todo/<file_token>
-- file_token 同时是免密下载凭证(GET /todo-file/:fileToken), 32 字符 url-safe 不可猜
CREATE TABLE IF NOT EXISTS todo_attachments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  todo_id       INTEGER NOT NULL,
  file_token    TEXT NOT NULL UNIQUE,
  origin_name   TEXT NOT NULL,
  mime          TEXT,
  size          INTEGER NOT NULL,
  is_image      INTEGER NOT NULL DEFAULT 0,
  uploader_uid  INTEGER,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 按任务查附件列表(详情/级联删除)
CREATE INDEX IF NOT EXISTS idx_todo_att_todo ON todo_attachments(todo_id);
