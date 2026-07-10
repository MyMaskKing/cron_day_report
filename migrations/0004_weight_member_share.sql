-- 体重成员共享引用表
-- 一个成员可被多个用户引用（真共用同一份 member 与 records）
-- 属主仍是 weight_members.user_id；引用方登记在此表
CREATE TABLE IF NOT EXISTS weight_member_shares (
  member_id INTEGER NOT NULL,
  user_id   INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (member_id, user_id),
  FOREIGN KEY (member_id) REFERENCES weight_members(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_wms_user ON weight_member_shares(user_id);

CREATE INDEX IF NOT EXISTS idx_wms_member ON weight_member_shares(member_id);
