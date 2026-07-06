-- 迁移 0008: 监控任务增加"独立发送"开关
-- 执行: wrangler d1 execute <DB_NAME> --remote --file=migrations/0008_monitor_standalone.sql
-- standalone=1: 该任务结果单独一条消息发送; =0(默认): 与同渠道其他任务合并发送

ALTER TABLE monitor_tasks ADD COLUMN standalone INTEGER NOT NULL DEFAULT 0;
