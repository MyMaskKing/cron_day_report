-- 0005: 用户私有「每日勉励卡」
-- motto: 座右铭正文, 空/NULL=未设置(不弹每日卡片)
-- motto_style: 卡片风格 a=极光能量(默认) | c=手账打气, 非法值一律按 a
-- motto_seen_date: 最近已读日期键 YYYY-MM-DD(按 app_settings.tz_offset 计日), 不等于今日则当天首次登录弹一次
ALTER TABLE users ADD COLUMN motto TEXT;
ALTER TABLE users ADD COLUMN motto_style TEXT NOT NULL DEFAULT 'a';
ALTER TABLE users ADD COLUMN motto_seen_date TEXT;
