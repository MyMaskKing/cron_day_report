-- 0005: 用户私有「每日勉励卡」
-- motto: 座右铭正文, 空/NULL=未设置(不弹每日卡片)
-- motto_style: 卡片风格 a=极光能量(默认) | c=手账打气 | h1=战书令 | h2=最后通牒, 非法值一律按 a
-- motto_seen_date: 最近已读日期键 YYYY-MM-DD(按 app_settings.tz_offset 计日), 不等于今日则当天首次登录弹一次
ALTER TABLE users ADD COLUMN motto TEXT;
ALTER TABLE users ADD COLUMN motto_style TEXT NOT NULL DEFAULT 'a';
ALTER TABLE users ADD COLUMN motto_seen_date TEXT;


1. App上如果不是超管，就不要有用户管理，或者点击后要报他没权限
2. 仪表盘的待办点击后，应该打开这个待办的详情画面，效果等同于点击主任务的眼睛图标，能做到吗
3. 座右铭再加一个风格，这个风格可以做的狠一点，针对的是那些意志力薄弱的，你也先设计几个demo让我选择