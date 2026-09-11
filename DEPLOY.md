# 部署指南

多用户个人生活面板 + 定时推送服务（网站监控 / 基金 / 体重 / 资产 / 待办五个模块）。
同一套业务代码支持两种部署：**Cloudflare Workers（推荐）** 与 **Docker 自托管**。

---

## 一、Cloudflare Workers 部署

### 前置

- [Cloudflare](https://cloudflare.com) 账户
- Node.js ≥ 18.20（推荐 20 LTS 或更新；Wrangler 4 的最低要求）
- 安装依赖并登录：

```bash
npm install
npx wrangler login
```

### 1. 生成配置文件

```bash
cp wrangler.toml.example wrangler.toml
```

按需修改 `wrangler.toml` 里的 `name`（Worker 名称，同一 Cloudflare 账户内唯一）。

模板中 **D1 的 `database_id` 与 KV 的 `id` 均留空**，不需要手动去 Dashboard 建库——
`wrangler.toml` 已被 `.gitignore` 忽略，不入库；`wrangler.toml.example` 是入库的脱敏模板。

### 2. 首次部署（自动创建 D1 与 KV）

```bash
npx wrangler deploy
```

首次部署时 Wrangler 会自动完成：

- 创建名为 `cron_db` 的 **D1 数据库**；
- 创建绑定名为 `KV` 的 **KV 命名空间**（会话存储）；
- 注册每小时整点触发的 **Cron 触发器**；
- 把生成的资源 ID **自动回写**进 `wrangler.toml`（之后此文件只在本机保留，勿提交）。

记下输出中的 Worker 地址，如 `https://cron-day-report.<你的子域>.workers.dev`。

> 需要 Wrangler 4 或更新版本（已在 devDependencies 中锁定 `^4`，`npm install` 后用 `npx wrangler` 即为本机版本）。

### 3. 初始化数据库表（自动，无需操作）

首次部署后，**第一次访问 Worker（或首个整点 Cron 唤醒）会自动建出全部表**：
Worker 检测到空库时自动执行内置的全量建表 SQL（与 `migrations/0001_init.sql` 同源、幂等），
每个运行实例只检测一次，已初始化的库无额外开销，Docker 部署则由容器启动迁移器完成。

手动建表仅作备用（如要在首次访问前预建）：

```bash
npx wrangler d1 execute cron_db --remote --file=migrations/0001_init.sql
```

以后版本若新增 `migrations/000N_xxx.sql`，老库升级时仍需按编号手动执行；全新部署无需任何命令。

### 4. 配置密钥（可选但建议）

```bash
npx wrangler secret put ADMIN_BOOTSTRAP_TOKEN   # 创建首个超管时的引导令牌
npx wrangler secret put CRON_SECRET             # 保护 /cron?key= 手动触发口
```

值在交互终端输入，加密存储、不入库。也可在 Dashboard → Worker → Settings →
Variables and Secrets 中管理（类型选 **Secret**）。不配置时：初始化页不校验令牌；
`/cron` 手动触发口免 key。

### 5. 初始化超管与站点地址

1. 浏览器访问 Worker 域名，自动进入「系统初始化」页，按提示创建首个超级管理员
   （配置了 `ADMIN_BOOTSTRAP_TOKEN` 时需填写该令牌）；
2. 登录后进入「用户管理 / 系统设置」→ **站点公开地址**，填入实际访问地址
   （推送内免密链接以此拼接；优先级：系统设置 > 环境变量 > 请求域名）。

### 6. 开始使用

在各模块页面录入数据、设置推送时间与通知渠道（企业微信机器人 / 通用 Webhook / 邮件中转）。
Worker 每小时整点被 Cron 唤醒，按数据库中各用户的推送配置判断此刻是否到点并发送，
推送时间无需写死。

---

## 二、本地开发

```bash
npm install
cp .dev.vars.example .dev.vars   # 按需填写本地变量（.dev.vars 不入库）

npm run dev      # wrangler dev：本地自动创建 D1/KV（miniflare 持久化）
npm run test     # wrangler dev --local 的别名（本仓库无自动化测试套件）
npm run tail     # 查看线上实时日志
npm run deploy   # 部署到 Cloudflare
```

纯 Node 运行（不依赖 Cloudflare，用 better-sqlite3 在本地 SQLite 上模拟 D1/KV）：

```bash
npm run serve
```

---

## 三、Docker 自托管

不使用 Cloudflare 时可用 Docker 一键部署，业务代码 `src/` 零改动，容器启动时自动执行迁移，
数据持久化在 `./docker-data/`。详见 **[`docker/README.md`](./docker/README.md)**。

```bash
docker compose up -d --build
```

Docker 通过容器环境变量注入 `PUBLIC_BASE_URL`、`CRON_SECRET` 等（不读 wrangler.toml）。

---

## 四、配置参考

### wrangler.toml

| 配置 | 说明 |
|------|------|
| `name` | Worker 名称，全账户唯一 |
| `main` | 入口 `src/index.js`，勿改 |
| `compatibility_date` | 运行时兼容日期 |
| `[triggers] crons` | 唤醒频率，默认 `0 * * * *`（每小时整点 UTC）；具体推送时刻由数据库配置决定，一般无需修改 |
| `[[d1_databases]]` | 绑定 `DB`；ID 首次部署自动回写，勿手填 |
| `[[kv_namespaces]]` | 绑定 `KV`；ID 首次部署自动回写，勿手填 |

### 运行时变量与密钥

| 名称 | 类型 | 说明 |
|------|------|------|
| `PUBLIC_BASE_URL` | 明文变量 | 站点公开地址。推荐改在网页「系统设置」里配置（免重新部署）；也可放 Dashboard Variables |
| `STORAGE_DRIVER` | 明文变量 | 存储驱动，默认 `d1`（另一取值 `mysql` 为预留桩，不可用），通常无需配置 |
| `ADMIN_BOOTSTRAP_TOKEN` | Secret | 初始化首个超管的引导令牌 |
| `CRON_SECRET` | Secret | `GET /cron?key=...` 手动触发全量调度的保护密钥，不设则免 key |
| `REQUEST_TIMEOUT` / `RESPONSE_TIMEOUT` / `CONCURRENCY_LIMIT` / `BATCH_DELAY` | 明文变量 | 监控请求调优，默认 30000ms / 60000ms / 5 / 1000ms，一般无需配置 |

另有两个全局配置存数据库、在超管「系统设置」页维护：**全局时区**（`tz_offset`，默认 8）、
**站点公开地址**（优先于环境变量）。

### 常用运维命令

```bash
npx wrangler deploy                                    # 更新部署
npx wrangler tail                                      # 线上日志
npx wrangler secret list                               # 已配置密钥名
npx wrangler d1 execute cron_db --remote --command "SELECT 1"   # 线上 D1 语句
```

手动触发一次全量推送（调试用）：浏览器访问 `https://<worker域名>/cron?key=<CRON_SECRET>`。

## R2 文件存储（待办附件 / 各模块 Markdown 文件）

附件文件本体存 Cloudflare R2（元数据在 D1 统一 `files` 表，按 `source` 区分任务附件与各模块 md 文件）。R2 bucket 不会随部署自动创建，首次部署前手工执行一次：

```bash
npx wrangler r2 bucket create cron-todo-files
```

未创建/未绑定时，附件上传会返回 503「附件存储未配置」，其他功能不受影响。
Docker 部署无需任何配置，附件自动落 `./docker-data/files/`。
