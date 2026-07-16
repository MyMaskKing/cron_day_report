-- Todo 重复任务: 支持"每月第 N 个星期 X"
-- 执行: wrangler d1 execute cron_db --remote --file=migrations/0009_todo_monthly_nth.sql
-- 本地: wrangler d1 execute cron_db --local --file=migrations/0009_todo_monthly_nth.sql
-- 注意: D1 不支持 ADD COLUMN IF NOT EXISTS, 若列已存在重跑会报错(可忽略该条错误)
-- 注释必须独立成行, 兼容 D1 控制台逐条执行

-- recur_nth: 第 N 个, 1..5; 5 表示"最后一个"(月内实际存在的最后一个 weekday)
-- 仅在 recurrence='monthly_nth_weekday' 时有意义; 由业务代码保证
ALTER TABLE todos ADD COLUMN recur_nth INTEGER;

-- recur_weekday: 目标星期几, 0..6; 0=周日, 1=周一, ..., 6=周六
-- 仅在 recurrence='monthly_nth_weekday' 时有意义; 由业务代码保证
ALTER TABLE todos ADD COLUMN recur_weekday INTEGER;
