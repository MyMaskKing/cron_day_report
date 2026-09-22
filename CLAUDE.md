# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

基于 Cloudflare Workers 的**多用户个人生活面板 + 定时推送**服务。覆盖网站监控、基金持仓、体重记录、资产月报、待办清单（Todo Widget）五个模块，按用户配置的时间推送到企业微信 / 通用 Webhook / 邮件。

无前端框架：页面由 `src/web/` 服务端拼接 HTML 字符串；图表用 QuickChart.io 生成图片 URL（Worker 无 DOM）。

**权威事实源是 `src/` 代码**。`DEV_GUIDE.md` 是更详细的二次开发向导（架构、数据模型、模块地图），改代码前先读它——但其第 1/3/5/8 节仍停留在「四模块」时期（未收录 todo、共享、文件存储等），**模块清单以本文件为准**；`README.md` / `DEPLOY.md` / `env.example` 含早期单文件版本的遗留描述，已不完全对应当前实现。

## 常用命令

```bash
npm run dev       # wrangler dev（本地，默认连远程 D1/KV；加 --local 走纯本地 miniflare）
npm run test      # wrangler dev --local（纯本地，不碰线上资源）
npm run deploy    # wrangler deploy 到 Cloudflare
npm run tail      # 线上实时日志
npm run serve     # 纯 Node 启动 docker/server.mjs（不依赖 workerd，用 better-sqlite3 模拟 D1/KV）
```

Docker 本地部署（业务代码 `src/` 零改动）：
```bash
docker compose up -d --build      # 数据落 ./docker-data/
docker compose logs -f
```

数据库迁移（全量基线 `migrations/0001_init.sql` + 编号增量脚本，当前到 `0004_files.sql`）——**两个宿主都已内置自动迁移，通常零命令**：
- **Cloudflare**：Worker 首次请求 / 定时唤醒时 `src/storage/schema.js#ensureSchema(env)` 按 `MIGRATIONS` 登记表顺序执行未应用的 SQL（每个 isolate 仅查一次 `_migrations`，逐条独立提交，仅忽略 already exists/duplicate column）。
- **Docker/Node**：容器启动时 `docker/migrate.mjs` 扫盘按编号执行 `migrations/*.sql`。两侧共用 `_migrations` 表按**文件名**去重。
- **新库**：`0001_init.sql` 一次建出全部表/列/索引（`CREATE ... IF NOT EXISTS` + `INSERT OR IGNORE`，可任意重跑）；0002–0004 是基线发布后的增量（待办 auto_parent、待办附件、统一 files 表）。
- **新增表/列（老库升级）**：**新建** `migrations/000N_描述.sql`（编号三位数对齐、紧接当前最大值，**下一个是 0005**），并**必须同时在 `src/storage/schema.js` 顶部 `import` 与 `MIGRATIONS` 数组登记**——Workers 运行时不能扫盘、`.sql` 靠 wrangler Text 规则构建期内联，漏登记则 CF 侧永不执行（Docker 侧扫盘不受影响）。语句写幂等：新表/索引用 `CREATE ... IF NOT EXISTS`，新列用 `ALTER TABLE ADD COLUMN`（"列已存在"两侧都自动忽略）。可顺带把新结构并进 `0001_init.sql` 的 `CREATE TABLE` 便于全新部署阅读。
- **手动 D1**（可选/排障）：`wrangler d1 execute cron_db --remote --file=migrations/000N_xxx.sql`。

首次部署到 Cloudflare 另需**手工建 R2 bucket**（不会随部署自动创建）：`wrangler r2 bucket create <名称>`，名称以 `wrangler.toml` 的 `[[r2_buckets]] bucket_name` 为准；D1/KV 则由首次 deploy 按名自动创建并把生成的 ID 回写 `wrangler.toml`。

手动触发一次全量调度（调试用）：`GET /cron?key=<CRON_SECRET>`（未设 `CRON_SECRET` 时免 key）。

> 本仓库**没有自动化测试**；`npm run test` 只是本地起服务，不要把它当测试套件。

## 双运行时（重要）

同一份 `src/` 业务代码跑在两种宿主：

1. **Cloudflare Workers**（主）：`fetch` + `scheduled` 双入口，D1 + KV + R2（绑定名 `FILES`），`wrangler.toml` 的 `crons = ["0 * * * *"]` 每小时唤醒。
2. **纯 Node + better-sqlite3**（`docker/`）：`docker/server.mjs` 用 `d1-shim.mjs` / `kv-shim.mjs` / `file-shim.mjs` 在 SQLite 文件 + 本地目录上模拟 D1/KV/R2 绑定（文件落 `DATA_DIR/files/`），`http-adapter.mjs` 桥接 Node http 到 Worker `fetch`，并内置 `setInterval` 每小时直接调用 `worker.scheduled()`。

改代码必须保证两侧都能跑——不要使用仅 workerd 支持的 API 而不做兜底；不要在 `src/` 里 `import node:*`（宿主桥接在 `docker/` 内完成）。

## 架构分层

固定调用链：**`api/` → `services/` → `storage/` adapter**。

| 目录 | 职责 | 约束 |
|------|------|------|
| `src/index.js` | Worker 入口：注册路由、`fetch`/`scheduled` 调度编排、消息组装 | 路由表集中在此 |
| `src/router.js` | 轻量路由器（method + path，支持 `:param`），`json/html/error` 辅助 | |
| `src/api/*.api.js` | 请求层：解析请求、**鉴权**、调 service/storage、返回 `json()` | handler 收到 `requireAuth` 的 401 或 `requireDataContext` 的 403 `Response` 必须 `instanceof Response` 提前 return |
| `src/services/*.service.js` | 业务层：**纯计算**，不碰存储 | `monitor.service`/`notify.service` 本身就是 IO 例外；推送文案模板集中在 `report.service.js` |
| `src/storage/` | 存储抽象：业务只通过 `getStorage(env)` 取 D1 适配器，**不写裸 SQL** | 全部 SQL 在 `d1-adapter.js`，按域分组（users/notify/monitor/fund/weight/asset/push/todo/file/sharedCat/share/pushLog/backup/settings）；`schema.js` 是 Worker 侧自动迁移器；`file-store.js#getFileStore(env)` 是文件本体统一接口；`mysql-adapter.js` / `redis-store.js` 是预留桩 |
| `src/auth/` | KV 会话（cookie `sid`）、`requireAuth`/`requireAdmin` 中间件、密码 hash | 会话在 KV，业务数据在 D1，文件本体在 R2，不要混 |
| `src/web/` | `layout.js`（外壳 + CSS）、`pages.js`（每页一个渲染函数）、`assets.js`（页面 JS 字符串常量）、`static.js`（`/s/:name` 外链 CSS/JS，内容 hash 作 `?v=` 强缓存键） | 全部是 JS 字符串；新增静态资源要在 `static.js#buildAssets` 白名单登记 |

模块清单：
- `monitor` 网站监控、`fund` 基金持仓（含收益历史/分析/策略 Markdown）、`weight` 体重记录、`asset` 资产月报（含年度目标）、`todo` 待办清单（含附件、分类、图表分析、共享分类）
- `push_config` 统一推送配置、`push_log` 推送历史（**表名无 s**）
- `notify_channels` 通知渠道（wechat / webhook / email）
- `users.api.js` 注册/资料/主题/偏好 + 超管用户管理；`share` 家庭模块共享、`todoSharedCat` 待办共享分类、`file`/`admin-file` 统一文件元数据与上传下载（三者见下文专节）；`backup` 超管全量备份/恢复

## 定时调度（核心设计，改前必读）

**几点/几号推送不写死在 cron 表达式里**。Worker 每小时唤醒一次，读数据库 `push_config` 表，用纯函数 `shouldRun(module, cfg, now)` 判断此刻是否到点。逻辑在 `src/services/schedule.service.js`，平台无关，Node 宿主原样复用。

- `push_config.hours` / `days` 是逗号分隔多值字符串（如 `"9,18"`）；旧列 `hour`/`day` 保留兼容，`shouldRun` 优先读多值。
- 模块类型：`monitor`/`fund`/`weight`/`todo` 按小时；`asset` 按「月中某天 + 小时」。
- `cron` 触发时传空 → `handleScheduled` 忽略时间判断，所有启用模块强制推送一次（调试用）。
- 基金净值每天 15 点刷一次缓存（`fund_nav_cache`）。

## 鉴权与超管

- `requireAuth(request, env)` 返回 session 对象或 401 `Response`；`requireAdmin` 额外校验 `role==='admin'`。
- 首个超管由 `POST /api/auth/bootstrap` + `ADMIN_BOOTSTRAP_TOKEN`（secret）创建。
- **Impersonate**：超管改写同一 KV session token，保留 `admin_id` 用于恢复，`impersonating` 标志控制顶栏黄条。
- **开放注册**：`POST /api/auth/register`，受 `app_settings` 的 `register_limit`（人数上限）/ `register_limit_msg` 控制，`GET /api/auth/register-status` 公开查询是否已满。
- **免密页快速登录**：`POST /api/public/quick-login/:kind/:token` 凭免密 token 反查所属用户直接签发正式会话（kind 含 fund/weight/asset/todo 及各 *-report）；用户偏好 `restrict_quicklogin`（默认 1）把该会话限制为仅能访问对应模块页。
- 用户级偏好都在 `users` 表：`theme`（light/dark/eye）、`weight_unit`（jin/kg，库内统一存 kg）、`nickname`、`investment_strategy`（Markdown）、`todo_auto_parent`（子任务全完成后父任务自动完成），经 `/api/auth/profile`、`/api/auth/theme` 等端点修改。
- 会话 cookie 带 `Secure`；非 HTTPS 裸 IP 部署（含局域网 Docker）登录会失败，需套 HTTPS 反代（localhost 浏览器豁免）。

## 免密公开链接（无需登录，靠长期 token）

推送消息里用 `env.PUBLIC_BASE_URL`（DB 设置 > env > request.origin 三级回退，见 `config.js#resolveBaseUrl`）拼绝对 URL：

| 路径 | 用途 | token 列 |
|------|------|----------|
| `/f/:token` | 基金加仓 | `funds.share_token` |
| `/w/:token` | 体重填写 | `weight_members.share_token` |
| `/a/:token` | 资产录入 | `wallets.share_token` |
| `/wr/:token`、`/ar/:token`、`/tr/:token` | 体重/资产/待办报告查看 | `push_config.report_token`（todo 另有 `/api/public/todo-report|todo-chart|todo-analyze/:token`） |
| Todo 系列 `/api/public/todo/:token`、`/api/public/todo-all/:token`、`/api/public/todo-widget/:token` | 待办协作与 Android 小组件 | `todos.share_token` 等 |
| `/todo-file/:fileToken` | 附件/图片免密下载（图片 inline、其余 attachment，SVG 强制下载防 XSS） | `files.file_token` |

token 缺失时代码自动 `generateToken()` 并持久化。

## 家庭数据共享（邀请码 + X-Data-As 数据源切换）

数据不搬家、仍归主人的跨账号共享：主人在设置页生成「8 位邀请码 + 模块集」，家人凭码加入后，在被授权模块内读写主人那一套数据。代码集中在 `src/api/share.api.js` + `d1-adapter.js` 的 `storage.share` 域，表为 `share_invites` / `share_members`（已并入 0001 全量基线）。

- **可共享模块**：`fund` / `weight` / `asset` / `todo`（`SHARE_MODULES`）；`monitor` 是个人自动化，不纳入。
- **数据源解析**：业务 handler 不直接用 `auth.user_id` 归属数据，而是调 `requireDataContext(storage, auth, module, request)`（share.api.js 导出）→ 返回 `{uid, shared, owner}` 或 403 `Response`；后续存储调用一律传 `dc.uid`。请求头 `X-Data-As: <主人uid>` 表示切换数据源，不带/是自己 → 本人数据。**给 fund/weight/asset/todo 新增登录态数据 handler 时必须走此函数**，否则共享切换失效。
- **前端**：`web/assets.js` 按模块记住数据源（`localStorage["dataAs_"+mod]`），登录态业务请求自动带 `X-Data-As` 头；公开免密路径（`/api/public/...`）与 `/api/share` 管理路径不带。模块页顶部有「数据源切换条」，仅有共享来源时出现，切换后整页刷新。加入入口是 `/settings?join=<code>`。
- **权限实时跟随邀请的 modules**；重置码 = 换 code（旧码失效、成员保留），撤销 = 级联删除邀请+成员关系。cron 推送不受影响——`push_config` 仍按账号各推各的，共享只影响登录态 Web/API 的数据归属。
- 注意区分旧机制：`weight_member_shares` 表是超管把**单个体重成员**引用到自己名下（admin 接口 `POST /api/admin/weight/share`），与邀请码整模块共享并存，勿混。

## 待办共享分类（与家庭共享是两套机制，勿混）

`src/api/todoSharedCat.api.js` + `d1-adapter.js` 的 `storage.sharedCat` 域，表 `todo_shared_cats` / `todo_shared_cat_members`：

- **共享维度是 category 分类**（不是整模块数据源切换）：主人创建共享分类并生成邀请码，家人凭码加入（`/api/todo/shared-cats/*`），该分类下任务对成员可见可写。
- **任务不搬家**：`todos.user_id` 恒为分类 owner，实际操作人记 `todos.created_by` / `done_by`；成员退出/被踢任务保留，解散分类只摘掉分类标签（任务变回 owner 个人任务）。
- 不经过 `requireDataContext` / `X-Data-As`，与上文家庭共享完全独立。

## 文件存储（第三存储层：R2 / 本地磁盘）

附件与图片**本体不进 D1**，元数据与本体分离：

- **元数据**：统一 `files` 表，`storage.file` 域。`source` 区分用途（`todo` 待办附件 / `user` 各模块 Markdown 图片），关键列 `file_token`（兼免密下载凭证）、`owner_uid`、`todo_id`、`uploader_uid`、`is_image`。
- **本体**：业务只调 `src/storage/file-store.js#getFileStore(env)` 的统一接口（put/get/delete/list），Cloudflare 是 R2 bucket（绑定 `FILES`，key 前缀 `todo/<token>`、`user/<token>`），Docker 是 `DATA_DIR/files/`（`docker/file-shim.mjs`，带路径穿越校验）。未绑定 `FILES` 时返回 null，api 层回 503。
- **入口**：通用上传/下载在 `file.api.js`（`POST /api/files/upload`、`GET /todo-file/:fileToken`，大小上限取 `app_settings.todo_attach_max_mb`，默认 5MB）；待办附件的业务鉴权与级联在 `todo.api.js`（删除 todo 子树时 source='todo' 附件随删）；超管有容量统计 / 孤儿文件扫描清理（`admin-file.api.js`）。
- R2 `list` 必须按 `truncated` + cursor 翻页（单页上限 1000），不能用 objects.length 判完。

## 数据备份 / 恢复（仅超管）

`src/api/backup.api.js`：`GET /api/admin/backup/export` 导出全量业务数据 JSON（含净值缓存，不含会话/运行日志），`POST /api/admin/backup/import` 全量覆盖导入（分块事务）。实现走 `storage.backup.dumpTables`，备份文件可在 Cloudflare D1 与多个 Docker（better-sqlite3）实例间互导。

## Android 配套（`android/`）

`android/` 是独立的 Gradle/Compose 项目（`xyz.a10023456.todowidget`，minSdk 26，JVM 17），实现待办清单的 **App Widget + Glance**，通过 `src/api/todo.api.js` 的公开/widget 端点与 Worker 通信。改 todo 模块的公开接口时记得核对 Android 端调用。版本号由 CI 环境变量 `VERSION_CODE` / `VERSION_NAME` 注入，本地构建回退默认值。

Android 端二次开发先读 **`android/DEV_GUIDE.md`**：构建环境（JDK 17–22）、模块地图、服务器域名配置（AppConfig/「我的」页）、密钥与 token 体系（sid 自动同步 / report_token 免密 / release 签名）、小组件 UI 尺寸调整（`CARD_GAP`/`CARD_RADIUS` 等）、StateFlow 重组与刷新机制。

## 关键约定与坑

1. **存储抽象不能破**：新增数据操作 → 加在 `d1-adapter.js` 对应域分组的方法上，再在 api 层调用；禁止业务层裸 SQL。
2. **迁移 SQL 注释必须独立成行**，不要用行内 `--` 注释（splitSql 会剥整行注释，行内注释会污染语句）。`migrations/0001_init.sql` 是全量基线；老库升级**新建** `migrations/000N_描述.sql`（编号递增、三位数对齐，当前下一个是 0005），不要改已部署文件内容（`_migrations` 按文件名去重不会重跑），并务必同步登记 `src/storage/schema.js` 的 import + `MIGRATIONS`。
3. **时区**：Worker 跑在 UTC，面向中国用户。全局偏移存 `app_settings.tz_offset`（默认 8），由超管在用户管理页设置。换算走 `time.service.js#parseOffset` + `schedule.service.js#nowCN`。**历史遗留**：`web/assets.js` 的 `COMMON_JS` 日期函数可能含硬编码 `+8*3600*1000`，改时区时前后端都要查。
4. **推送格式降级**：`config.js#effectiveFormat` 自动处理——email 把 markdown 降级为 text，wechat/webhook 把 html 降级为 text。企业微信 markdown 单条 4096 字节截断。
5. **PUBLIC_BASE_URL**：DB 设置优先，其次 `wrangler.toml` `[vars]` / 容器环境变量，最后 `request.url` origin。Docker 首次启动登录后到「系统设置」里填实际访问地址。
6. **wrangler.toml 不入库**：`.gitignore` 忽略 `wrangler.toml`（本地实际配置，首次 deploy 后含自动回写的真实 D1/KV ID），入库的模板是 `wrangler.toml.example`（无 ID）。新机器先 `cp wrangler.toml.example wrangler.toml`；D1/KV 首次部署自动创建，R2 bucket 需手工建。
7. **全局规约**：遵循用户 `~/.claude/CLAUDE.md` 的精简执行规约——正确性 > 最小修改 > 一致性 > 性能；修改前读最新文件；复用优先；不做无关重构；不执行 git 操作（仅可提供 commit message 建议）。
8. **共享数据源**：fund/weight/asset/todo 的登录态 handler 数据归属用 `requireDataContext(...).uid`，不要直接用 `auth.user_id` 查业务数据（详见上文「家庭数据共享」）。
9. **主题色用 CSS 变量**：三套主题 light / dark / eye，服务端按 `users.theme` 在 `<html data-theme>` 直出，变量定义在 `layout.js` 的 BASE_CSS；新增颜色必须走变量，勿写死色值，暗色/护眼模式才不会破。
10. **静态资源走 `/s/:name`**：`web/static.js` 白名单 + 内容 hash `?v=` 强缓存（immutable）；改 assets/layout 字符串后无需手动 bump 版本，新增资源必须登记白名单，且跨模块常量只能在函数体内访问（`static.js` 与 `layout.js` 循环依赖）。

## 代码分析工具

仓库根有 `.codegraph/` 索引。检索先走 CodeGraph（用户级 hook 已强制执行），禁止首选 grep/read：

1. **CodeGraph 首查**：业务自然语言，`mcp__codegraph__codegraph_explore` 或 `codegraph explore "<问题>"`；不中改用技术词（DOM id、class 名、函数名片段）重查一次——首查不中是查询词不精确，不是「无法定位」。
2. **两次都不中**（索引缺失、文件未入库等）才允许 grep/read 精准兜底，并在交付说明里讲清降级原因；符号引用查找与重命名也在此阶段完成。

定位之后，改动点若是函数内局部逻辑，仍用 Edit 做最小范围替换，不为凑工具而整函数替换（最小修改优先）。

## Claude Code 插件（项目级）

项目级插件配置写在 `.claude/settings.json`（已入库，随仓库同步），新机器 clone 后启动 Claude Code 会按此自动启用；若提示找不到 marketplace，先执行一次：

```bash
claude plugin marketplace add anthropics/claude-plugins-official
```

已启用插件（`@claude-plugins-official`）：

| 插件 | 用途 |
|------|------|
| `cloudflare` | Cloudflare 平台 skills（Workers、Wrangler CLI、D1/KV/R2、Durable Objects 等）+ 5 个 MCP（cloudflare-api/docs/bindings/builds/observability）。处理 Worker 部署、绑定、构建时使用。 |
| `kotlin-lsp` | `android/` 模块（Kotlin + Compose / Glance App Widget）的语言服务器，提供跳转、补全、类型信息。 |

补充：
- `.claude/settings.json` 只提交插件开关；其余 `.claude/` 内容被 `.gitignore` 忽略，不入库。
- 新增/卸载项目级插件用 `claude plugin install <plugin> -s project` / `claude plugin uninstall <plugin> -s project`，不要改用用户级配置。
