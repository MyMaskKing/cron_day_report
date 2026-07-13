-- Todo 重复任务：新增 recurrence 与 recur_from_id 两列
-- 执行: wrangler d1 execute cron_db --remote --file=migrations/0006_todo_recurrence.sql
-- 本地: wrangler d1 execute cron_db --local --file=migrations/0006_todo_recurrence.sql
-- 注意: D1 不支持 ADD COLUMN IF NOT EXISTS, 若列已存在重跑会报错(可忽略该条错误)
-- 注释必须独立成行, 兼容 D1 控制台逐条执行

-- recurrence: 重复周期, null | 'daily' | 'weekly' | 'monthly' | 'yearly'
-- 仅顶层任务(parent_id 为空)可非空; 由业务代码保证
ALTER TABLE todos ADD COLUMN recurrence TEXT;

-- recur_from_id: 上一条实例 id, clone 时写入; 用于追溯血缘
ALTER TABLE todos ADD COLUMN recur_from_id INTEGER;

-- 供未来"查看该重复任务的历次实例"用
CREATE INDEX IF NOT EXISTS idx_todos_recur_from ON todos(recur_from_id);
