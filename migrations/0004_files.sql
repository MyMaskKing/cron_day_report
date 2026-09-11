-- 统一文件元数据表
-- 来源区分用途: source='todo' 待办任务附件(todo_id 有值), source='user' 各模块 Markdown 内嵌文件
-- 文件本体不入库: Cloudflare 存 R2, Docker 存 DATA_DIR/files, key 按来源前缀 todo/<token>、user/<token>
-- file_token 同时是免密下载凭证(GET /todo-file/:fileToken), 32 字符 url-safe 不可猜
CREATE TABLE IF NOT EXISTS files (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_uid     INTEGER NOT NULL,
  source        TEXT NOT NULL DEFAULT 'user' CHECK(source IN ('todo','user')),
  todo_id       INTEGER,
  uploader_uid  INTEGER,
  file_token    TEXT NOT NULL UNIQUE,
  origin_name   TEXT NOT NULL,
  mime          TEXT,
  size          INTEGER NOT NULL,
  is_image      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 任务附件按任务查(列表/级联删除); 用户文件按归属+来源查
CREATE INDEX IF NOT EXISTS idx_files_todo ON files(source, todo_id);
CREATE INDEX IF NOT EXISTS idx_files_owner ON files(source, owner_uid);

-- 旧待办附件表(0003, 无正式业务数据)由统一 files 表取代; R2 里既有 todo/<token> 对象前缀不变, 无需迁移
DROP TABLE IF EXISTS todo_attachments;

-- 中间版本 0004_user_files 未正式发布, 若某环境跑过中间版则清理
DROP TABLE IF EXISTS user_files;
