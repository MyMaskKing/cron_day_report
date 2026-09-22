-- 待办闹钟时间（相对任务 due_date 的分钟数，0-1439）；NULL=无闹钟
ALTER TABLE todos ADD COLUMN alarm_minute INTEGER;
