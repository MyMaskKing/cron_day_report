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

> [!TIP]
> Cloudflare 完整部署说明见 **[`DEPLOY.md`](./DEPLOY.md)**；不想用 Cloudflare 可用 **Docker 自部署**（纯 Node + better-sqlite3 模拟 D1/KV，`src/` 业务代码零改动，迁移全自动），详见 **[`docker/README.md`](./docker/README.md)**。

### 前置

- [Cloudflare](https://cloudflare.com) 账户
- Node.js ≥ 18.20
- `npm install`（devDependencies 已锁定 Wrangler 4，支持资源自动预置）、`npx wrangler login`

### 1. 从模板生成 wrangler.toml

仓库只提供脱敏模板 `wrangler.toml.example`（真实 `wrangler.toml` 已被 `.gitignore` 忽略，不入库）。复制一份并按需修改 `name`（Worker 名全账户唯一）：

```bash
cp wrangler.toml.example wrangler.toml
```

模板里 D1 的 `database_id`、KV 的 `id` **都留空，不要手动建库**。

### 2. 首次部署（自动创建 D1 / KV）

```bash
npx wrangler deploy
```

Wrangler 4 会自动创建名为 `cron_db` 的 D1 数据库、名为 `KV` 的命名空间与每小时 Cron 触发器，
并把生成的资源 ID 回写进本机 `wrangler.toml`。

### 3. 创建 R2 存储桶（待办附件 / Markdown 图片，必须手动）

附件（待办备注、基金投资策略等 Markdown 内嵌的图片/文件）的**文件本体存 R2**，R2 桶不会随 `wrangler deploy` 自动创建，首次使用附件功能前手动执行一次（桶名和绑定名固定，见 `wrangler.toml` 的 `[[r2_buckets]]`）：

```bash
npx wrangler r2 bucket create cron-files
```

未创建/未绑定时，上传会返回 503「附件存储未配置」，其余功能不受影响。
D1 里只存文件元数据（统一 `files` 表）；R2 对象按来源分前缀 `todo/<token>`、`user/<token>`。

### 4. 建表（自动）

首次部署后第一次访问（或首个整点 Cron）Worker 会检测空库并自动建出全部表，无需手动执行 SQL；
预建仅备用：`npx wrangler d1 execute cron_db --remote --file=migrations/0001_init.sql`。
之后新增的 `000N_*.sql` 仅老库升级时按编号手动执行。

### 5. 配置密钥（可选但建议）

```bash
npx wrangler secret put ADMIN_BOOTSTRAP_TOKEN   # 创建首个超管时校验
npx wrangler secret put CRON_SECRET             # 保护 /cron 手动触发入口（不设则免 key）
```

`PUBLIC_BASE_URL`、`STORAGE_DRIVER` 等明文变量可在 Dashboard → Settings → Variables 配置；
站点公开地址推荐部署后登录超管在「系统设置」页填写（优先级最高、换域名免重新部署）。

### 6. 初始化超管

访问 Worker 域名进入「系统初始化」页创建首个超管（配置了 `ADMIN_BOOTSTRAP_TOKEN` 需填写），
登录后到系统设置填入站点公开地址即可开始使用。

## 常用命令

```bash
npm run dev       # 本地开发（本地自动创建 D1/KV，miniflare 持久化）
npm run serve     # 纯 Node + better-sqlite3 运行（不依赖 Cloudflare）
npm run deploy    # 部署到 Cloudflare
npm run tail      # 查看线上实时日志
```

手动触发一次全量定时调度（调试用）：`GET /cron?key=<CRON_SECRET>`。

## Android 客户端

`android/` 是独立的 Gradle/Compose 项目（包名 `xyz.a10023456.todowidget`，minSdk 26，JVM 17），实现待办清单的桌面小组件（Glance App Widget）+ 内嵌网页的应用壳，通过 Worker 的 todo 公开/登录态接口通信。

### 本地构建

```bash
cd android
./gradlew :app:assembleDebug     # 输出 app/build/outputs/apk/debug/app-debug.apk
./gradlew :app:assembleRelease   # 输出 app/build/outputs/apk/release/app-release.apk
```

### CI 自动构建

`.github/workflows/build-android.yml`：push 到 `main`（改动 `android/` 或 workflow 本身）自动构建并发布为 pre-release；也可在 Actions 页手动触发并指定版本号。

版本号由 CI 环境变量注入：`VERSION_CODE`（默认取 `github.run_number`）、`VERSION_NAME`；本地构建回退 `1` / `1.0.0`。

### Release 签名配置

CI 从 GitHub Secrets 读取 release 签名；**未配置时自动回退 debug 签名**，不影响构建。配置后所有 CI 包使用同一把 release key，可互相覆盖升级（首次需先卸载手机上的旧 debug 包）。

> [!WARNING]
> keystore 文件和密码是**应用身份凭证**，丢失后将无法再发布同签名升级包。请自行妥善备份，**切勿**把真实密码或 `.keystore` 内容提交到仓库。

#### 1. 生成密钥（本地执行一次）

需要 JDK 的 `keytool`（随 Android Studio 自带）：

```bash
keytool -genkeypair -v \
  -keystore release.keystore \
  -alias todowidget \
  -keyalg RSA -keysize 2048 -validity 36500 \
  -storepass 123456 \
  -keypass 123456
```

记下：`.keystore` 文件路径、`-alias`（别名，如 `todowidget`）、库密码、密钥密码。

#### 2. 配置 GitHub Secrets

仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**，添加以下 4 个：

| Secret 名 | 值 |
|-----------|-----|
| `RELEASE_KEYSTORE_BASE64` | `release.keystore` 文件的 base64 编码（见下） |
| `RELEASE_STORE_PASSWORD` | 上一步的库密码 `<你的库密码>` |
| `RELEASE_KEY_ALIAS` | 上一步的别名，如 `todowidget` |
| `RELEASE_KEY_PASSWORD` | 上一步的密钥密码 `<你的密钥密码>` |

生成 base64（在 `release.keystore` 所在目录）：

```bash
# Linux / macOS / Git Bash
base64 -w 0 release.keystore

# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$PWD\release.keystore"))
```
把输出整段粘贴进 `RELEASE_KEYSTORE_BASE64`（不要换行或加引号）。

#### 3. 本地用 release 签名构建（可选）

Gradle 通过以下环境变量读取签名（与 CI 同名），设置后 `assembleRelease` 即使用 release 签名：

| 环境变量 | 说明 |
|----------|------|
| `RELEASE_KEYSTORE_PATH` | `release.keystore` 的绝对/相对路径 |
| `RELEASE_STORE_PASSWORD` | 库密码 |
| `RELEASE_KEY_ALIAS` | 别名 |
| `RELEASE_KEY_PASSWORD` | 密钥密码 |

未设置这些变量（或路径不存在）时，`assembleRelease` 不启用自定义签名，`assembleDebug` 始终使用本机 debug key。

## 二次开发

架构分层、模块地图、定时调度原理、数据模型、时区坑等详见 **[`DEV_GUIDE.md`](./DEV_GUIDE.md)**。

## 许可证

MIT
