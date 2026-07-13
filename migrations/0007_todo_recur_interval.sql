-- Todo 重复任务: 支持"每隔 N 个周期"
-- 执行: wrangler d1 execute cron_db --remote --file=migrations/0007_todo_recur_interval.sql
-- 本地: wrangler d1 execute cron_db --local --file=migrations/0007_todo_recur_interval.sql
-- 注意: D1 不支持 ADD COLUMN IF NOT EXISTS, 若列已存在重跑会报错(可忽略该条错误)
-- 注释必须独立成行, 兼容 D1 控制台逐条执行

-- recur_interval: 重复间隔, NULL 或 1 均表示"每 1 个周期"(与旧数据兼容)
-- 结合 recurrence 使用: recurrence='daily' + recur_interval=3 = 每隔 3 天
-- 仅顶层任务且 recurrence 非空时有意义; 由业务代码保证
ALTER TABLE todos ADD COLUMN recur_interval INTEGER;
