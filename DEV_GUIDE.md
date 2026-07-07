# 开发向导（AI / 二次开发速读）

> 目标：用最少 token 理解本项目结构，直接定位改点、修 bug、加功能。
> 权威事实源是 `src/` 代码；`README.md` 只作简介，旧版描述已废弃。

## 1. 一句话概述

Cloudflare Worker 单文件入口的**多用户个人生活面板**：管理「网站监控 / 基金持仓 / 体重记录 / 资产月报」四个模块，并按用户各自配置的时间，把各模块日报/月报**定时推送**到微信机器人 / Webhook / 邮件。无前端框架，页面是服务端拼接的 HTML 字符串。

## 2. 技术栈与运行

- 运行时：Cloudflare Workers（`fetch` + `scheduled` 两个入口）
- 存储：D1（SQLite，业务数据） + KV（会话）
- 无构建步骤，纯 ES Module，`wrangler` 直接部署
- 图表：QuickChart.io 生成图片 URL（Worker 无 DOM，不能服务端跑 Chart.js）

```bash
npm run dev     # 本地开发（连远程 D1/KV 加 --remote）
npm run test    # 纯本地 (--local)
npm run deploy  # 部署
npm run tail    # 线上日志
```

## 3. 目录地图（改哪里看这里）

```
src/
├── index.js              入口。fetch/scheduled 双入口 + 定时调度编排 + 消息构造
├── router.js             轻量路由器 (method+path, :param) + json/html/error 辅助
├── config.js             全局常量（超时/并发、SESSION_TTL、默认 webhook）
├── api/                  【请求层】解析请求·鉴权·调 service/storage·返回 json()
│   ├── auth.api.js       注册/登录/登出/资料/改密/bootstrap 首个超管
│   ├── users.api.js      超管：用户管理、impersonate、全局时区设置
│   ├── notify.api.js     通知渠道 CRUD
│   ├── monitor.api.js    监控任务 CRUD + 日志
│   ├── fund.api.js       基金 CRUD/报告/分析/免密加仓
│   ├── weight.api.js     体重成员/记录/图表/免密填写
│   ├── asset.api.js      资产钱包/月度记录/目标/免密录入
│   └── push.api.js       统一推送配置 get/set + 立即推送
├── services/             【业务层】纯计算，无副作用、不碰存储
│   ├── schedule.service.js  ★ shouldRun/nowCN —— 定时是否到点判断（平台无关核心）
│   ├── monitor.service.js   批量访问 URL + formatResults 格式化
│   ├── notify.service.js    ★ 按渠道类型发送（wechat/webhook/email）；格式 text/html/markdown，markdown 仅 wechat/webhook（企业微信 markdown 类型，4096 字节截断）
│   ├── fund.service.js      天天基金取净值 + 收益计算 + 日报
│   ├── asset.service.js     净资产聚合 + 资产月报
│   ├── chart.service.js     QuickChart URL 构造
│   └── time.service.js      时区偏移 parseOffset / 时间格式化
├── auth/
│   ├── session.js        ★ KV 会话签发/校验/impersonate；cookie 名 sid
│   ├── middleware.js     requireAuth / requireAdmin
│   └── password.js       hash + generateToken
├── storage/              【存储层】业务代码只经 getStorage(env) 取适配器
│   ├── adapter.js        工厂：按 env.STORAGE_DRIVER 选 d1(默认)/mysql
│   ├── d1-adapter.js     ★ 全部 SQL 都在这，按域分组 users/notify/monitor/fund/weight/asset/push/settings
│   ├── mysql-adapter.js  预留桩
│   ├── kv-store.js       KV 会话读写
│   └── redis-store.js    预留桩
└── web/                  【前端】全部是 JS 字符串常量
    ├── layout.js         renderPage 外壳 + BASE_CSS（含移动端表格转卡片、.multi-pick）
    ├── pages.js          每页一个函数 → renderPage({body, script})
    └── assets.js         页面 JS 常量；COMMON_JS 公共头(api()/openModal/initMultiPick/时区辅助)
migrations/               手动逐个执行的 SQL，000N 递增编号
```

## 4. 请求生命周期

```
fetch(request, env, ctx)
  ① /cron?key=CRON_SECRET  → handleScheduled(null,...)   平台无关的定时触发入口
  ② router.handle()        → /api/* 命中则返回
  ③ handlePages()          → 页面路由（需登录页校验 KV 会话，未登录 302 /login）
  ④ 404
```

分层调用链固定为：**api → service → storage adapter**。
- api 层做鉴权：`requireAuth` 返回 session 对象**或** 401 Response，handler 必须判断 `instanceof Response` 提前 return。
- service 层**纯计算无副作用**，不碰存储、不发请求副作用（monitor/notify 例外，本身就是 IO 服务）。
- 消息构造：取数/编排在 `index.js` 的 `buildModuleMessage`，**文案模板集中在 `services/report.service.js`**（`buildFundReport` / `buildAssetReport` / `buildWeightReport`）——改推送文字、排版、链接展示只改此文件。

## 5. 定时调度（最关键设计，改前必读）

Worker 由 `wrangler.toml` 的 `crons = ["0 * * * *"]` **每小时唤醒一次**，进 `scheduled → handleScheduled`。
**几点/几号推送不写死在 cron 表达式里**，而是存数据库 `push_config` 表，每次唤醒读配置，用纯函数 `shouldRun(module, cfg, now)` 判断此刻是否到点。

- 好处：迁移到 Node/crontab 等平台，只需替换「每小时唤醒」触发方式，`schedule.service.js` 判断逻辑原样复用。
- 四类模块：`monitor`(监控) / `fund`(基金日报) / `weight`(体重日报) / `asset`(资产月报，按 `days` 每月某几天)。
- `push_config.hours` / `days` 是**逗号分隔多值字符串**（如 `"9,18"`）；旧单值列 `hour`/`day` 保留兼容，`shouldRun` 优先读多值。
- 手动触发全量调度（调试）：`GET /cron?key=<CRON_SECRET>`（未配 `CRON_SECRET` 则免 key）；`cron` 为空时忽略时间判断、全部执行。
- 基金净值每天 15 点刷一次缓存（`fund_nav_cache`）。

## 6. 存储抽象

业务代码**只**通过 `getStorage(env)` 拿适配器，**不写裸 SQL**。新增数据操作 → 加到 `d1-adapter.js` 对应分组方法，再在 api 层调用。
接口按域分组：`users / notify / monitor / fund / weight / asset / push / settings`。

**会话在 KV**（不是 D1）：`auth/session.js` 用 cookie `sid` + `env.KV`；用户密码等业务数据在 D1。

## 7. 鉴权与超管

- `requireAuth(request, env)` → session 或 401 Response；`requireAdmin` 额外校验 `role==='admin'`。
- 超管 **impersonate**：改写同一 token 的 KV session，保留 `admin_id` 用于恢复；`impersonating` 标志决定顶栏黄条。
- 首个超管通过 `POST /api/auth/bootstrap`（配合 `ADMIN_BOOTSTRAP_TOKEN`）创建。

## 8. 免密公开链接（无需登录，靠 token）

推送消息里拼绝对 URL（用 `env.PUBLIC_BASE_URL`）：

| 路径 | 用途 | token 来源 |
|------|------|-----------|
| `/f/:token` | 基金加仓 | `funds.share_token` |
| `/w/:token` | 体重填写 | `weight_members.share_token` |
| `/a/:token` | 资产录入 | `wallets.share_token` |
| `/wr/:token` | 体重报告查看 | `push_config.report_token` |
| `/ar/:token` | 资产报告查看 | `push_config.report_token` |

token 长期有效，缺失时代码自动 `generateToken()` 生成并持久化。

## 9. 数据模型（D1 表，随 migrations 演进）

| 表 | 说明 | 关键列 |
|----|------|--------|
| `users` | 用户 | role(user/admin)、status、nickname、weight_unit(jin/kg) |
| `notify_channels` | 通知渠道 | type(wechat/webhook/email)、url、method、headers_json、body_template |
| `monitor_tasks` / `monitor_logs` | 监控任务与日志 | return_type、channel_id、standalone |
| `funds` / `fund_nav_cache` | 基金持仓 / 净值缓存 | shares、cost_nav、share_token；nav、gsz |
| `weight_members` / `weight_records` | 体重成员/记录 | share_token；weight(存 kg)、record_date |
| `wallets` / `wallet_records` / `asset_goals` | 资产钱包/月记录/年目标 | type、balance/principal/profit、month(YYYY-MM) |
| `push_config` | ★ 统一推送配置 | (user_id,module) 主键、channel_id、format、enabled、hours、days、report_token |
| `app_settings` | 全局键值 | 目前存 `tz_offset` |

迁移**无自动机制**，逐个手动执行；新增改动在 `migrations/000N_描述.sql` 递增建文件，**注释必须独立成行**（不用行内注释）以兼容 D1 控制台逐条执行。

## 10. 时区处理（易踩坑）

面向中国用户但 Worker 跑在 UTC。全局偏移存 `app_settings.tz_offset`（默认 8），超管在用户管理页设置。
时间换算通过 `time.service.js` 的 `parseOffset` + `schedule.service.js` 的 `nowCN(nowMs, offset)`，贯穿所有推送/报告时间。
**注意历史遗留硬编码**：前端 `COMMON_JS` 日期函数仍可能含 `+8*3600*1000`，改时区逻辑时留意前后端一致。

## 11. 修改约定（对齐 CLAUDE.md）

- 正确性 > 最小修改 > 一致性 > 性能。改前读最新文件，不臆造变量、不越范围、不无关重构。
- 复用优先：当前模块 > 相似模块 > 公共模块 > 标准库；无法复用才加最小代码。
- 改公共接口/数据结构/跨模块逻辑 → 先梳理全量调用链再动。
- 净值接口失效只需改 `fund.service.js` 的 `fetchFundNav` 一处。
