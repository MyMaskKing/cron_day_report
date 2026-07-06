-- 迁移 0007: 统一推送配置表（平台无关的定时推送时间与渠道）
-- 执行: wrangler d1 execute <DB_NAME> --remote --file=migrations/0007_push_config.sql
-- module: fund(基金日报) | weight(体重日报) | asset(资产月报)
-- hour: 推送小时(0-23, 北京时间); day: 每月第几天(仅 monthly 类模块如 asset 用, 1-28)
-- 触发方式: Worker 每小时唤醒, 读此表用 shouldRun 判断是否到点

CREATE TABLE IF NOT EXISTS push_config (
  user_id    INTEGER NOT NULL,
  module     TEXT NOT NULL,
  channel_id INTEGER,
  format     TEXT NOT NULL DEFAULT 'text',
  enabled    INTEGER NOT NULL DEFAULT 0,
  hour       INTEGER NOT NULL DEFAULT 9,
  day        INTEGER NOT NULL DEFAULT 15,
  PRIMARY KEY (user_id, module)
);

-- 迁移原基金日报配置到 push_config(module='fund'), 基金日报默认每天 15 点(与原 14:50 时段接近)
INSERT OR IGNORE INTO push_config (user_id, module, channel_id, format, enabled, hour, day)
SELECT user_id, 'fund', channel_id, format, enabled, 15, 15 FROM fund_report_config;
