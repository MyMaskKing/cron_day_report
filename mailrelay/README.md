# mailrelay

个人自用的极简 **HTTP → SMTP 邮件转发服务**。上游系统（定时面板、NAS 脚本、curl 等）只需带 token 发一个 HTTP JSON 请求，由本服务通过你自己的邮箱 SMTP 发出真实邮件。

- Node 20 + nodemailer，零 Web 框架；Docker 一条命令启动
- 内置中文管理后台：网页配置 SMTP、生成/停用/删除多个调用 token、修改管理员密码
- 单一配置文件 `data/config.json`：**网页后台和手工编辑文件同源**，手改后按 mtime 秒级热加载
- 无数据库、无状态依赖（除一个配置文件外）

```
上游调用方                 mailrelay 容器                    邮箱服务商
cron 面板 / 脚本  ──Bearer token──►  POST /send  ──SMTP/465──►  QQ/163/Gmail → 收件人
浏览器(你)        ──账号密码登录──►   管理后台 /admin
```

## 快速开始（Docker）

```bash
cp .env.example .env          # 改好初始管理员用户名/密码
docker compose up -d --build
```

浏览器打开 `http://主机IP:8080`，用 `.env` 里的管理员账号登录：

1. **配置 SMTP**：填服务器/端口/加密方式/账号/授权码，可先填测试收件人点「发送测试邮件」验证，再保存；
2. **生成 token**：在「调用 Token」卡片输入名称（如 `cron面板`）生成并复制；
3. 调用方用该 token 发信。

> 没填 `ADMIN_PASSWORD` 时，服务会随机生成一个初始密码打印在 `docker logs mailrelay` 里（仅显示一次），登录后请立即修改。

## 常见邮箱 SMTP 参数

| 邮箱 | 服务器 | 端口 | 加密 | 密码栏填什么 |
|---|---|---|---|---|
| QQ 邮箱 | `smtp.qq.com` | 465 | SSL | 设置→账号→开启 SMTP 后的**授权码** |
| 163 邮箱 | `smtp.163.com` | 465 | SSL | 设置→SMTP，开启后的**客户端授权密码** |
| Gmail | `smtp.gmail.com` | 465 | SSL | Google 账号**应用专用密码**（需两步验证；国内网络通常不通） |
| 自建/企业邮 | 看服务商文档 | 465/587 | SSL/STARTTLS | 对应密码 |

注意：密码栏一律填 **SMTP 授权码/应用密码**，不是邮箱网页登录密码。

## 调用发信接口

### HTTP 协议

`POST /send`，需要 token 鉴权（二选一）：

- 请求头：`Authorization: Bearer <token>`（推荐）
- 或查询参数：`POST /send?token=<token>`（curl 调试用；token 会出现在访问日志里）

请求体 JSON：

| 字段 | 必填 | 说明 |
|---|---|---|
| `to` | 是 | 收件人；字符串或数组均可，支持逗号/分号/空白分隔多个地址 |
| `subject` | 否 | 标题，默认「（无主题）」，最长 300 字 |
| `content` | 二选一 | 纯文本正文（与 `html` 至少有一个非空） |
| `html` | 二选一 | HTML 正文 |

成功：`200 {"success":true,"messageId":"…"}`
失败：`401` token 无效/停用 · `400` 参数错误 · `503` SMTP 未配置 · `502` SMTP 发送失败（错误信息已脱敏，不含授权码）

### curl 自测

```bash
curl -X POST http://127.0.0.1:8080/send \
  -H "Authorization: Bearer mr_xxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"to":"you@qq.com","subject":"测试","content":"mailrelay ok"}'
```

### 对接 cron_day_report 定时面板（无需改面板代码）

面板里新增一个**通用 Webhook**类型的通知渠道：

| 配置项 | 值 |
|---|---|
| URL | `http://主机IP:8080/send` |
| 请求头 JSON | `{"Authorization":"Bearer mr_xxxxxxxx","Content-Type":"application/json"}` |
| Body 模板 | `{"to":"you@qq.com","subject":"定时面板推送","content":"{{content}}"}` |

`{{content}}` 必须保留在双引号内，面板会自动做 JSON 转义（换行、引号安全）。

> 该方式邮件标题为模板里的固定标题。若以后想要每封邮件带动态标题（如「基金持仓日报 09-13」），再考虑面板侧 email 渠道透传 Authorization 头的小改动。

## 不用 Docker（裸 Node 运行）

需要 Node.js ≥ 20：

```bash
npm install
ADMIN_USERNAME=admin ADMIN_PASSWORD=your-password HTTP_PORT=8080 npm start
```

Windows PowerShell：

```powershell
$env:ADMIN_USERNAME="admin"; $env:ADMIN_PASSWORD="your-password"; npm start
```

配置默认写在项目下的 `data/` 目录（可用 `DATA_DIR` 环境变量改位置）。

## 配置文件 data/config.json

唯一事实源，结构如下（一般无需手改，网页后台就是在读写它）：

```json
{
  "admin": {
    "username": "admin",
    "passwordHash": "scrypt$<salt>$<hash>",
    "updatedAt": "2026-09-13T10:00:00.000Z"
  },
  "smtp": {
    "host": "smtp.qq.com", "port": 465, "secure": true,
    "user": "you@qq.com", "pass": "授权码", "fromName": "定时面板"
  },
  "tokens": [
    {
      "id": "uuid",
      "token": "mr_xxxxxxxx",
      "name": "cron面板",
      "enabled": true,
      "createdAt": "2026-09-13T10:01:00.000Z",
      "lastUsedAt": null
    }
  ]
}
```

- 用编辑器直接改这个文件，保存后**秒级自动热加载**，无需重启容器；
- 但不要和网页后台同时保存（后写覆盖先写）；
- `passwordHash` 由程序生成，**不要手工填明文密码**；要重置密码可停服后删掉整个 `data/config.json`，用 `.env` 重新引导；
- token 的 `lastUsedAt` 最多每 60 秒批量落盘一次（减少写盘），属正常现象。

## 安全说明

- 本服务面向**可信内网/本机**设计，默认走明文 HTTP。请只绑定内网或 `127.0.0.1`，或置于反代之后；
- 若要经公网使用（如 Cloudflare Tunnel、Nginx/Caddy），**必须由反代提供 HTTPS**，登录 cookie 在检测到 `X-Forwarded-Proto: https` 时才带 Secure；
- 没有任何有效 token 时 `/send` 一律 401，SMTP 未配置时 503，不会成为开放中继；
- 同一 IP 连续 5 次登录失败锁定 15 分钟；
- 日志只记录 token **名称**、收件人、标题、结果，不记录 token 值与 SMTP 授权码。

## 开发

```bash
npm test     # node:test：密码哈希/会话/限速、收件人解析、配置存储/热加载
npm start    # 启动服务
```

健康检查：`GET /healthz` → `{"ok":true}`。
