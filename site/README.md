# 官网（静态站）

产品官方落地页：纯静态、零依赖、零构建，与 Worker 应用完全解耦。

## 本地预览

任选其一：

```bash
npx serve site          # 然后访问 http://localhost:3000
# 或直接用浏览器打开 site/index.html（file:// 亦可正常运行）
```

## 目录

```
site/
├── index.html        # 单页全部内容
└── assets/
    ├── site.css      # 亮/暗双主题（跟随系统，可用 <html data-theme="light|dark"> 强制）
    ├── site.js       # 汉堡菜单（details 无 JS 兜底）、滚动渐显、年份
    ├── favicon.svg
    ├── og-card.png   # 社交分享卡 2400×1260（og:image / twitter 大图）
    └── og-card.html  # og-card.png 的可复现图源（用 Chrome --headless --screenshot 重截）
```

- 零第三方请求：不引网络字体、CDN、统计脚本。
- 链接仅指向：在线实例 `https://cron.10023456.xyz` 与 GitHub 仓库 / Releases / 文档。

## 部署

### Cloudflare Pages

```bash
npx wrangler pages deploy site --project-name cron-day-report-site
```

构建命令留空，输出目录填 `site`（若在仓库根配置则为 `site`）。

### GitHub Pages

仓库 Settings → Pages → Source 选 GitHub Actions，用官方 `actions/upload-pages-artifact` 把 `site/` 作为 `path` 发布即可；也可推到 `gh-pages` 分支并以该目录为站点根。

### 任意静态服务器 / nginx

把 `site/` 目录作为站点根即可，例如：

```bash
docker run --rm -p 8080:80 -v "$PWD/site":/usr/share/nginx/html:ro nginx:alpine
```

> - og 分享卡已内置（`assets/og-card.png`，2400×1260）；其 `og:image` 为相对路径，站点部署在域名根时直接可用，若挂在子路径需改成绝对 URL。重新出图：`chrome --headless=new --force-device-scale-factor=2 --window-size=1200,630 --screenshot=assets/og-card.png assets/og-card.html`。
> - 部署到自有域名后，可在 `index.html` 的 `<head>` 补 `<link rel="canonical">`。
