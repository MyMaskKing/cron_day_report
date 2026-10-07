-- Markdown 编辑框上传文件的归属标记：strategy 投资策略 / announcement 全站公告 / app_download APP 下载页
-- 保存对应正文时自动清理该标记下不再引用的文件；NULL = 旧文件或其他来源，不参与自动清理
ALTER TABLE files ADD COLUMN ref_kind TEXT;
