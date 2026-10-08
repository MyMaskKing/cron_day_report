-- 附件访问统计：免密下载接口每次 GET 递增 access_count，并记录最后访问时间
ALTER TABLE files ADD COLUMN access_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE files ADD COLUMN last_access_at TEXT;
