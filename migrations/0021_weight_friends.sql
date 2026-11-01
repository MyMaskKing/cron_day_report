-- 体重成员「对好友可见」开关：0=默认隐藏，1=好友可见
-- 好友之间默认只能看到对方代表本人的成员，其余家庭成员需属主手动开启
ALTER TABLE weight_members ADD COLUMN friend_visible INTEGER NOT NULL DEFAULT 0;

-- 老库回填：每个用户最早的未归档成员视为其本人成员，默认对好友可见
UPDATE weight_members SET friend_visible = 1
 WHERE id IN (SELECT MIN(id) FROM weight_members WHERE archived = 0 GROUP BY user_id);

-- 体重好友邀请：一人一条；重置链接 = 换 token（好友关系行保留）
CREATE TABLE IF NOT EXISTS weight_friend_invites (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_user_id INTEGER NOT NULL UNIQUE,
  token         TEXT NOT NULL UNIQUE,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (owner_user_id) REFERENCES users(id)
);

-- 体重好友关系：对称存储，user_a < user_b 规范化，一行即代表双向好友
CREATE TABLE IF NOT EXISTS weight_friends (
  user_a     INTEGER NOT NULL,
  user_b     INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_a, user_b),
  FOREIGN KEY (user_a) REFERENCES users(id),
  FOREIGN KEY (user_b) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_weight_friends_b ON weight_friends(user_b);
