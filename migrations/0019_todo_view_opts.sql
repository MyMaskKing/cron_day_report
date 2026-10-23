-- 0019: 待办全屏「显示」菜单设置（排序/隐藏已完成/到期分组/时间轴补齐空日期）
-- todo_view_opts: JSON 对象；NULL = 全默认
--   {"sort":"default|due_asc|due_desc","hide_done":true,"group_by_due":false,"timeline_full_axis":false}
ALTER TABLE users ADD COLUMN todo_view_opts TEXT;
