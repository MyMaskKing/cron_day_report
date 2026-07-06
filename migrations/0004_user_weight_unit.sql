-- 迁移 0004: 用户增加体重单位偏好
-- 执行: wrangler d1 execute <DB_NAME> --remote --file=migrations/0004_user_weight_unit.sql
-- weight_unit: jin(斤, 默认) | kg(公斤)
-- 数据库统一存公斤, 显示时按此偏好换算(1公斤=2斤)

ALTER TABLE users ADD COLUMN weight_unit TEXT NOT NULL DEFAULT 'jin';
