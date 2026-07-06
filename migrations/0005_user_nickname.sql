-- 迁移 0005: 用户增加昵称
-- 执行: wrangler d1 execute <DB_NAME> --remote --file=migrations/0005_user_nickname.sql
-- nickname: 显示用昵称, 可自行修改; username 为登录名不可改
-- 已有用户昵称默认置为其 username

ALTER TABLE users ADD COLUMN nickname TEXT;

UPDATE users SET nickname = username WHERE nickname IS NULL OR nickname = '';
