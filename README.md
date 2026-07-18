# cron_day_report

基于 Cloudflare Workers 的**多用户个人生活面板 + 定时推送**服务。

在一个网页后台里管理四类数据，并按你自己设定的时间，把日报/月报自动推送到**企业微信机器人 / 通用 Webhook / 邮件**：

- 🖥️ **网站监控** —— 定时批量访问网址，汇报状态码与响应时间
- 📈 **基金持仓** —— 追踪净值、计算收益，生成持仓日报，支持免密加仓链接
- ⚖️ **体重记录** —— 多成员体重曲线，免密快速填写，日报含最近趋势
- 💰 **资产月报** —— 多钱包净资产聚合、年度目标进度，按月推送

> 说明：本项目由早期「单文件定时访问脚本」重构为多用户画面化系统。实现以 `src/` 代码为准。二次开发请先读 [`DEV_GUIDE.md`](./DEV_GUIDE.md)。

> [!NOTE]
> 网站已部署，快来体验用用吧~[监控追踪·定时发送](https://cron.10023456.xyz)

## 核心特性

- **平台无关的定时调度**：Worker 每小时唤醒，读数据库配置判断「此刻是否到点」，推送时间可在网页配置，不写死在 cron 表达式里。
- **多用户 + 超管**：注册登录、会话鉴权，超管可管理用户并切换身份（impersonate）。
- **免密公开链接**：家人/自己无需登录即可通过专属 token 链接填体重、加仓、录资产、看报告。
- **多渠道通知**：企业微信机器人、自定义 Webhook（可配 method/headers/body 模板）、邮件。
- **存储可插拔**：业务经统一适配器访问，默认 D1（SQLite）+ KV（会话），预留 MySQL/Redis 桩。

## 技术栈

Cloudflare Workers · D1 · KV · 原生 ES Module（无前端框架，服务端拼接 HTML）· QuickChart.io（图表）

## 部署

### 前置

- [Cloudflare](https://cloudflare.com) 账户
- Node.js ≥ 18
- Wrangler CLI：`npm install -g wrangler`

### 1. 登录 Cloudflare

```bash
wrangler login
```

### 2. 从模板生成 wrangler.toml

仓库只提供脱敏模板 `wrangler.toml.example`（真实 `wrangler.toml` 已被 `.gitignore` 忽略，不入库）。复制一份：

```bash
cp wrangler.toml.example wrangler.toml
```

### 3. 创建 D1 与 KV，填入 wrangler.toml

```bash
wrangler d1 create cron_db          # 得到 database_id
wrangler kv namespace create KV     # 得到 id
```

把返回的 `database_id` 和 KV `id` 填进 `wrangler.toml` 对应绑定处（`[[d1_databases]]` 的 `binding = "DB"`，`[[kv_namespaces]]` 的 `binding = "KV"`），并把 `PUBLIC_BASE_URL` 改成你的 Worker 域名。

> 这两个 id 是**部署绑定声明**，wrangler 部署时靠它定位资源，无法挪到控制台；它们不是密钥，但属于个人基础设施信息，故不入库。

### 4. 执行数据库迁移

无自动迁移机制，需按编号**逐个手动执行**（线上加 `--remote`，本地加 `--local`）：

```bash
wrangler d1 execute cron_db --remote --file=migrations/0001_init.sql
wrangler d1 execute cron_db --remote --file=migrations/0002_fund_share_token.sql
# ... 依次执行到最新编号的 migrations/*.sql
```

### 5. 配置变量与密钥

**明文变量**（非敏感）写在 `wrangler.toml` 的 `[vars]` 或 Dashboard → Worker → Settings → Variables：

| 变量 | 必需 | 说明 |
|------|------|------|
| `PUBLIC_BASE_URL` | 推荐 | 站点公开地址，用于在推送消息里拼免密链接绝对 URL，如 `https://xxx.workers.dev` |
| `STORAGE_DRIVER` | 可选 | 存储驱动，默认 `d1` |

**敏感密钥**用 `wrangler secret put` 加密存储，**切勿**写进 `wrangler.toml`：

```bash
wrangler secret put ADMIN_BOOTSTRAP_TOKEN   # 创建首个超管账号时校验
wrangler secret put CRON_SECRET             # 保护 /cron 手动触发入口（不设则免 key）
```

### 6. 部署

```bash
npm run deploy    # = wrangler deploy
```

### 7. 初始化超管

部署后访问站点，通过 `POST /api/auth/bootstrap`（携带 `ADMIN_BOOTSTRAP_TOKEN`）创建首个超管，随后登录网页后台使用。

## 常用命令

```bash
npm run dev       # 本地开发（连远程 D1/KV 加 --remote）
npm run test      # 纯本地 (wrangler dev --local)
npm run deploy    # 部署到 Cloudflare
npm run tail      # 查看线上实时日志
```

手动触发一次全量定时调度（调试用）：`GET /cron?key=<CRON_SECRET>`。

## 二次开发

架构分层、模块地图、定时调度原理、数据模型、时区坑等详见 **[`DEV_GUIDE.md`](./DEV_GUIDE.md)**。

## 许可证

MIT
