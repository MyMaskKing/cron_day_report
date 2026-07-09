-- Todo 增强：备注 + 完成时间（供完成量统计折线图）
-- 执行: wrangler d1 execute cron_db --remote --file=migrations/0003_todo_note_doneat.sql
-- 本地: wrangler d1 execute cron_db --local --file=migrations/0003_todo_note_doneat.sql
-- 注意: 所有语句独立成行, 不使用行内注释, 以兼容 D1 控制台逐条执行
-- D1 不支持 ADD COLUMN IF NOT EXISTS, 若列已存在重跑会报错(可忽略该条错误)

-- note: 任务备注
ALTER TABLE todos ADD COLUMN note TEXT;

-- done_at: 完成日期 YYYY-MM-DD, 仅在勾选完成时写入当天, 取消完成时清空
-- 旧的已完成任务此列为空, 不计入完成量统计
ALTER TABLE todos ADD COLUMN done_at TEXT;

-- 按完成日期查询的索引(完成量聚合用)
CREATE INDEX IF NOT EXISTS idx_todos_done_at ON todos(done_at);
