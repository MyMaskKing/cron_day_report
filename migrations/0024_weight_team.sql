-- 体重组队：一人可创建一个组队（owner_user_id 唯一），凭 token 链接加入
-- 加入者与队内现有成员两两补 weight_friends 好友边，组队表本身只记录人群归属
CREATE TABLE IF NOT EXISTS weight_teams (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_user_id INTEGER NOT NULL UNIQUE,
  token         TEXT NOT NULL UNIQUE,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (owner_user_id) REFERENCES users(id)
);

-- 组队成员：一行一个队员，建队时队长自动入队
CREATE TABLE IF NOT EXISTS weight_team_members (
  team_id   INTEGER NOT NULL,
  user_id   INTEGER NOT NULL,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (team_id, user_id),
  FOREIGN KEY (team_id) REFERENCES weight_teams(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_weight_team_members_user ON weight_team_members(user_id);
