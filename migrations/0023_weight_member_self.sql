-- 体重「本人成员」标记：与账号昵称联动（改昵称时同步成员名），同时作为好友默认互见的成员
-- 存量回填：每个用户最早创建的未归档成员视为本人
ALTER TABLE weight_members ADD COLUMN is_self INTEGER NOT NULL DEFAULT 0;

UPDATE weight_members SET is_self = 1
 WHERE id IN (SELECT MIN(id) FROM weight_members WHERE archived = 0 GROUP BY user_id);
