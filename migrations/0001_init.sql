-- 完整建库脚本（全量最终结构，合并历史全部迁移）
-- 执行: wrangler d1 execute cron_db --remote --file=migrations/0001_init.sql
-- 本地: wrangler d1 execute cron_db --local --file=migrations/0001_init.sql
-- 注意: 所有注释独立成行, 不使用行内注释, 以兼容 D1 控制台逐条/合并执行
-- 全部 CREATE 用 IF NOT EXISTS, 数据初始化用 INSERT OR IGNORE, 无 ALTER 语句:
--   新库一次建出全部表/列/索引; 已部署库重跑时已存在的表/索引/数据全部跳过, 不报错。
--   （历次新增列已直接并入下方建表语句, 无需再 ALTER ADD COLUMN。）

-- ==================== 用户 ====================
-- role: user | admin  status: active | disabled
-- weight_unit: jin(斤, 默认) | kg(公斤), 库内统一存公斤, 显示按此偏好换算(1公斤=2斤)
-- nickname: 显示用昵称, 可改; username 为登录名不可改
-- restrict_quicklogin: 免密快速登录访问限制, 1=仅能访问对应模块页(默认)
-- investment_strategy: 投资策略 Markdown, 每用户一条
-- theme: 界面主题 light(默认) | dark | eye
-- todo_auto_parent: 待办偏好, 1=子任务全部完成后父任务自动完成(默认) | 0=关闭
CREATE TABLE IF NOT EXISTS users (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  username             TEXT NOT NULL UNIQUE,
  password_hash        TEXT NOT NULL,
  role                 TEXT NOT NULL DEFAULT 'user',
  status               TEXT NOT NULL DEFAULT 'active',
  weight_unit          TEXT NOT NULL DEFAULT 'jin',
  nickname             TEXT,
  restrict_quicklogin  INTEGER NOT NULL DEFAULT 1,
  investment_strategy  TEXT,
  theme                TEXT NOT NULL DEFAULT 'light',
  todo_auto_parent     INTEGER NOT NULL DEFAULT 1,
  last_login_at        TEXT,
  last_public_at       TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ==================== 通知渠道 ====================
-- type: wechat | webhook | email
-- headers_json: 自定义请求头 JSON
-- body_template: 自定义 body 模板, 含 {{content}} 占位符
CREATE TABLE IF NOT EXISTS notify_channels (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'wechat',
  url           TEXT NOT NULL,
  method        TEXT NOT NULL DEFAULT 'POST',
  headers_json  TEXT,
  body_template TEXT,
  enabled       INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_notify_channels_user ON notify_channels(user_id);

-- ==================== 监控任务 ====================
-- return_type: text | html
-- channel_id: 关联通知渠道, 可空
-- standalone=1: 该任务结果单独一条消息发送; =0(默认): 与同渠道其他任务合并发送
CREATE TABLE IF NOT EXISTS monitor_tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  return_type TEXT NOT NULL DEFAULT 'text',
  channel_id  INTEGER,
  enabled     INTEGER NOT NULL DEFAULT 1,
  standalone  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_monitor_tasks_user ON monitor_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_monitor_tasks_enabled ON monitor_tasks(enabled);

-- ==================== 监控执行日志 ====================
CREATE TABLE IF NOT EXISTS monitor_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id       INTEGER NOT NULL,
  user_id       INTEGER NOT NULL,
  success       INTEGER NOT NULL DEFAULT 0,
  status        TEXT,
  status_text   TEXT,
  response_time INTEGER,
  response_size INTEGER,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (task_id) REFERENCES monitor_tasks(id)
);
CREATE INDEX IF NOT EXISTS idx_monitor_logs_task ON monitor_logs(task_id);

-- ==================== 基金持仓 ====================
-- shares: 持有份额  cost_nav: 持仓成本净值
-- 本金=shares*cost_nav  现值=shares*最新净值  收益=现值-本金
-- share_token: 免密快速加仓分享 token, 长期有效
CREATE TABLE IF NOT EXISTS funds (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  code        TEXT NOT NULL,
  name        TEXT,
  shares      REAL NOT NULL DEFAULT 0,
  cost_nav    REAL NOT NULL DEFAULT 0,
  share_token TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_funds_user ON funds(user_id);
CREATE INDEX IF NOT EXISTS idx_funds_share_token ON funds(share_token);

-- ==================== 基金净值缓存 ====================
-- nav: 最新单位净值  gsz: 估算净值  nav_date: 净值日期
CREATE TABLE IF NOT EXISTS fund_nav_cache (
  code       TEXT PRIMARY KEY,
  nav        REAL,
  gsz        REAL,
  nav_date   TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ==================== 基金日报配置（旧, 保留兼容, 已迁移至 push_config） ====================
-- format: text | html
CREATE TABLE IF NOT EXISTS fund_report_config (
  user_id    INTEGER PRIMARY KEY,
  channel_id INTEGER,
  format     TEXT NOT NULL DEFAULT 'text',
  enabled    INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ==================== 基金每日总收益快照 ====================
-- 每天 15 点刷新净值后, 为每个有持仓的用户记录当日 本金/现值/总收益
-- 同一用户同一天仅一条(重复覆盖), 供曲线图/表格/推送差额读取
CREATE TABLE IF NOT EXISTS fund_profit_daily (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  record_date TEXT NOT NULL,
  cost        REAL NOT NULL DEFAULT 0,
  value       REAL NOT NULL DEFAULT 0,
  profit      REAL NOT NULL DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fpd_user_date ON fund_profit_daily (user_id, record_date);

-- ==================== 体重成员 ====================
-- share_token: 免密快速填写链接 token
-- sort_order: 排序权重, 越小越靠前
-- disabled: 1=暂时停用(曲线/录入/日报隐藏, 数据保留); archived: 1=已移除(软删, 同名可恢复)
CREATE TABLE IF NOT EXISTS weight_members (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  name        TEXT NOT NULL,
  share_token TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  disabled    INTEGER NOT NULL DEFAULT 0,
  archived    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_weight_members_user ON weight_members(user_id);
CREATE INDEX IF NOT EXISTS idx_weight_members_share_token ON weight_members(share_token);

-- ==================== 体重记录 ====================
-- record_date: YYYY-MM-DD
CREATE TABLE IF NOT EXISTS weight_records (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id   INTEGER NOT NULL,
  user_id     INTEGER NOT NULL,
  weight      REAL NOT NULL,
  record_date TEXT NOT NULL,
  note        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (member_id) REFERENCES weight_members(id)
);
CREATE INDEX IF NOT EXISTS idx_weight_records_member ON weight_records(member_id);
CREATE INDEX IF NOT EXISTS idx_weight_records_date ON weight_records(record_date);

-- ==================== 体重成员共享引用 ====================
-- 一个成员可被多个用户引用（真共用同一份 member 与 records）; 属主仍是 weight_members.user_id
CREATE TABLE IF NOT EXISTS weight_member_shares (
  member_id  INTEGER NOT NULL,
  user_id    INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (member_id, user_id),
  FOREIGN KEY (member_id) REFERENCES weight_members(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_wms_user ON weight_member_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_wms_member ON weight_member_shares(member_id);

-- ==================== 资产钱包 ====================
-- type: bank(银行卡) | alipay(支付宝) | wechat(微信) | investment(投资) | credit(信用支付, 负债) | cash(现金)
-- share_token: 免密录入链接 token
CREATE TABLE IF NOT EXISTS wallets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  type        TEXT NOT NULL,
  name        TEXT NOT NULL,
  share_token TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_share_token ON wallets(share_token);

-- ==================== 资产钱包月度记录 ====================
-- month: YYYY-MM
-- balance: 普通钱包月末余额; 投资钱包用 principal(本金)+profit(收益), balance 存两者之和
CREATE TABLE IF NOT EXISTS wallet_records (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_id  INTEGER NOT NULL,
  user_id    INTEGER NOT NULL,
  month      TEXT NOT NULL,
  balance    REAL NOT NULL DEFAULT 0,
  principal  REAL NOT NULL DEFAULT 0,
  profit     REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (wallet_id) REFERENCES wallets(id)
);
CREATE INDEX IF NOT EXISTS idx_wallet_records_wallet ON wallet_records(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_records_month ON wallet_records(month);

-- ==================== 资产年度目标 ====================
-- 每个用户每年一条目标净资产
CREATE TABLE IF NOT EXISTS asset_goals (
  user_id       INTEGER NOT NULL,
  year          TEXT NOT NULL,
  target_amount REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, year)
);

-- ==================== 统一推送配置 ====================
-- module: fund(基金日报) | weight(体重日报) | asset(资产月报) | monitor(监控) | todo(待办)
-- 触发方式: Worker 每小时唤醒, 读此表用 shouldRun 判断是否到点
-- channel_id/hour/day: 旧单值列, 保留兼容; 新逻辑优先读多值列
-- channel_ids: 逗号分隔多渠道 id, 如 "1,3"
-- hours: 逗号分隔推送小时(0-23), 如 "9,18"; days: 逗号分隔每月第几天(1-28)
-- report_token: 该用户该模块的免密报告查看链接 token
CREATE TABLE IF NOT EXISTS push_config (
  user_id      INTEGER NOT NULL,
  module       TEXT NOT NULL,
  channel_id   INTEGER,
  channel_ids  TEXT,
  format       TEXT NOT NULL DEFAULT 'text',
  enabled      INTEGER NOT NULL DEFAULT 0,
  hour         INTEGER NOT NULL DEFAULT 9,
  day          INTEGER NOT NULL DEFAULT 15,
  hours        TEXT,
  days         TEXT,
  report_token TEXT,
  PRIMARY KEY (user_id, module)
);

-- 迁移原基金日报配置到 push_config(module='fund'), 默认每天 15 点
INSERT OR IGNORE INTO push_config (user_id, module, channel_id, format, enabled, hour, day)
SELECT user_id, 'fund', channel_id, format, enabled, 15, 15 FROM fund_report_config;

-- ==================== 推送日志 ====================
-- module: fund | weight | asset | todo | monitor; trigger_by: cron(定时) | manual(手动)
-- success: 1 成功 / 0 失败; error: 失败原因(截断 500 字)。只落发送动作, 不含正文
CREATE TABLE IF NOT EXISTS push_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL,
  module       TEXT NOT NULL,
  channel_id   INTEGER,
  channel_name TEXT,
  channel_type TEXT,
  format       TEXT,
  trigger_by   TEXT NOT NULL DEFAULT 'cron',
  success      INTEGER NOT NULL DEFAULT 0,
  error        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_push_log_user_time ON push_log (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_push_log_module_time ON push_log (module, created_at);
CREATE INDEX IF NOT EXISTS idx_push_log_created ON push_log (created_at);

-- ==================== 待办任务 ====================
-- parent_id: 自引用, 顶层任务为 NULL, 子任务无限嵌套
-- done: 0 未完成 | 1 已完成; priority: 0 低 | 1 中(默认) | 2 高
-- due_date: 截止日期 YYYY-MM-DD 可空; category: 文本分类/标签 可空
-- sort_order: 同级手动排序, 越小越靠前
-- share_token: 仅顶层任务用于免密分享链接 /t/:token, 长期有效
-- note: 备注; done_at: 完成日期(勾选时写当天, 取消清空), 旧已完成为空不计统计
-- recurrence: 重复周期 null|daily|weekly|monthly|yearly|monthly_nth_weekday; recur_from_id: 上一实例 id
-- recur_interval: 每隔 N 个周期(NULL/1=每周期); recur_nth: 月内第 N 个(1..5, 5=最后); recur_weekday: 星期几 0..6
-- child_due: 1=子任务独立截止日期模式(主任务不设日期/重复, 子任务各自设日期)
-- shared_cat_id: NULL=个人任务, 非空=所属共享分类(todo_shared_cats.id), 分类解散置 NULL
-- created_by: 实际创建者 uid(共享分类内真实操作人, 免密匿名 NULL); done_by: 最后完成操作人 uid
CREATE TABLE IF NOT EXISTS todos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL,
  parent_id     INTEGER,
  title         TEXT NOT NULL,
  done          INTEGER NOT NULL DEFAULT 0,
  priority      INTEGER NOT NULL DEFAULT 1,
  due_date      TEXT,
  category      TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  share_token   TEXT,
  note          TEXT,
  done_at       TEXT,
  recurrence    TEXT,
  recur_from_id INTEGER,
  recur_interval INTEGER,
  recur_nth     INTEGER,
  recur_weekday INTEGER,
  child_due     INTEGER NOT NULL DEFAULT 0,
  shared_cat_id INTEGER,
  created_by    INTEGER,
  done_by       INTEGER,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_todos_user ON todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_parent ON todos(parent_id);
CREATE INDEX IF NOT EXISTS idx_todos_share_token ON todos(share_token);
CREATE INDEX IF NOT EXISTS idx_todos_done_at ON todos(done_at);
CREATE INDEX IF NOT EXISTS idx_todos_recur_from ON todos(recur_from_id);
CREATE INDEX IF NOT EXISTS idx_todos_shared_cat ON todos(shared_cat_id);

-- ==================== 数据共享（家庭/团队, 邀请码 + 模块授权） ====================
-- 分享邀请: 一个邀请 = 一个短码 + 一组模块(逗号分隔, 如 asset,weight,todo)。
-- 重置码 = 换 code(旧码失效, 成员保留); 撤销 = revoked_at 置位踢掉全部成员。
CREATE TABLE IF NOT EXISTS share_invites (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT NOT NULL UNIQUE,
  owner_user_id INTEGER NOT NULL,
  modules       TEXT NOT NULL,
  note          TEXT,
  revoked_at    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_share_invites_owner ON share_invites(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_share_invites_code ON share_invites(code);

-- 分享成员: 家人凭码加入后产生一行; UNIQUE(invite_id, guest) 保证幂等(退出再加入即复活)。
-- revoked_at 非空 = 已退出/被移出; 权限是否有效还要同时看其邀请的 revoked_at。
CREATE TABLE IF NOT EXISTS share_members (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  invite_id     INTEGER NOT NULL,
  owner_user_id INTEGER NOT NULL,
  guest_user_id INTEGER NOT NULL,
  role          TEXT NOT NULL DEFAULT 'editor',
  revoked_at    TEXT,
  joined_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(invite_id, guest_user_id)
);
CREATE INDEX IF NOT EXISTS idx_share_members_guest ON share_members(guest_user_id);
CREATE INDEX IF NOT EXISTS idx_share_members_owner ON share_members(owner_user_id);

-- ==================== 待办共享分类（邀请码 + 分类级多人协作） ====================
-- 共享维度是 category 分类: 一分类一码, 任务 user_id 恒为分类 owner, 真实操作人记 created_by/done_by。
CREATE TABLE IF NOT EXISTS todo_shared_cats (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_user_id INTEGER NOT NULL,
  name          TEXT NOT NULL,
  code          TEXT NOT NULL UNIQUE,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tsc_owner ON todo_shared_cats(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_tsc_code ON todo_shared_cats(code);

-- 共享分类成员: role 为 owner(创建者, 唯一) 或 editor(默认)
-- 物理删除模型(同 share_members): 退出/踢人=DELETE 行, 重新加入 INSERT OR IGNORE 即恢复
CREATE TABLE IF NOT EXISTS todo_shared_cat_members (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  cat_id     INTEGER NOT NULL,
  user_id    INTEGER NOT NULL,
  role       TEXT NOT NULL DEFAULT 'editor',
  joined_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(cat_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_tscm_user ON todo_shared_cat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tscm_cat ON todo_shared_cat_members(cat_id);

-- ==================== 统一文件表（元数据；本体在 R2 / Docker files 目录） ====================
-- source='todo' 待办任务附件(todo_id 有值); source='user' 各模块 Markdown 内嵌图片/附件
-- file_token 同时是免密下载凭证(GET /todo-file/:fileToken), 32 字符 url-safe 不可猜
-- R2 key 按来源分前缀: todo/<token>、user/<token>
CREATE TABLE IF NOT EXISTS files (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_uid     INTEGER NOT NULL,
  source        TEXT NOT NULL DEFAULT 'user' CHECK(source IN ('todo','user')),
  todo_id       INTEGER,
  uploader_uid  INTEGER,
  file_token    TEXT NOT NULL UNIQUE,
  origin_name   TEXT NOT NULL,
  mime          TEXT,
  size          INTEGER NOT NULL,
  is_image      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_files_todo ON files(source, todo_id);
CREATE INDEX IF NOT EXISTS idx_files_owner ON files(source, owner_uid);

-- ==================== 全局应用设置 ====================
-- 键值对, 存放平台级全局配置
-- tz_offset: 相对 UTC 的小时偏移, 中国为 8; 影响所有推送/显示时间换算
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('tz_offset', '8');

-- ==================== 以后如何升级 ====================
-- 本文件是"全新部署的全量基线", 已部署环境按文件名记录在 _migrations, 改本文件内容不会重跑。
-- 老库升级请【新建】 migrations/0002_xxx.sql(编号紧接递增), 写幂等语句:
--   新表/新索引: CREATE ... IF NOT EXISTS(重跑静默跳过);
--   新列:       ALTER TABLE ... ADD COLUMN(无 IF NOT EXISTS, 重跑报 "duplicate column"
--               可忽略——Docker migrate.mjs 自动跳过, D1 控制台手动跳过该条)。
-- 同时可把新表/列同步写进上方对应 CREATE TABLE, 方便全新部署一次建全与阅读(非必须)。
