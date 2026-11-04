-- 纠偏：组队功能首版解除好友只删好友边、不摘组队成员行，导致已解除关系的人仍留在队伍名单，
-- 且新成员入队时会被自动重新加回好友。新逻辑已在 removeFriendPair 同步摘行，
-- 此处清理历史残留：非队长成员与该队队长之间已无好友边，即视为已离队，摘除其成员行。
DELETE FROM weight_team_members
 WHERE EXISTS (
   SELECT 1 FROM weight_teams t
    WHERE t.id = weight_team_members.team_id
      AND t.owner_user_id <> weight_team_members.user_id
      AND NOT EXISTS (
        SELECT 1 FROM weight_friends f
         WHERE (f.user_a = t.owner_user_id AND f.user_b = weight_team_members.user_id)
            OR (f.user_b = t.owner_user_id AND f.user_a = weight_team_members.user_id)
      )
 );
