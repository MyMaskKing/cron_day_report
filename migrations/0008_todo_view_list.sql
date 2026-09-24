-- 0008: 用户自定义待办视图循环
-- todo_view_list: JSON 有序视图 id 数组；NULL/空 = 系统三循环 card-accordion-tree；首项 = 进入待办的默认视图
ALTER TABLE users ADD COLUMN todo_view_list TEXT;
