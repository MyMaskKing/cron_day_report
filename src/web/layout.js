/**
 * HTML 页面框架：统一 CSS、导航、页面外壳
 */

// 与 static.js 构成循环 import：仅在 renderPage 函数体内调用 assetUrl（请求时才执行），
// ESM live binding 下模块已全部就绪。静态资源 URL 带「内容 hash」版本：内容变 hash 自动变、
// 浏览器自动重新下载，内容不变则走 immutable 强缓存零传输，无需手动维护版本号。
import { assetUrl } from './static.js';

/**
 * 渲染完整 HTML 页面
 * @param {Object} opts - { title, body, scripts?, script? }
 *   scripts: 页特定外链脚本文件名数组（如 ['todo-core.js','page-todo.js']），common.js 恒载
 *   script : 需内联的小段 bootstrap 脚本（可空）；大段 JS 一律走 /s/ 外链以便缓存
 * @returns {string}
 */
function renderPage({ title = '控制台', body = '', script = '', scripts = [], theme = 'light' }) {
  const jsLinks = [assetUrl('common.js')]
    .concat(scripts.map(s => assetUrl(s)))
    .map(src => `<script src="${src}"></script>`)
    .join('\n');
  // data-theme 服务端直出: 登录态页按用户偏好(light/dark/eye)首屏即正确配色, 无 JS 闪白;
  // 免密/登录页固定 light
  const themeAttr = ['light', 'dark', 'eye'].includes(theme) ? theme : 'light';
  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="${themeAttr}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<link rel="stylesheet" href="${assetUrl('core.css')}">
</head>
<body class="booting">
<div id="globalLoading" class="boot-visible" style="display:flex;">
  <div style="text-align:center;">
    <div class="spinner"></div>
    <div id="loadingText" style="margin-top:8px;color:var(--brand);font-size:14px;">加载中…</div>
    <div id="loadingBar" class="loading-bar" style="display:none;"><div class="lb-fill"></div></div>
  </div>
</div>
<div id="modalMask" class="modal-mask">
  <div class="modal-box">
    <div class="modal-head"><span id="modalTitle"></span><span id="modalClose">&times;</span></div>
    <div id="modalBody" class="modal-body"></div>
  </div>
</div>
${body}
${jsLinks}
${script ? `<script>${script}</script>` : ''}
</body>
</html>`;
}

const BASE_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }

/* ============ 主题变量: :root 为浅色(现状值), [data-theme=dark/eye] 覆盖 ============
   结构性配色(页面底/文字/容器/边框/输入/语义色)全部走变量, 跟随 data-theme;
   装饰性品牌渐变(topbar/按钮)、模块 accent、优先级色等三套主题保留, 不在此列。 */
:root {
  --bg: #F6F5F2;
  --bg-glow-1: rgba(255,122,89,.15);
  --bg-glow-2: rgba(168,85,247,.12);
  --bg-glow-3: rgba(59,130,246,.10);
  --text: #1f2329;          /* 主文字/标题 */
  --text-strong: #14141E;   /* 数字/强标题 */
  --label: #6C6C7E;         /* 表单标签/表头/小标题(原 #6C6C7E) */
  --link-dim: #5a6b9a;      /* 可点击次要文字: 操作图标/筛选钮(原 #5a6b9a) */
  --muted: #999;            /* 弱化说明 .muted/关闭钮(原 #999) */
  --muted-2: #8890b8;       /* 蓝灰说明 todo-count/note(原 #8890b8) */
  --faint: #b0b6c8;         /* 完成删除线/最弱 */
  --surface: #fff;          /* 纯白容器: 弹窗/菜单/行/卡片/勾选框 */
  --surface-2: #f7f8fa;     /* 次级容器: root 行/面包屑 */
  --surface-3: #f8f9ff;     /* 统计条 */
  --surface-done: #fafbff;  /* 已完成卡片底 */
  --card-glass: rgba(255,255,255,.72);   /* 玻璃卡片底 */
  --card-glass-solid: rgba(255,255,255,.92);
  --card-border: rgba(255,255,255,.6);
  --stat-glass: rgba(255,255,255,.55);
  --input-bg: rgba(255,255,255,.75);
  --border: #e9ecf3;        /* 容器/分隔边 */
  --border-strong: #d9dbe3; /* 输入/面板边 */
  --border-input: #E4E1D8;
  --check-ring: #c9cfda;    /* 未勾选圆圈边框(原 #c7ccd6/#d9d9d9) */
  --hover-bg: #f0f2f8;      /* 中性 hover 底 */
  --hover-brand: #f0eafb;   /* 品牌浅 tint hover 底 */
  --brand-border: #dfe4fb;  /* 品牌浅紫边框(hover/添加框/拖拽) */
  --brand: #A855F7;
  --on-brand: #fff;
  --danger: #cf1322;
  --ok: #34b34a;
  --danger-bg: #fff1f0;
  --ok-bg: #f6ffed;
  --th-bg: rgba(20,20,40,.025);
  --th-border: rgba(20,20,40,.06);
  --loading-mask: rgba(246,245,242,.65);
  --sticky-th: rgba(246,245,242,.96);
  --code-bg: rgba(127,127,127,.15);
}
[data-theme="dark"] {
  --bg: #14141E;
  --bg-glow-1: rgba(255,122,89,.10);
  --bg-glow-2: rgba(168,85,247,.16);
  --bg-glow-3: rgba(59,130,246,.14);
  --text: #e6e8f0;
  --text-strong: #f2f3f8;
  --label: #a8b0c4;
  --link-dim: #b6bed6;
  --muted: #8a90a6;
  --muted-2: #8890b8;
  --faint: #6b7390;
  --surface: #1e2230;
  --surface-2: #262b3d;
  --surface-3: #232839;
  --surface-done: #1b1f2c;
  --card-glass: rgba(30,34,48,.72);
  --card-glass-solid: rgba(30,34,48,.94);
  --card-border: rgba(255,255,255,.08);
  --stat-glass: rgba(255,255,255,.04);
  --input-bg: rgba(255,255,255,.06);
  --border: #2e3448;
  --border-strong: #3a4157;
  --border-input: #343b52;
  --check-ring: #5a6280;
  --hover-bg: rgba(255,255,255,.06);
  --hover-brand: rgba(168,85,247,.20);
  --brand-border: rgba(185,123,255,.45);
  --brand: #b97bff;
  --danger: #ff6b6b;
  --ok: #4ade80;
  --danger-bg: rgba(255,107,107,.14);
  --ok-bg: rgba(74,222,128,.12);
  --th-bg: rgba(255,255,255,.04);
  --th-border: rgba(255,255,255,.08);
  --loading-mask: rgba(10,12,20,.6);
  --sticky-th: rgba(30,34,48,.96);
  --code-bg: rgba(255,255,255,.12);
}
[data-theme="eye"] {
  --bg: #f3eee0;
  --bg-glow-1: rgba(214,168,90,.14);
  --bg-glow-2: rgba(168,85,247,.10);
  --bg-glow-3: rgba(90,160,140,.10);
  --text: #4a4030;
  --text-strong: #3a3226;
  --label: #7a6f58;
  --link-dim: #6a5f44;
  --muted: #a2977d;
  --muted-2: #94886e;
  --faint: #b3a888;
  --surface: #faf6ea;
  --surface-2: #f3eddb;
  --surface-3: #f5f0e0;
  --surface-done: #f5efe0;
  --card-glass: rgba(250,246,234,.72);
  --card-glass-solid: rgba(250,246,234,.94);
  --card-border: rgba(255,255,255,.6);
  --stat-glass: rgba(250,246,234,.55);
  --input-bg: rgba(255,253,246,.8);
  --border: #e3dcc4;
  --border-strong: #d4cbb0;
  --border-input: #ddd3b8;
  --check-ring: #c8bfa8;
  --hover-bg: #efe8d4;
  --hover-brand: #f1e7fb;
  --brand-border: #d9cdf5;
  --brand: #9333ea;
  --danger: #c0392b;
  --ok: #2f9e44;
  --danger-bg: #fbeae7;
  --ok-bg: #e9f5ea;
  --th-bg: rgba(120,100,50,.05);
  --th-border: rgba(120,100,50,.10);
  --loading-mask: rgba(243,238,224,.65);
  --sticky-th: rgba(243,238,224,.96);
  --code-bg: rgba(120,100,50,.14);
}

/* 暖米底 + 三点极淡径向光斑 (珊瑚/紫/蓝), 给玻璃卡片留天然光源 */
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Twemoji Mozilla', EmojiSymbols;
  color: var(--text-strong);
  background:
    radial-gradient(1000px 600px at 12% -5%, var(--bg-glow-1), transparent 55%),
    radial-gradient(900px 550px at 88% 8%, var(--bg-glow-2), transparent 55%),
    radial-gradient(1100px 700px at 50% 100%, var(--bg-glow-3), transparent 55%),
    var(--bg);
  /* 不再 fixed: fixed + card 的 backdrop-filter 会让磨砂内容始终采样固定背景,
     滚动时"卡片动、磨砂内容不动"造成层叠错位感 (基金页 card 多最明显) */
  min-height: 100vh;
}
a { color: var(--brand); text-decoration: none; }
/* topbar: 珊瑚→紫→蓝 三色 200% 渐变, 首次加载流光一次 (3.2s ease-out) 后定格 */
.topbar {
  color: #fff; padding: 14px 24px;
  display: flex; align-items: center; justify-content: space-between;
  box-shadow: 0 4px 20px rgba(168, 85, 247, .18);
  background: linear-gradient(120deg, #FF7A59 0%, #A855F7 50%, #3B82F6 100%);
  background-size: 200% 100%;
  animation: topbarIntro 3.2s cubic-bezier(.4, 0, .2, 1) both;
}
@keyframes topbarIntro {
  from { background-position: 0% 50%; }
  to   { background-position: 100% 50%; }
}
.topbar h1 { font-size: 16px; font-weight: 600; letter-spacing: .2px; }
/* Logo 组：小火箭 + 双主题词, 套在一个深色玻璃胶囊里当 logo 底座 */
.topbar .brand {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 5px 12px 5px 10px;
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(20, 10, 50, .28) 0%, rgba(60, 20, 90, .22) 100%);
  border: 1px solid rgba(255, 255, 255, .22);
  box-shadow: 0 2px 8px rgba(30, 20, 80, .18), 0 0 0 1px rgba(255,255,255,.08) inset;
  line-height: 1;
}
.topbar .brand-rocket {
  display: inline-flex; width: 16px; height: 16px; line-height: 1;
  /* 尾焰: 珊瑚发光, 呼应 topbar 渐变起点 */
  filter: drop-shadow(0 2px 3px rgba(255, 122, 89, .7));
  animation: rocketPulse 2.4s ease-in-out infinite;
}
.topbar .brand-rocket svg { width: 100%; height: 100%; display: block; }
/* 两个主题词同字号 (14px, 权重不同以形成节奏, 又不破坏"同等地位") */
.topbar .brand-w1 { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: .3px; }
.topbar .brand-sep { width: 3px; height: 3px; border-radius: 50%; background: rgba(255,255,255,.55); }
.topbar .brand-w2 {
  font-size: 14px; font-weight: 700; letter-spacing: .3px;
  /* 青→亮蓝渐变字, 在深紫玻璃底座上对比度更高; 冷端呼应 topbar 主色 #3B82F6 */
  background: linear-gradient(90deg, #7DD3FC 0%, #38BDF8 50%, #A5B4FC 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  /* 文字发光: 让冷色字在渐变背景上"浮起" */
  filter: drop-shadow(0 0 6px rgba(125, 211, 252, .5));
}
@keyframes rocketPulse {
  0%, 100% { filter: drop-shadow(0 2px 3px rgba(255, 122, 89, .7)); }
  50%      { filter: drop-shadow(0 3px 6px rgba(255, 122, 89, 1)); }
}
/* Logo 右侧常驻当前时间: 品牌胶囊外单独一块玻璃胶囊, 与 brand 视觉平衡 */
.topbar .brand-clock {
  display: inline-flex; align-items: center; gap: 6px;
  margin-left: 10px; padding: 4px 12px;
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(20, 10, 50, .22) 0%, rgba(60, 20, 90, .18) 100%);
  border: 1px solid rgba(255, 255, 255, .18);
  box-shadow: 0 2px 8px rgba(30, 20, 80, .12);
  font-size: 13px; font-weight: 600; color: rgba(255, 255, 255, .92);
  font-variant-numeric: tabular-nums; letter-spacing: .3px;
  line-height: 1;
}
.topbar .brand-clock::before {
  content: '⏱'; font-size: 12px; opacity: .85;
}
/* 移动端(含大屏手机/小平板)取消 logo 玻璃底座, 只留图标+文字, 寸土寸金 */
@media (max-width: 900px) {
  .topbar .brand {
    padding: 0 !important; gap: 6px !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    border-radius: 0 !important;
  }
}
.topbar .nav a {
  color: #fff; margin-left: 18px; font-size: 14px; opacity: .82;
  position: relative; padding-bottom: 4px;
  transition: opacity .16s;
}
.topbar .nav a:hover { opacity: 1; }
.topbar .nav a.active { opacity: 1; }
.topbar .nav a.active::after {
  content: ''; position: absolute; left: 0; right: 0; bottom: -2px;
  height: 2px; border-radius: 2px;
  background: rgba(255,255,255,.95);
  box-shadow: 0 0 10px rgba(255,255,255,.6);
}
.topbar .user { font-size: 14px; display: flex; align-items: center; gap: 10px; }
/* 设置/登出：半透明胶囊按钮，在紫色 topbar 上清晰可点 */
.topbar .user a.act-btn {
  display: inline-flex; align-items: center; gap: 5px;
  margin-left: 0; padding: 6px 13px; border-radius: 999px;
  background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.28);
  color: #fff; font-size: 13px; line-height: 1; white-space: nowrap;
  transition: background .16s, border-color .16s, transform .12s;
}
.topbar .user a.act-btn:hover { background: rgba(255,255,255,.30); border-color: rgba(255,255,255,.55); text-decoration: none; }
.topbar .user a.act-btn:active { transform: translateY(1px); }
.impersonate-banner { background: #fff3cd; color: #856404; padding: 10px 24px; font-size: 14px; text-align: center; border-bottom: 1px solid #ffe58f; }
.impersonate-banner a { color: var(--danger); font-weight: 600; margin-left: 8px; }
.container { max-width: 1000px; margin: 24px auto; padding: 0 16px; }
/* 液态玻璃卡片: 半透明白 + 20px 磨砂 + 1px 白高光边 + 冷灰阴影 */
.card {
  background: var(--card-glass);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
  backdrop-filter: blur(20px) saturate(140%);
  border: 1px solid var(--card-border);
  border-radius: 14px;
  padding: 20px; margin-bottom: 18px;
  box-shadow: 0 1px 3px rgba(20, 20, 40, .04), 0 10px 30px rgba(20, 20, 40, .05);
  transition: transform .18s ease, box-shadow .22s ease, border-color .18s ease;
  /* backdrop-filter 会为每张 card 创建独立堆叠上下文, 兄弟 card 之间按 DOM 顺序绘制;
     不显式给 z-index 时, 上方 card 里绝对定位的弹窗(.mp-menu)溢出到下方 card 会被后者遮住;
     统一 position:relative + z-index 让 card 参与父级堆叠排序 */
  position: relative;
  z-index: 1;
}
/* 当前打开多选弹窗 / 操作下拉菜单的 card 提升到最上层, 弹窗才能压过后续 card */
.card:has(.mp-menu.show),
.card:has(.dropdown-menu.show) { z-index: 100; }
.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 6px rgba(20, 20, 40, .05), 0 16px 40px rgba(168, 85, 247, .10);
  border-color: var(--card-border);
}
/* 不支持 backdrop-filter 的旧浏览器: 退化到实心浅白, 视觉损失磨砂感但不影响可用 */
@supports not ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))) {
  .card { background: var(--card-glass-solid); }
}
.card h2 { font-size: 16px; margin-bottom: 14px; color: var(--text-strong); }
/* 主按钮: 三色渐变 + 内高光, hover 亮 6% + 品牌柔光, 点击涟漪 */
.btn {
  position: relative; overflow: hidden;
  display: inline-block; padding: 8px 16px; border: none; border-radius: 8px;
  background: linear-gradient(120deg, #FF7A59 0%, #A855F7 50%, #3B82F6 100%);
  background-size: 160% 100%; background-position: 0% 50%;
  color: #fff; font-size: 14px; font-weight: 500; cursor: pointer;
  box-shadow: 0 2px 6px rgba(168, 85, 247, .28), inset 0 1px 0 rgba(255,255,255,.24);
  transition: transform .12s ease, box-shadow .18s ease, filter .18s ease, background-position .4s ease;
}
.btn:hover { filter: brightness(1.06); background-position: 100% 50%; box-shadow: 0 6px 18px rgba(168, 85, 247, .38), inset 0 1px 0 rgba(255,255,255,.28); }
.btn:active { transform: translateY(1px); }
.btn::after {
  content: ''; position: absolute; left: 50%; top: 50%;
  width: 0; height: 0; border-radius: 50%;
  background: radial-gradient(circle, rgba(255,255,255,.55) 0%, rgba(255,255,255,0) 70%);
  transform: translate(-50%, -50%);
  pointer-events: none; opacity: 0;
}
.btn:active::after { width: 260px; height: 260px; opacity: 1; transition: width .38s ease-out, height .38s ease-out, opacity .5s ease-out; }
.btn.danger { background: linear-gradient(135deg, #F87171, #EF4444); box-shadow: 0 2px 6px rgba(239, 68, 68, .28), inset 0 1px 0 rgba(255,255,255,.18); }
.btn.danger:hover { filter: brightness(1.06); box-shadow: 0 6px 18px rgba(239, 68, 68, .38), inset 0 1px 0 rgba(255,255,255,.22); }
.btn.gray { background: linear-gradient(135deg, #8A8A99, #6C6C7E); box-shadow: 0 2px 6px rgba(60, 66, 80, .18), inset 0 1px 0 rgba(255,255,255,.14); }
.btn.sm { padding: 4px 10px; font-size: 12px; }
/* select 复用 .btn 样式时(如 profitRange/unitSel), select 本身是灰底白字,
   但原生 <option> 展开层由浏览器接管、白底继承 color:#fff 会出现"白底白字看不清";
   显式给 option 打回深色文字 + 白底 */
select.btn option { color: var(--text-strong); background: var(--surface); }
input, select, textarea { width: 100%; padding: 9px 12px; border: 1px solid var(--border-input); border-radius: 8px; font-size: 14px; margin-bottom: 12px; font-family: inherit; background: var(--input-bg); color: var(--text); }
input:focus, select:focus, textarea:focus { outline: none; border-color: var(--brand); box-shadow: 0 0 0 3px rgba(168, 85, 247, .14); background: var(--surface); }
label { display: block; font-size: 13px; color: var(--label); margin-bottom: 5px; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--th-border); }
th { color: var(--label); font-weight: 600; background: var(--th-bg); }
/* tag: 章戳感, 半透明底 + 同色描边 + 底部 inset shadow */
.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; border: 1px solid transparent; box-shadow: inset 0 -1px 0 rgba(0,0,0,.04); }
.tag.admin { background: #FEE4E2; color: #B42318; border-color: #FDA29B; }
.tag.user { background: #DBEAFE; color: #1D4ED8; border-color: #BFDBFE; }
.tag.active { background: #D1FAE5; color: #047857; border-color: #A7F3D0; }
.tag.disabled { background: #F0EFEA; color: #857D6B; border-color: #DDD8CC; }
.tag.ok { background: #D1FAE5; color: #047857; border-color: #A7F3D0; }
.tag.fail { background: #FEE4E2; color: #B42318; border-color: #FDA29B; }
/* debt: 负债/欠款专用, 与 fail 同红系但更深沉如账单, 与 disabled(停用灰) 语义拉开 */
.tag.debt { background: #FEF0EB; color: #C2410C; border-color: #FDBA8C; font-weight: 600; letter-spacing: .3px; }
/* scroll-box: 历史/记录表格外壳, 固定高度, 表头 sticky, 避免记录多了撑爆页面 */
.scroll-box { max-height: 360px; overflow-y: auto; border: 1px solid var(--th-border); border-radius: 10px; }
.scroll-box > table { border-collapse: separate; border-spacing: 0; }
.scroll-box > table thead th {
  position: sticky; top: 0; z-index: 2;
  background: var(--sticky-th);
  -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
}
/* 移动端表格转卡片模式下, sticky thead 已被 display:none, 高度也放宽避免拥挤 */
@media (max-width: 640px) { .scroll-box { max-height: 60vh; } }
.login-wrap { max-width: 360px; margin: 80px auto; }
.login-wrap .card { padding: 30px; }
.login-wrap h1 { text-align: center; margin-bottom: 20px; font-size: 22px; color: var(--brand); }
/* ===== 登录页：斜对角全屏流动 ===== */
.lg-fs { position: fixed; inset: 0; overflow: hidden; background: radial-gradient(120% 120% at 25% 15%, #1a1f4a 0%, #0d1130 45%, #070a1f 100%); display: flex; align-items: center; justify-content: flex-end; padding: 0 clamp(20px, 7vw, 120px); }
.lg-field { position: absolute; top: 50%; left: 50%; width: 170vw; height: 190vh; transform: translate(-50%, -50%) rotate(-18deg); display: flex; flex-direction: column; justify-content: center; gap: clamp(10px, 2.4vh, 26px); pointer-events: none; opacity: .55; }
.lg-row { display: flex; gap: 16px; white-space: nowrap; will-change: transform; }
.lg-row.a { animation: lgDriftL 42s linear infinite; }
.lg-row.b { animation: lgDriftR 52s linear infinite; }
.lg-row.c { animation: lgDriftL 62s linear infinite; }
.lg-chip { display: inline-flex; align-items: center; gap: 8px; padding: 9px 20px; border-radius: 999px; font-size: clamp(15px, 1.7vw, 22px); font-weight: 600; letter-spacing: .2px; color: rgba(226, 231, 255, .5); border: 1px solid rgba(146, 160, 255, .18); background: rgba(120, 130, 220, .05); }
.lg-chip.hot { color: #0a0e27; border-color: transparent; background: linear-gradient(120deg, #a5b4fc, #7dd3fc); }
.lg-chip.glow { color: #38f0d4; border-color: rgba(56, 240, 212, .35); }
@keyframes lgDriftL { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@keyframes lgDriftR { from { transform: translateX(-50%); } to { transform: translateX(0); } }
.lg-brand { position: absolute; left: clamp(20px, 7vw, 120px); top: 50%; transform: translateY(-50%); z-index: 2; max-width: 46vw; }
.lg-logo { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; letter-spacing: .5px; color: #c7d0ff; background: rgba(146, 160, 255, .12); border: 1px solid rgba(146, 160, 255, .22); margin-bottom: 22px; }
.lg-title { font-size: clamp(30px, 4.6vw, 60px); font-weight: 800; line-height: 1.08; letter-spacing: -1.5px; background: linear-gradient(118deg, #a5b4fc 0%, #e0aaff 48%, #7dd3fc 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
.lg-title em { font-style: normal; background: linear-gradient(120deg, #38f0d4, #7dd3fc); -webkit-background-clip: text; background-clip: text; color: transparent; }
.lg-sub { margin-top: 18px; font-size: clamp(14px, 1.4vw, 17px); line-height: 1.6; color: rgba(214, 220, 255, .68); max-width: 30ch; }
.lg-panel { position: relative; z-index: 3; width: 384px; max-width: 92vw; background: rgba(255, 255, 255, .94); backdrop-filter: blur(22px); -webkit-backdrop-filter: blur(22px); border: 1px solid rgba(255, 255, 255, .55); border-radius: 20px; padding: 32px 30px; box-shadow: 0 30px 90px rgba(4, 7, 30, .55); }
.lg-panel h2 { font-size: 20px; font-weight: 700; color: var(--text); margin-bottom: 4px; }
.lg-panel .lg-hint { font-size: 13px; color: var(--muted-2); margin-bottom: 18px; }
/* 登录面板内的主按钮: 去掉珊瑚粉那一段, 用靛蓝→紫收敛渐变, 与深墨蓝底衬 */
.lg-panel .btn:not(.gray):not(.danger) {
  background: linear-gradient(120deg, #4F63E8 0%, #7C5CFF 55%, #A855F7 100%);
  background-size: 160% 100%; background-position: 0% 50%;
  box-shadow: 0 2px 8px rgba(79, 99, 232, .35), inset 0 1px 0 rgba(255,255,255,.24);
}
.lg-panel .btn:not(.gray):not(.danger):hover {
  background-position: 100% 50%;
  box-shadow: 0 8px 22px rgba(124, 92, 255, .42), inset 0 1px 0 rgba(255,255,255,.28);
}
.lg-tabs { display: flex; gap: 8px; margin-bottom: 18px; }
.lg-tabs .btn { flex: 1; }
/* 登录/注册切换标签：分段控制器样式（激活=白底主色字，非激活=浅灰底灰字），
   与表单底部紫色实心提交按钮区分，避免两个"登录"按钮撞样式导致误点 */
.lg-panel .lg-tabs .btn,
.lg-panel .lg-tabs .btn.gray,
.lg-panel .lg-tabs .btn:not(.gray):not(.danger) {
  background: rgba(136,144,184,.14);
  color: #8a90a6;
  border: 1px solid transparent;
  box-shadow: none;
}
.lg-panel .lg-tabs .btn:not(.gray) {
  background: #ffffff;
  color: #4F63E8;
  border-color: rgba(79,99,232,.45);
  box-shadow: 0 2px 10px rgba(79,99,232,.20);
  font-weight: 700;
}
.lg-panel .lg-tabs .btn:hover,
.lg-panel .lg-tabs .btn.gray:hover {
  background-position: 0% 50%;
  background-color: rgba(136,144,184,.24);
  box-shadow: none;
}
.lg-panel .lg-tabs .btn:not(.gray):hover {
  background-color: #ffffff;
  box-shadow: 0 2px 10px rgba(79,99,232,.20);
}
@media (max-width: 860px) { .lg-fs { justify-content: center; padding: 0 16px; } .lg-brand { display: none; } .lg-field { opacity: .4; } }
@media (prefers-reduced-motion: reduce) { .lg-row { animation: none; } }
.msg { padding: 10px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 14px; display: none; }
.msg.err { background: var(--danger-bg); color: var(--danger); display: block; }
.msg.ok { background: var(--ok-bg); color: var(--ok); display: block; }
.md-body { font-size: 14px; line-height: 1.6; word-break: break-word; }
.md-body > p { margin: 8px 0; }
.md-body > h3 { margin: 12px 0 6px; font-size: 16px; }
.md-body > h4 { margin: 10px 0 4px; font-size: 14px; }
.md-body > ul, .md-body > ol { margin: 6px 0; padding-left: 22px; }
.md-body li { margin: 3px 0; }
.md-body code { background: var(--code-bg); padding: 1px 5px; border-radius: 4px; font-size: .9em; }
.md-body a { color: var(--brand); text-decoration: underline; }
.row { display: flex; gap: 12px; flex-wrap: wrap; }
.row > * { flex: 1; min-width: 140px; }
.muted { color: var(--muted); font-size: 13px; }
.grid-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 14px; }
/* stat: 玻璃底 + hairline, 数字深墨黑 + Mono 表格数字, hover 微浮起 */
.stat {
  background: var(--stat-glass);
  -webkit-backdrop-filter: blur(12px) saturate(140%);
  backdrop-filter: blur(12px) saturate(140%);
  border: 1px solid var(--card-border);
  border-radius: 12px; padding: 16px; text-align: center;
  transition: transform .16s ease, box-shadow .18s ease;
}
.stat:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(168, 85, 247, .10); }
/* 数字统一: 深墨黑, tabular-nums 让千分位数字等宽对齐 */
.stat .num {
  font-size: 28px; font-weight: 700; color: var(--text-strong);
  font-variant-numeric: tabular-nums;
  letter-spacing: -.01em;
}
/* 图标态: SVG 图标居中在圆角玻璃方块里, 尺寸/颜色由 accent 规则控制 */
.stat .num.num--icon {
  color: var(--label); font-size: 32px; line-height: 1;
  display: inline-flex; align-items: center; justify-content: center;
  width: 56px; height: 56px; margin: 0 auto 4px; border-radius: 16px;
  background-color: var(--stat-glass);
  border: 1px solid var(--card-border);
  font-variant-numeric: normal;
  transition: background-color .2s ease, box-shadow .2s ease, transform .2s ease, color .2s ease;
}
.stat .num.num--icon svg { width: 28px; height: 28px; display: block; }
/* 6 个功能入口各自 accent 色, 图标默认就着色, hover 时卡片渗出对应色相 + 图标环发光 */
.stat-nav .stat { transition: transform .18s ease, box-shadow .2s ease, border-color .2s ease; }
.stat-nav .stat[data-nav="monitor"] .num--icon { color: rgba(59,130,246,.85); }
.stat-nav .stat[data-nav="monitor"]:hover { box-shadow: 0 10px 28px rgba(59,130,246,.18); border-color: rgba(59,130,246,.35); }
.stat-nav .stat[data-nav="monitor"]:hover .num--icon { background-color: rgba(59,130,246,.14); box-shadow: 0 4px 14px rgba(59,130,246,.22); color: rgba(59,130,246,1); transform: translateY(-2px); }
.stat-nav .stat[data-nav="fund"] .num--icon { color: rgba(168,85,247,.85); }
.stat-nav .stat[data-nav="fund"]:hover { box-shadow: 0 10px 28px rgba(168,85,247,.18); border-color: rgba(168,85,247,.35); }
.stat-nav .stat[data-nav="fund"]:hover .num--icon { background-color: rgba(168,85,247,.14); box-shadow: 0 4px 14px rgba(168,85,247,.22); color: rgba(168,85,247,1); transform: translateY(-2px); }
.stat-nav .stat[data-nav="asset"] .num--icon { color: rgba(255,122,89,.9); }
.stat-nav .stat[data-nav="asset"]:hover { box-shadow: 0 10px 28px rgba(255,122,89,.20); border-color: rgba(255,122,89,.4); }
.stat-nav .stat[data-nav="asset"]:hover .num--icon { background-color: rgba(255,122,89,.16); box-shadow: 0 4px 14px rgba(255,122,89,.26); color: rgba(255,90,60,1); transform: translateY(-2px); }
.stat-nav .stat[data-nav="weight"] .num--icon { color: rgba(16,185,129,.9); }
.stat-nav .stat[data-nav="weight"]:hover { box-shadow: 0 10px 28px rgba(16,185,129,.18); border-color: rgba(16,185,129,.4); }
.stat-nav .stat[data-nav="weight"]:hover .num--icon { background-color: rgba(16,185,129,.14); box-shadow: 0 4px 14px rgba(16,185,129,.22); color: rgba(16,185,129,1); transform: translateY(-2px); }
.stat-nav .stat[data-nav="todo"] .num--icon { color: rgba(245,158,11,.95); }
.stat-nav .stat[data-nav="todo"]:hover { box-shadow: 0 10px 28px rgba(245,158,11,.20); border-color: rgba(245,158,11,.4); }
.stat-nav .stat[data-nav="todo"]:hover .num--icon { background-color: rgba(245,158,11,.16); box-shadow: 0 4px 14px rgba(245,158,11,.26); color: rgba(217,119,6,1); transform: translateY(-2px); }
.stat-nav .stat[data-nav="admin"] .num--icon { color: rgba(236,72,153,.85); }
.stat-nav .stat[data-nav="admin"]:hover { box-shadow: 0 10px 28px rgba(236,72,153,.18); border-color: rgba(236,72,153,.4); }
.stat-nav .stat[data-nav="admin"]:hover .num--icon { background-color: rgba(236,72,153,.14); box-shadow: 0 4px 14px rgba(236,72,153,.22); color: rgba(236,72,153,1); transform: translateY(-2px); }
.stat .lbl { font-size: 13px; color: var(--label); margin-top: 4px; }
/* 全局 loading: 双环反向旋转 (珊瑚 + 蓝) + 玻璃遮罩; z-index 高于 modal, 保证 modal 内提交时用户能看到进度 */
#globalLoading { display: none; position: fixed; inset: 0; background: var(--loading-mask); -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); z-index: 10500; align-items: center; justify-content: center; }
/* 启动阶段: display:flex 但 opacity:0, 300ms 后 fade in. 快请求 (JS 就绪 + 首屏 api <300ms 完成) 全程 opacity=0 → 无感 */
#globalLoading.boot-visible { opacity: 0; animation: bootLoadingFadeIn .2s ease-out 300ms forwards; }
@keyframes bootLoadingFadeIn { to { opacity: 1; } }
#globalLoading .spinner {
  position: relative; width: 52px; height: 52px; margin: 0 auto;
}
#globalLoading .spinner::before,
#globalLoading .spinner::after {
  content: ''; position: absolute; inset: 0; border-radius: 50%;
  border: 3px solid transparent;
}
#globalLoading .spinner::before {
  border-top-color: #FF7A59; border-right-color: #FF7A59;
  animation: spin 1.1s cubic-bezier(.5,.1,.5,.9) infinite;
}
#globalLoading .spinner::after {
  inset: 8px;
  border-bottom-color: #3B82F6; border-left-color: #3B82F6;
  animation: spinRev .9s cubic-bezier(.5,.1,.5,.9) infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
/* loading 慢请求兜底进度条 (仅 ≥3s 请求显示): 3px 品牌渐变, 从 0% 匀速爬到 90%, 完成时同步消失.
   出现方式: opacity 0→1 fade-in 150ms, 避免"突兀弹出" */
#globalLoading .loading-bar { width: 200px; height: 3px; margin: 14px auto 0; background: rgba(168, 85, 247, .15); border-radius: 2px; overflow: hidden; opacity: 0; transition: opacity .15s ease; }
#globalLoading .loading-bar.show { opacity: 1; }
#globalLoading .loading-bar .lb-fill { width: 0; height: 100%; background: linear-gradient(90deg, #FF7A59, #A855F7, #3B82F6); border-radius: 2px; transition: width .12s linear; }
@keyframes spinRev { to { transform: rotate(-360deg); } }

/* 弹窗 modal */
/* 短内容居中、长内容顶部对齐可滚：靠 .modal-box 的 margin:auto 自适应 */
/* touch-action: pan-y —— body.no-scroll 锁背景滚动时祖先 touch-action:none 会连带禁掉后代滚动容器
   的触摸平移(手机上长弹窗表单会卡死), 在遮罩自身显式放行纵向手势; overscroll-behavior:contain 防止滚到边连锁背景 */
/* 键盘避让: 键盘弹出时 COMMON_JS 给 .show 遮罩加 .kb-on —— 弹窗由垂直居中改为靠顶部对齐,
   遮罩底部 padding 留出键盘高度(--kb-inset), 使弹窗可滚动、当前聚焦框能滚到键盘上方;
   不做整体几何压缩, 弹窗不会被"顶起"重排。 */
.modal-mask { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 10000; padding: 40px 16px calc(40px + var(--kb-inset, 0px)); overflow-y: auto; touch-action: pan-y; overscroll-behavior: contain; }
.modal-mask.show { display: flex; }
/* 键盘弹出: 遮罩交叉轴改 flex-start(默认 stretch 会在 margin 非 auto 时把弹框拉伸异常、露底),
   modal-box 靠顶部对齐(取代 margin:auto 垂直居中)、保持内容高度白底, 弹窗从顶部排列、键盘盖住
   底部, 由 JS 把当前聚焦框滚入键盘上方; margin-bottom:0 让底部留白交给遮罩 padding */
.modal-mask.kb-on { align-items: flex-start; }
.modal-mask.kb-on .modal-box { margin-top: 40px; margin-bottom: 0; }
/* 全局滚动锁: body.no-scroll 由 JS 在打开弹窗(modal / mp-menu)时加, 关闭时移除.
   position:fixed + width:100% 兼容 iOS Safari, 单纯 overflow:hidden 在 iOS 上仍能滑动.
   同时锁 <html> 的 overflow, 阻止 Android Chrome / 微信 X5 在 body:fixed 时仍能滚动根滚动容器的行为.
   :has() + JS 加 .no-scroll 双重覆盖, 兼容不支持 :has() 的老内核 (如部分微信 X5).
   注意: 此处【不能】加 touch-action:none —— 祖先的 touch-action 会连带禁掉后代滚动容器(弹窗/全屏区)
   的触摸平移, 手机上长表单弹窗反而卡死无法滚动; 需要放行的滚动容器自行声明 pan-y(.modal-mask/.todo-fs-main) */
html:has(body.no-scroll), html.no-scroll { overflow: hidden; height: 100%; }
body.no-scroll { overflow: hidden; position: fixed; width: 100%; overscroll-behavior: none; }
/* 启动阶段: body.booting 提供纯 CSS 滚动锁, 早于任何 JS. JS 就绪后由 lockBodyScroll 接管, 会移除此类 */
html:has(body.booting) { overflow: hidden; height: 100%; }
body.booting { overflow: hidden; position: fixed; width: 100%; touch-action: none; overscroll-behavior: none; }
/* 遮罩自身也要阻止触摸手势: 兜底覆盖 body.no-scroll 未生效的手机浏览器 (如某些微信内核) */
#globalLoading { touch-action: none; overscroll-behavior: contain; }
.modal-box { background: var(--surface); border-radius: 10px; width: 100%; max-width: 440px; margin: auto; box-shadow: 0 10px 40px rgba(0,0,0,.2); animation: modalIn .2s ease; }
/* 大弹窗：分析面板（热力图 + 曲线） */
.modal-mask--lg .modal-box { max-width: 720px; }
.modal-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); font-size: 16px; font-weight: 600; }
#modalClose { cursor: pointer; font-size: 24px; line-height: 1; color: var(--muted); }
#modalClose:hover { color: var(--text); }
.modal-body { padding: 20px; }
@keyframes modalIn { from { transform: translateY(-12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

/* ============ 现代化日期选择器(自动接管 input[type=date]) ============ */
.dp-pop {
  display: none; position: fixed; z-index: 10002; width: 296px; max-width: calc(100vw - 16px);
  background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
  box-shadow: 0 14px 44px rgba(20,20,40,.22); padding: 12px;
  animation: modalIn .16s ease;
}
.dp-quick { display: flex; gap: 8px; margin-bottom: 10px; }
.dp-chip {
  flex: 1; border: 1px solid var(--border-strong); background: var(--surface-2); border-radius: 10px;
  padding: 7px 2px 6px; cursor: pointer; display: flex; flex-direction: column; align-items: center;
  gap: 2px; line-height: 1.25; transition: background .12s, border-color .12s;
}
.dp-chip span { font-size: 13px; font-weight: 600; color: var(--text); }
.dp-chip small { font-size: 11px; color: var(--muted-2); }
.dp-chip:hover { border-color: var(--brand-border); background: var(--hover-brand); }
.dp-chip.active { background: var(--brand); border-color: var(--brand); }
.dp-chip.active span, .dp-chip.active small { color: #fff; }
.dp-chip.dis, .dp-cell.dis { opacity: .35; cursor: default; }
.dp-nav { display: flex; align-items: center; justify-content: space-between; margin: 2px 0 6px; }
.dp-ym { font-size: 14px; font-weight: 700; color: var(--text); }
.dp-navb { border: none; background: var(--surface-2); border-radius: 8px; width: 30px; height: 28px; font-size: 17px; line-height: 1; cursor: pointer; color: var(--link-dim); }
.dp-navb:hover { background: var(--hover-bg); }
.dp-wd, .dp-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.dp-wd span { text-align: center; font-size: 11px; color: var(--muted-2); padding: 3px 0; }
.dp-cell {
  border: none; background: none; border-radius: 8px; height: 34px; font-size: 13px;
  cursor: pointer; color: var(--text); display: flex; align-items: center; justify-content: center;
}
.dp-cell:hover:not(.mute):not(.dis) { background: var(--hover-brand); }
.dp-cell.mute { color: var(--faint); cursor: default; }
.dp-cell.today { box-shadow: inset 0 0 0 1.5px var(--brand); color: var(--brand); font-weight: 700; }
.dp-cell.sel { background: var(--brand); color: #fff; font-weight: 700; }
.dp-cell.sel.today { box-shadow: none; }
/* 月/年快选视图: 4 列网格; 标题可点(进下一级) */
.dp-grid--mon { grid-template-columns: repeat(4, 1fr); gap: 4px; }
.dp-cell--mon { height: 40px; font-weight: 600; }
.dp-ym { cursor: pointer; padding: 2px 10px; border-radius: 6px; }
.dp-ym[data-goto]:hover { background: var(--hover-brand); color: var(--brand); }
input[type="date"] { cursor: pointer; }

/* 操作下拉菜单 */
.dropdown { position: relative; display: inline-block; }
.dropdown-menu { display: none; position: absolute; right: 0; top: 100%; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.12); min-width: 120px; z-index: 50; overflow: hidden; }
.dropdown-menu.show { display: block; }
.dropdown-menu button { display: block; width: 100%; text-align: left; padding: 9px 14px; border: none; background: none; font-size: 14px; cursor: pointer; color: var(--text); }
.dropdown-menu button:hover { background: var(--hover-brand); }
.dropdown-menu button.danger { color: var(--danger); }
/* 投资策略: 悬浮按钮 + 可拖拽/可缩放悬浮框 */
.strat-fab {
  position: fixed; right: 24px; bottom: 24px; z-index: 998;
  width: 52px; height: 52px; border-radius: 50%; border: none;
  background: linear-gradient(135deg, #667eea, #4a6cf7); color: #fff;
  font-size: 24px; cursor: pointer; box-shadow: 0 6px 18px rgba(74,108,247,.4);
  transition: transform .15s ease, box-shadow .15s ease;
  touch-action: none;
}
.strat-fab:hover { transform: translateY(-2px); box-shadow: 0 10px 22px rgba(74,108,247,.5); }
/* 桌面: 面板本身 resize: both, 右下角可拖拉调尺寸; 位置由 JS 拖动标题栏改 left/top */
.strat-panel {
  position: fixed; right: 24px; bottom: 88px; z-index: 999;
  width: 380px; height: 460px;
  min-width: 280px; min-height: 240px;
  max-width: calc(100vw - 16px); max-height: calc(100vh - 16px);
  background: var(--surface); border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,.18);
  display: flex; flex-direction: column; overflow: hidden;
  border: 1px solid var(--border);
  resize: both;
}
.strat-head {
  padding: 10px 14px; background: linear-gradient(135deg, #667eea, #4a6cf7);
  color: #fff; cursor: move; user-select: none; flex-shrink: 0;
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  touch-action: none;
}
.strat-title { font-size: 14px; font-weight: 600; white-space: nowrap; }
.strat-actions { display: flex; align-items: center; gap: 6px; flex-wrap: nowrap; }
.strat-actions .btn.sm { padding: 4px 10px; font-size: 12px; }
.strat-close { cursor: pointer; font-size: 20px; line-height: 1; padding: 0 4px; }
.strat-close:hover { opacity: .75; }
/* body 撑满剩余空间, 内部滚动 */
.strat-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 14px 16px; display: flex; flex-direction: column; }
.strat-view { font-size: 14px; line-height: 1.7; color: var(--text); word-break: break-word; }
.strat-view h1, .strat-view h2, .strat-view h3 { margin: 10px 0 6px; font-weight: 600; }
.strat-view h1 { font-size: 18px; }
.strat-view h2 { font-size: 16px; }
.strat-view h3 { font-size: 15px; }
.strat-view p { margin: 6px 0; }
.strat-view ul, .strat-view ol { margin: 6px 0; padding-left: 22px; }
.strat-view li { margin: 3px 0; }
.strat-view code { background: var(--surface-2); padding: 1px 5px; border-radius: 4px; font-size: 13px; }
.strat-view pre { background: var(--surface-2); padding: 10px; border-radius: 6px; overflow-x: auto; margin: 8px 0; }
.strat-view pre code { background: none; padding: 0; }
.strat-view blockquote { border-left: 3px solid var(--border-strong); padding-left: 10px; color: var(--label); margin: 6px 0; }
.strat-view a { color: #4a6cf7; text-decoration: none; }
.strat-view a:hover { text-decoration: underline; }
.strat-view hr { border: none; border-top: 1px solid var(--border); margin: 10px 0; }
.strat-view strong { font-weight: 600; }
/* editor: 面板尺寸变时撑满剩余; 关掉 textarea 自身 resize, 由面板整体 resize 控制 */
.strat-editor {
  width: 100%; flex: 1 1 auto; min-height: 160px; padding: 10px 12px;
  border: 1px solid var(--border-strong); border-radius: 8px; resize: none;
  font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 13px; line-height: 1.6;
}
/* 手机: 贴底大浮层, 禁 resize/位置拖动, 高度稳定 */
@media (max-width: 640px) {
  .strat-panel {
    left: 8px !important; right: 8px !important;
    top: auto !important; bottom: 8px !important;
    width: auto !important; height: 75vh !important;
    max-height: calc(100vh - 16px); min-width: 0; min-height: 0;
    resize: none; border-radius: 14px;
  }
  .strat-head { cursor: default; padding: 12px 14px; }
  .strat-title { font-size: 15px; }
  .strat-actions .btn.sm { padding: 6px 12px; font-size: 13px; }
  .strat-close { font-size: 24px; padding: 0 6px; }
  .strat-body { padding: 12px 14px; }
  .strat-fab { right: 16px; bottom: 16px; width: 48px; height: 48px; font-size: 22px; }
  #stratSetup { right: 12px !important; left: 12px !important; bottom: 16px !important; width: auto; }
}
.multi-pick { position: relative; display: inline-block; width: 100%; }
/* 已选值显示按钮: 允许多行, 长文本自动换行 */
.mp-btn {
  width: 100%; text-align: left; padding: 8px 12px;
  border: 1px solid var(--border-strong); border-radius: 8px; background: var(--surface);
  font-size: 14px; cursor: pointer; color: var(--text); min-height: 38px;
  white-space: normal; word-break: break-all; line-height: 1.5;
}
.mp-menu { display: none; position: absolute; left: 0; top: 100%; margin-top: 4px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.12); z-index: 60; padding: 6px; max-height: 240px; overflow-y: auto; display: none; }
.mp-menu.show { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px; min-width: 220px; }
.mp-item { display: flex; align-items: center; gap: 4px; padding: 5px 8px; font-size: 13px; cursor: pointer; border-radius: 6px; white-space: nowrap; }
.mp-item:hover { background: var(--hover-brand); }
.mp-item input { width: auto; margin: 0; }
/* "完成"按钮: 仅窄屏可见, 桌面下拉隐藏 */
.mp-done { display: none; }

/* ============ 待办树（signature） ============ */
/* 层级缩进靠 --depth 变量驱动；每个节点一行，左侧优先级色带 + 圆形勾选框 */
.todo-tree { margin-top: 4px; }
.todo-empty { text-align: center; color: var(--muted); padding: 40px 12px; font-size: 14px; }
.todo-node { position: relative; }
.todo-row {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 12px; margin: 4px 0;
  background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
  margin-left: calc(var(--depth, 0) * 26px);
  transition: box-shadow .18s, border-color .18s, transform .18s;
  /* 长按整行拖拽: 禁止长按弹出系统菜单/文字选择放大镜(行内无输入控件, 不影响使用) */
  -webkit-touch-callout: none; user-select: none; -webkit-user-select: none;
}
.todo-row:hover { box-shadow: 0 3px 14px rgba(168,85,247,.10); border-color: var(--brand-border); transform: translateX(1px); }
/* 优先级：标题前一枚小圆点（克制点缀，不占左色带）。红=高 琥珀=中 灰=低 */
.todo-dot { flex-shrink: 0; width: 9px; height: 9px; border-radius: 50%; background: #b4bccb; }
.todo-dot.pri-2 { background: #e5484d; }
.todo-dot.pri-1 { background: #e8a317; }
.todo-dot.pri-0 { background: #b4bccb; }
/* 层级连接线：非顶层节点左侧竖向引导线 */
.todo-node[data-depth]:not([data-depth="0"]) > .todo-row::before {
  content: ''; position: absolute; left: calc(var(--depth, 0) * 26px - 13px); top: -4px; bottom: 50%;
  border-left: 1.5px solid var(--border); border-bottom: 1.5px solid var(--border);
  width: 12px; border-bottom-left-radius: 8px;
}
/* 圆形勾选框 */
.todo-check {
  flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%;
  border: 2px solid var(--check-ring); background: var(--surface); cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  transition: background .18s, border-color .18s; padding: 0;
}
.todo-check:hover { border-color: var(--brand); }
.todo-check::after { content: '✓'; color: #fff; font-size: 13px; font-weight: 700; opacity: 0; transform: scale(.4); transition: .18s; }
.todo-check.done { background: linear-gradient(135deg, #52c41a, #34b34a); border-color: #34b34a; }
.todo-check.done::after { opacity: 1; transform: scale(1); }
/* 折叠三角 */
.todo-caret {
  flex-shrink: 0; width: 16px; height: 16px; cursor: pointer; color: var(--faint);
  display: inline-flex; align-items: center; justify-content: center; font-size: 11px;
  transition: transform .18s, color .18s; user-select: none;
}
.todo-caret:hover { color: var(--brand); }
.todo-caret.collapsed { transform: rotate(-90deg); }
.todo-caret.leaf { visibility: hidden; }
/* 标题与元信息 */
.todo-main { flex: 1; min-width: 0; }
.todo-title { font-size: 14px; color: var(--text); word-break: break-word; transition: color .2s; }
.todo-row.is-done .todo-title { color: var(--faint); text-decoration: line-through; }
.todo-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 3px; }
.todo-chip { font-size: 12px; padding: 1px 8px; border-radius: 999px; line-height: 1.6; }
.todo-chip.cat { background: var(--hover-brand); color: var(--brand); }
.todo-chip.due { background: var(--surface-2); color: var(--link-dim); }
.todo-chip.due.overdue { background: var(--danger-bg); color: var(--danger); font-weight: 600; }
.todo-chip.done-at { background: var(--ok-bg); color: var(--ok); }
.todo-chip.repeat { background: var(--hover-brand); color: var(--brand); font-weight: 600; }
/* 行内操作按钮：默认略淡，hover 行时显现；SVG 图标走 currentColor, 移动端常显 */
.todo-ops { display: flex; gap: 2px; opacity: .7; transition: opacity .18s; flex-shrink: 0; }
.todo-row:hover .todo-ops { opacity: 1; }
.todo-op { border: none; background: none; cursor: pointer; font-size: 15px; padding: 5px 6px; border-radius: 6px; line-height: 1; color: var(--link-dim); display: inline-flex; align-items: center; justify-content: center; }
.todo-op:hover { background: var(--hover-bg); color: var(--brand); }
.todo-op.danger { color: var(--danger); }
.todo-op.danger:hover { background: var(--danger-bg); color: var(--danger); }
.todo-op svg { width: 16px; height: 16px; display: block; pointer-events: none; }
/* 拖拽手柄：按住即可拖动排序；touch-action:none 抑制移动端触摸滚动争抢 */
.todo-drag { cursor: grab; color: var(--faint); touch-action: none; }
.todo-drag:active { cursor: grabbing; }
.todo-children.collapsed { display: none; }
/* 顶层任务栏：作为分组头。浅灰底 + 左侧品牌蓝分组条表"这是一组"，与优先级圆点分属不同通道 */
.todo-row.is-root { background: var(--surface-2); border-color: var(--border); border-left: 4px solid var(--brand); padding-left: 12px; }
.todo-row.is-root .todo-title { font-weight: 700; font-size: 15px; }
.todo-count { font-size: 12px; color: var(--muted-2); margin-left: 6px; }
/* 概览统计条 */
.todo-stats { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 4px; }
.todo-stat { flex: 1; min-width: 90px; background: #f8f9ff; border-radius: 10px; padding: 12px 14px; text-align: center; }
.todo-stat .n { font-size: 24px; font-weight: 700; color: var(--brand); }
.todo-stat.overdue .n { color: var(--danger); }
.todo-stat.done .n { color: var(--ok); }
.todo-stat .l { font-size: 12px; color: var(--muted-2); margin-top: 2px; }
/* 标题支持换行长文本；备注次级灰字 */
.todo-title { white-space: pre-wrap; }
.todo-note { font-size: 13px; color: var(--muted-2); margin-top: 4px; white-space: pre-wrap; line-height: 1.5; }
/* 图表卡片头部 + 区间选择 */
.todo-chart-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.todo-range { display: inline-flex; gap: 4px; flex-wrap: wrap; }
.todo-range button { border: 1px solid var(--border); background: var(--surface); color: var(--link-dim); font-size: 13px; padding: 5px 12px; border-radius: 999px; cursor: pointer; transition: .15s; }
.todo-range button:hover { border-color: var(--brand); color: var(--brand); }
.todo-range button.active { background: var(--brand); border-color: var(--brand); color: #fff; }
/* 筛选 tab：复用 range pill 样式，与列表间留白 */
.todo-filter { margin: 4px 0 12px; }
/* 标题行「分析」小按钮：与 h2 文字垂直对齐 */
.todo-analyze-btn { vertical-align: middle; margin: 0 2px; }
/* 趋势图标题行的刷新按钮: 纯蓝色图标无背景, hover 淡蓝底(压掉 .btn 的渐变/光晕/涟漪) */
.btn.todo-chart-refresh { background: none; color: #4a6cf7; padding: 5px 9px; line-height: 0; box-shadow: none; }
.btn.todo-chart-refresh::after { display: none; }
.btn.todo-chart-refresh:hover,
.btn.todo-chart-refresh:active { background: rgba(74,108,247,.1); box-shadow: none; filter: none; transform: none; }
.btn.todo-chart-refresh:disabled { opacity: .6; }
.todo-chart-refresh.loading svg { animation: todo-spin .8s linear infinite; transform-box: fill-box; transform-origin: center; }
@keyframes todo-spin { to { transform: rotate(360deg); } }
/* 任务分析弹窗：区块标题 */
.ta-h { font-size: 14px; font-weight: 600; color: var(--label); margin: 18px 0 10px; }
.ta-h-first { margin-top: 0; }
.ta-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
.ta-head .ta-h { margin: 0; }
/* 任务分析弹窗：指标卡 */
.ta-stats { display: flex; gap: 10px; flex-wrap: wrap; }
.ta-stat { flex: 1; min-width: 120px; background: var(--surface-3); border-radius: 10px; padding: 10px 12px; text-align: center; }
.ta-stat .n { font-size: 20px; font-weight: 700; color: var(--text-strong); white-space: nowrap; line-height: 1.3; }
.ta-stat .n small { font-size: 12px; font-weight: 400; color: var(--muted); margin-left: 3px; }
.ta-stat .l { font-size: 13px; color: var(--text); margin-top: 1px; }
.ta-stat .s { font-size: 11px; color: var(--muted); margin-top: 1px; min-height: 14px; }
.ta-stat.good .n { color: var(--ok); }
.ta-stat.bad .n { color: var(--danger); }
/* 指标卡上的圆形「?」说明按钮：弱描边，不抢数字视觉 */
.ta-help {
  display: inline-flex; align-items: center; justify-content: center;
  width: 15px; height: 15px; padding: 0; margin-left: 4px;
  border: 1px solid var(--muted); border-radius: 50%;
  background: transparent; color: var(--muted);
  font-size: 10px; font-weight: 600; line-height: 1; cursor: pointer;
  vertical-align: middle;
}
.ta-help:active { background: var(--surface-3); }
/* 7 列日历热力图（周一起始）：整块居中，格子等宽方形，格内显示日期 */
.ta-heat-wrap { max-width: 380px; margin: 0 auto; }
.ta-dow, .ta-heat { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; }
.ta-dow { margin-bottom: 5px; }
.ta-dow span { font-size: 11px; color: var(--muted); text-align: center; line-height: 16px; }
.ta-cell { aspect-ratio: 1; border-radius: 5px; border: 1px solid var(--border); background: var(--surface-2); box-sizing: border-box; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; cursor: default; transition: transform .12s; }
.ta-cell:hover { transform: scale(1.12); position: relative; z-index: 1; }
.ta-cell.win { background: var(--ok); border-color: transparent; color: #fff; }
.ta-cell.fail { background: var(--danger); border-color: transparent; color: #fff; }
.ta-cell.pending { background: var(--surface); border: 1px dashed var(--brand); color: var(--brand); }
.ta-cell.idle { background: var(--surface-2); }
/* 暗色主题下绿/红底变亮，日期字改用深色保对比 */
[data-theme="dark"] .ta-cell.win { color: #10230f; }
[data-theme="dark"] .ta-cell.fail { color: #2c0d0d; }
.ta-legend { display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap; font-size: 12px; color: var(--muted); margin-top: 8px; }
.ta-legend i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-right: 4px; vertical-align: -1px; border: 1px solid var(--border); box-sizing: border-box; }
.ta-legend .lg-win { background: var(--ok); border-color: transparent; }
.ta-legend .lg-fail { background: var(--danger); border-color: transparent; }
.ta-legend .lg-idle { background: var(--surface-2); }
.ta-legend .lg-pending { background: var(--surface); border: 1px dashed var(--brand); }
@media (max-width: 480px) {
  .ta-heat-wrap { max-width: none; }
}
@media (prefers-reduced-motion: reduce) { .todo-row, .todo-check, .todo-check::after, .todo-caret { transition: none; } }
/* 子任务长按拖拽：拖动中的节点浮起，拖动期间全局禁选中并显示抓取光标 */
/* 长按拖起: 整行"浮离"列表 —— 多层阴影(环境投影 + 品牌色晕 + 2px 光环描边, 光环用 shadow 不占布局避免位移),
   轻微放大+倾斜模拟抓在手里; .todo-row 自带 transform .18s 过渡, 加 class 瞬间有"抬起"动画 */
.todo-node.dragging { opacity: .96; }
.todo-node.dragging > .todo-row {
  background: var(--surface); cursor: grabbing; position: relative; z-index: 8;
  border-color: var(--brand-border);
  transform: scale(1.02) rotate(-.5deg);
  box-shadow: 0 14px 30px rgba(31,35,41,.18), 0 4px 12px rgba(168,85,247,.20), 0 0 0 2px rgba(168,85,247,.22);
}
body.todo-dragging { user-select: none; -webkit-user-select: none; touch-action: none; cursor: grabbing; }
@media (prefers-reduced-motion: reduce) { .todo-node.dragging > .todo-row { transform: none; } }

/* ============ 待办卡片视图 ============ */
/* 卡片网格容器：一列排列，宽屏保持单列（避免顶层任务被切碎） */
.todo-cards { display: flex; flex-direction: column; gap: 12px; margin-top: 4px; }
/* 单张顶层卡片：顶部色带 + 内容区 + 底部操作 */
.todo-card {
  position: relative; background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
  overflow: hidden; transition: box-shadow .18s, transform .12s, border-color .18s;
  cursor: default;
}
.todo-card.clickable { cursor: pointer; }
.todo-card.clickable:hover { box-shadow: 0 6px 24px rgba(168,85,247,.14); border-color: var(--brand-border); transform: translateY(-1px); }
.todo-card__band { height: 4px; background: #b4bccb; }
.todo-card.pri-2 .todo-card__band { background: #e5484d; }
.todo-card.pri-1 .todo-card__band { background: #e8a317; }
.todo-card.pri-0 .todo-card__band { background: #b4bccb; }
.todo-card.is-done { opacity: .78; background: var(--surface-done); }
.todo-card__body { padding: 14px 16px 10px; }
.todo-card__head { display: flex; align-items: flex-start; gap: 10px; }
.todo-card__title {
  flex: 1; min-width: 0; font-size: 17px; font-weight: 700; color: var(--text);
  line-height: 1.45; word-break: break-word;
}
.todo-card.is-done .todo-card__title { color: var(--faint); text-decoration: line-through; }
.todo-card__check {
  flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%;
  border: 2px solid var(--check-ring); background: var(--surface); cursor: pointer; padding: 0;
  display: flex; align-items: center; justify-content: center;
  transition: border-color .18s, background .18s;
}
.todo-card__check:hover { border-color: var(--brand); }
.todo-card__check.done { background: linear-gradient(135deg, #52c41a, #34b34a); border-color: #34b34a; }
.todo-card__check::after { content: '✓'; color: #fff; font-size: 14px; font-weight: 700; opacity: 0; transform: scale(.4); transition: .18s; }
.todo-card__check.done::after { opacity: 1; transform: scale(1); }
.todo-card__meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.todo-card__note { margin-top: 6px; font-size: 13px; color: var(--muted-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.todo-card__foot {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; background: var(--surface-done); border-top: 1px solid var(--border);
}
.todo-card__ops { display: flex; gap: 2px; }
.todo-card__ops .todo-op { font-size: 16px; padding: 6px 8px; }
.todo-card__ops .todo-op svg { width: 18px; height: 18px; }
.todo-card__enter { color: var(--brand); font-size: 13px; font-weight: 600; user-select: none; }
.todo-card__count { background: var(--hover-brand); color: var(--brand); font-weight: 600; }
.todo-card__count.done { background: var(--ok-bg); color: var(--ok); }

/* 内联子任务添加行: 卡片视图挂在卡片下方; 完整树视图挂在该行下方 */
.todo-inline-add {
  background: var(--surface); border: 1px solid var(--brand-border); border-left: 4px solid var(--brand);
  border-radius: 10px; padding: 10px 12px; margin: 6px 0 10px;
  display: flex; flex-direction: column; gap: 8px;
  box-shadow: 0 4px 16px rgba(168,85,247,.08);
  animation: todoInlineAddIn .18s ease-out;
}
@keyframes todoInlineAddIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
/* textarea 自身 min-height 由 JS autoGrowTextarea 控制(默认 44px), 这里不设 min-height 避免重复叠加 */
.todo-inline-add__title, .todo-inline-add__note {
  width: 100%; border: 1px solid var(--border); border-radius: 6px;
  padding: 8px 10px; font-size: 14px; font-family: inherit; resize: vertical;
  line-height: 1.5;
}
.todo-inline-add__title { font-weight: 600; }
.todo-inline-add__title:focus, .todo-inline-add__note:focus { outline: none; border-color: var(--brand); box-shadow: 0 0 0 2px rgba(168,85,247,.12); }
.todo-inline-add__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.todo-inline-add__actions .btn.sm { padding: 6px 16px; min-height: 34px; }
.todo-inline-add__hint { font-size: 12px; margin-left: auto; }

/* 详情页底部常驻"+ 添加子任务"行(MS To Do 风格): 折叠时是占位按钮, 展开时是内联输入 */
.todo-detail-adder { margin-top: 8px; }
.todo-detail-adder__placeholder {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 12px 14px; background: transparent; color: var(--brand);
  border: 1px dashed var(--brand-border); border-radius: 8px; cursor: pointer;
  font-size: 14px; text-align: left; transition: background .18s, border-color .18s;
  min-height: 44px;
}
.todo-detail-adder__placeholder:hover { background: rgba(168,85,247,.06); border-color: var(--brand); }
.todo-detail-adder__plus { font-weight: 700; font-size: 18px; line-height: 1; }
.todo-detail-adder.editing .todo-detail-adder__placeholder { display: none; }
.todo-detail-adder__editor { display: none; }
.todo-detail-adder.editing .todo-detail-adder__editor {
  display: flex; flex-direction: column; gap: 8px;
  background: var(--surface); border: 1px solid var(--brand); border-radius: 8px;
  padding: 10px 12px; box-shadow: 0 4px 16px rgba(168,85,247,.08);
  animation: todoInlineAddIn .18s ease-out;
}
.todo-detail-adder__title, .todo-detail-adder__note {
  width: 100%; border: 1px solid var(--border); border-radius: 6px;
  padding: 8px 10px; font-size: 14px; font-family: inherit; resize: vertical;
  line-height: 1.5;
}
.todo-detail-adder__title { font-weight: 600; }
.todo-detail-adder__title:focus, .todo-detail-adder__note:focus {
  outline: none; border-color: var(--brand); box-shadow: 0 0 0 2px rgba(168,85,247,.12);
}
.todo-detail-adder__row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.todo-detail-adder__row .btn.sm { padding: 6px 16px; min-height: 34px; }
.todo-detail-adder__hint { font-size: 12px; margin-left: auto; }

/* 手机窄屏(≤640px): 按钮撑满一行更易点; 提示文单独一行不挤按钮 */
@media (max-width: 640px) {
  .todo-inline-add__actions,
  .todo-detail-adder__row {
    gap: 6px;
  }
  .todo-inline-add__actions .btn.sm,
  .todo-detail-adder__row .btn.sm {
    flex: 1 1 40%; padding: 10px 12px; min-height: 40px; font-size: 14px;
  }
  .todo-inline-add__hint,
  .todo-detail-adder__hint {
    flex: 1 0 100%; margin-left: 0; text-align: center; order: 99;
  }
}

/* ============ 面包屑（子任务详情页顶栏） ============ */
.todo-crumb {
  display: flex; align-items: center; gap: 10px; margin: 4px 0 12px;
  padding: 8px 12px; background: var(--surface-2); border-radius: 8px; border-left: 4px solid var(--brand);
}
.todo-crumb__back {
  border: 1px solid var(--border); background: var(--surface); color: var(--brand); cursor: pointer;
  padding: 5px 12px; border-radius: 999px; font-size: 13px;
}
.todo-crumb__back:hover { background: var(--hover-brand); }
.todo-crumb__title { flex: 1; min-width: 0; font-size: 14px; font-weight: 700; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ============ 按钮 busy 状态（点击后立即禁用防重） ============ */
/* opacity + wait 光标; 文字由 JS 换成"处理中…" 已足够明显, 不再叠加 ::after */
button[data-busy] { opacity: .55; cursor: wait; pointer-events: none; }

/* ============ 待办全屏模式（三态循环：default → 卡片全屏 → 完整树全屏） ============ */
/* 全屏容器：默认 display:none, 由 JS 根据 _todoView 决定显隐 */
.todo-fullscreen {
  display: none;
  position: fixed; inset: 0; z-index: 1000;
  background: var(--bg);
  flex-direction: row;
}
/* body 加 todo-fs-on 时：隐藏 topbar 与页面所有 .card, 显示全屏容器 */
body.todo-fs-on { overflow: hidden; }
body.todo-fs-on .topbar,
body.todo-fs-on .impersonate-banner { display: none !important; }
body.todo-fs-on .container > .card { display: none !important; }
body.todo-fs-on .todo-fullscreen { display: flex; }

/* 普通文档流页面(登录/系统设置/体重/资产公开填写等非弹窗表单): 键盘弹起时底部预留键盘高度,
   短表单也能把输入框滚到键盘上方。弹窗(.modal-mask 由 JS 几何对齐)与待办全屏(.todo-fs-main
   自身 padding)另有避让; 弹窗打开时 body.no-scroll 为 position:fixed, 此项不影响弹窗布局。
   PC/无键盘时 --kb-inset 为 0, 无副作用。 */
body { padding-bottom: var(--kb-inset, 0px); }
/* 主区域：右侧填满 */
/* touch-action: pan-y 显式放行纵向触摸滚动: 弹窗打开期间 body.no-scroll 生效,
   祖先 touch-action 会连带禁用后代滚动容器的手势, 这里显式声明保证卡片/树列表始终可上下滑动 */
.todo-fs-main {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column;
  /* 底部 padding 随软键盘高度(--kb-inset, JS 据 visualViewport 写入)增大, 内联添加框不被键盘盖住 */
  padding: 12px 16px calc(16px + var(--kb-inset, 0px));
  overflow-y: auto;
  touch-action: pan-y;
  overscroll-behavior: contain;
}
/* 主区域顶部一行：抽屉按钮 + 标题 + 视图切换按钮 */
/* transition + 背景色: 为手机端 sticky 时的过渡隐藏做铺垫; PC 无影响 */
.todo-fs-top {
  display: flex; align-items: center; gap: 10px; margin-bottom: 10px;
  padding-bottom: 10px; border-bottom: 1px solid var(--border);
  background: var(--bg);
  transition: transform .22s ease, opacity .22s ease;
}
.todo-fs-title { flex: 1; font-size: 16px; font-weight: 700; color: var(--text); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.todo-fs-hide { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; color: var(--label); font-weight: normal; cursor: pointer; white-space: nowrap; }
.todo-fs-hide input[type="checkbox"] { width: auto; margin: 0; }

/* 默认视图"待办清单"卡片头: 始终一行。宽屏标题 flex:1 占满左侧、控件靠右;
   窄屏(≤640px, App/手机浏览器)标题固定在左、"隐藏已完成"固定在右, 中间"卡片视图/新建任务/
   共享分类"为一条横向滑动区(共享分类在最后, 默认被裁), 两端有内容裁切时出现箭头滑出 */
.todo-card-head { display: flex; align-items: center; flex-wrap: nowrap; gap: 8px; }
.todo-card-head__title { flex: 1 1 auto; min-width: 0; }
.todo-card-head__hide { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: normal; color: var(--label); white-space: nowrap; cursor: pointer; flex-shrink: 0; }
.todo-card-head__hide input[type="checkbox"] { width: auto; margin: 0; }
.todo-card-head__bar { position: relative; display: inline-flex; align-items: center; min-width: 0; flex-shrink: 0; }
.todo-card-head__bar-scroll { display: inline-flex; align-items: center; gap: 8px; }
.todo-card-head__bar-scroll .btn.sm { white-space: nowrap; margin-bottom: 0; flex-shrink: 0; }
@media (max-width: 640px) {
  .todo-card-head { gap: 6px; }
  /* 标题固定不缩(内容宽), 把剩余空间让给中间滑动区 */
  .todo-card-head__title { flex: 0 0 auto; }
  .todo-card-head__bar { flex: 1 1 auto; }
  .todo-card-head__bar-scroll {
    width: 100%; flex-wrap: nowrap; overflow-x: auto;
    -webkit-overflow-scrolling: touch; scrollbar-width: none;
    padding: 3px 2px;
  }
  .todo-card-head__bar-scroll::-webkit-scrollbar { display: none; }
  .todo-card-head__bar-scroll > * { flex-shrink: 0; }
}

/* ============ 侧边抽屉（分类目录） ============ */
.todo-drawer {
  width: 240px; flex-shrink: 0;
  background: var(--surface); border-right: 1px solid var(--border);
  display: flex; flex-direction: column;
  transition: transform .22s ease;
}
.todo-drawer__head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 14px 10px; font-size: 14px; font-weight: 700; color: var(--text);
  border-bottom: 1px solid var(--border);
}
.todo-drawer__close {
  border: none; background: none; cursor: pointer; font-size: 18px; color: var(--muted-2);
  padding: 2px 6px; border-radius: 6px;
}
.todo-drawer__close:hover { background: var(--hover-bg); color: var(--text); }
.todo-drawer__list { flex: 1; overflow-y: auto; padding: 6px 0; }
.todo-drawer__item {
  display: flex; align-items: center; gap: 8px; padding: 8px 14px;
  cursor: pointer; font-size: 14px; color: var(--text);
  border-left: 3px solid transparent;
  transition: background .12s, border-color .12s;
}
.todo-drawer__item:hover { background: var(--surface-2); }
.todo-drawer__item.active { background: var(--hover-brand); border-left-color: var(--brand); color: var(--brand); font-weight: 600; }
.todo-drawer__label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.todo-drawer__count { color: var(--muted-2); font-size: 12px; }
.todo-drawer__item.active .todo-drawer__count { color: var(--brand); }
.todo-drawer__section { padding: 6px 0; border-bottom: 1px solid var(--border); }
.todo-drawer__section:last-child { border-bottom: none; }
.todo-drawer__section-title { padding: 8px 14px 4px; font-size: 12px; color: var(--muted-2); font-weight: 600; letter-spacing: .5px; }
.todo-drawer__item--hide { cursor: pointer; }
.todo-drawer__foot { padding: 8px 14px; font-size: 12px; color: var(--muted-2); border-top: 1px solid var(--border); text-align: center; }
/* 个人分类项的改名 ✎ / 删除 ✕: 默认低调, hover 分别转主题紫 / 红; 点击 stopPropagation 不触发分类过滤 */
.todo-drawer__del, .todo-drawer__edit {
  border: none; background: none; cursor: pointer; flex-shrink: 0;
  color: var(--faint); font-size: 12px; line-height: 1;
  padding: 3px 6px; border-radius: 5px;
}
.todo-drawer__edit:hover { background: var(--hover-brand); color: var(--brand); }
.todo-drawer__del:hover { background: #fdecec; color: #e5484d; }
/* 抽屉收起：主区域独占 */
.todo-drawer.closed { display: none; }
/* 抽屉遮罩（仅手机使用）; touch-action:none 阻止遮罩上的触摸手势穿透/连锁滚动 */
.todo-drawer-mask { display: none; touch-action: none; }

/* ============ 分类下拉：新建输入框 ============ */
/* 弹窗内 #tfCatNew 的 margin-top，与 select 拉开距离；样式复用现有 input */
#tfCatNew { margin-top: 6px; }

/* ============ 图表横屏全屏查看 ============ */
/* 紧贴图表的相对定位容器：按钮以此为锚，落在图表区右上角而非整张卡片 */
.chart-fs-wrap { position: relative; }
/* 图表右上角的全屏按钮：淡显，hover 卡片时显现 */
.chart-fs-btn {
  position: absolute; top: 4px; right: 4px; z-index: 5;
  width: 28px; height: 28px; padding: 0; line-height: 1;
  border: 1px solid var(--border); border-radius: 8px; background: var(--card-glass-solid);
  color: var(--label); font-size: 14px; cursor: pointer; opacity: .3; transition: opacity .18s, background .18s;
}
.card:hover .chart-fs-btn { opacity: 1; }
.chart-fs-btn:hover { background: var(--hover-brand); color: var(--brand); }
/* 弹窗内的图表无 .card:hover 可借(手机也无 hover), 放大按钮常态清晰可见 */
.modal-mask.show .chart-fs-btn { opacity: .85; }
/* 全屏遮罩层：半透明底 + 居中舞台。横屏(PC/平板)直接放大；竖屏(手机)旋转 90° 铺满 */
/* z-index 须高于 .modal-mask(10000)/指标说明浮层(10001)/toast(10002): 弹窗内(如任务分析)打开全屏图时要盖在最上; 低于 #globalLoading(10500) */
.chart-fs-mask { position: fixed; inset: 0; z-index: 10010; background: rgba(0,0,0,.55); overflow: hidden; touch-action: none; }
.chart-fs-stage {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  background: var(--surface); border-radius: 12px; box-shadow: 0 12px 48px rgba(0,0,0,.35);
  padding: 24px; box-sizing: border-box;
}
/* 横屏(PC/宽屏)：大弹窗，取视口九成，不旋转 */
@media (orientation: landscape) {
  .chart-fs-stage { width: 90vw; height: 88vh; }
}
/* 竖屏(手机)：舞台取视口对调后旋转 90°，铺满成横向大图 */
@media (orientation: portrait) {
  .chart-fs-mask { background: var(--surface); }
  .chart-fs-stage {
    width: 100vh; height: 100vw; border-radius: 0; box-shadow: none; padding: 16px 44px 16px 16px;
    transform: translate(-50%, -50%) rotate(90deg);
  }
}
/* 全屏时图表填满舞台：关掉宽高比后由 Chart.js 按容器 100% 铺满 */
.chart-fs-stage canvas { width: 100% !important; height: 100% !important; max-width: none !important; max-height: none !important; display: block; }
/* 关闭按钮：圆形图标钮 */
.chart-fs-close {
  position: fixed; top: 12px; right: 12px; z-index: 9999;
  width: 40px; height: 40px; padding: 0; line-height: 1;
  border: 1px solid var(--border); border-radius: 50%; background: var(--surface); color: var(--label);
  font-size: 17px; cursor: pointer; box-shadow: 0 2px 10px rgba(0,0,0,.18);
}
.chart-fs-close:hover { background: var(--hover-brand); color: var(--brand); }
/* 竖屏(手机)：旋转后图的 Y 轴刻度落在物理右上，故关闭钮挪到物理右下角避开 */
@media (orientation: portrait) {
  .chart-fs-close { top: auto; bottom: 14px; right: 14px; }
}
@media (prefers-reduced-motion: reduce) { .chart-fs-btn { transition: none; } }


/* ============ 自定义滚动条 (极光流动: 品牌三色渐变 + 位置无限循环) ============ */
/* scrollbar-gutter: stable 让页面始终预留槽位, 消除滚动条出现/消失的横向抖动 */
html { scrollbar-gutter: stable; }
/* Firefox 不支持渐变/动画滚动条, 退化到品牌紫半透明 */
* { scrollbar-width: thin; scrollbar-color: rgba(168,85,247,.38) transparent; }
/* WebKit 主滚动条: 6px 极窄, 拇指是横向 400% 三色渐变, 位置无限左右流动 = 极光 */
::-webkit-scrollbar { width: 6px; height: 6px; background: transparent; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  border-radius: 999px;
  /* 首尾同色 (珊瑚) 让 background-position 循环时无接缝跳变 */
  background-image: linear-gradient(180deg,
    #FF7A59 0%, #A855F7 25%, #3B82F6 50%, #A855F7 75%, #FF7A59 100%);
  background-size: 100% 400%;
  background-position: 0% 0%;
  animation: scrollbarAurora 6s ease-in-out infinite;
}
::-webkit-scrollbar-thumb:hover { filter: brightness(1.12) saturate(1.15); }
/* 横向滚动条 (少数场景, 如宽表格): 改为水平流光方向 */
::-webkit-scrollbar-thumb:horizontal {
  background-image: linear-gradient(90deg,
    #FF7A59 0%, #A855F7 25%, #3B82F6 50%, #A855F7 75%, #FF7A59 100%);
  background-size: 400% 100%;
  animation: scrollbarAuroraX 6s ease-in-out infinite;
}
::-webkit-scrollbar-corner { background: transparent; }
@keyframes scrollbarAurora {
  0%,100% { background-position: 0% 0%; }
  50%     { background-position: 0% 100%; }
}
@keyframes scrollbarAuroraX {
  0%,100% { background-position: 0% 0%; }
  50%     { background-position: 100% 0%; }
}
/* 细窄容器 (下拉/抽屉/多选面板/modal): 收窄到 4px, 更贴合小尺寸 */
.mp-menu::-webkit-scrollbar,
.dropdown-menu::-webkit-scrollbar,
.todo-drawer__list::-webkit-scrollbar,
.modal-body::-webkit-scrollbar { width: 4px; height: 4px; }
/* 深色底容器 (登录页/图表全屏遮罩): 品牌色在深底发脏, 覆盖为极光白 */
.lg-fs::-webkit-scrollbar-thumb,
.chart-fs-mask::-webkit-scrollbar-thumb {
  background-image: linear-gradient(180deg,
    rgba(255,255,255,.5) 0%, rgba(180,200,255,.75) 50%, rgba(255,255,255,.5) 100%);
  background-size: 100% 300%;
  animation: scrollbarAurora 6s ease-in-out infinite;
}
.lg-fs, .chart-fs-mask { scrollbar-color: rgba(255,255,255,.35) transparent; }
/* 无障碍: 用户开启 reduce motion 时停止极光流动 */
@media (prefers-reduced-motion: reduce) {
  ::-webkit-scrollbar-thumb,
  ::-webkit-scrollbar-thumb:horizontal,
  .lg-fs::-webkit-scrollbar-thumb,
  .chart-fs-mask::-webkit-scrollbar-thumb { animation: none; }
  .topbar .brand-rocket { animation: none; }
}

/* ============ 液态玻璃新增动效: reduced-motion 覆盖 ============ */
@media (prefers-reduced-motion: reduce) {
  .topbar { animation: none; }
  .card, .stat, .btn { transition: none; }
  .card:hover, .stat:hover { transform: none; }
  .btn::after { display: none; }
  #globalLoading .spinner::before,
  #globalLoading .spinner::after { animation: none; }
}


/* ============ 移动端适配 (<=640px) ============ */
@media (max-width: 640px) {
  .topbar { flex-direction: column; align-items: flex-start; gap: 8px; padding: 12px 16px; }
  .topbar h1 { font-size: 15px; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
  .topbar h1 .brand-rocket { width: 14px; height: 14px; }
  .topbar h1 .brand-w1, .topbar h1 .brand-w2 { font-size: 13px; }
  /* 手机端时钟收紧: 缩小内边距, 靠 JS 输出短格式(仅时:分) */
  .topbar .brand-clock { margin-left: 4px; padding: 3px 9px; font-size: 12px; }
  .topbar .nav { display: flex; flex-wrap: wrap; gap: 6px 0; }
  .topbar .nav a { margin-left: 0; margin-right: 16px; }
  .topbar .user { font-size: 13px; flex-wrap: wrap; }
  .container { margin: 14px auto; padding: 0 10px; }
  .card { padding: 15px; }
  .row { flex-direction: column; gap: 0; }
  .row > * { min-width: 0; }

  /* 表格转卡片式：表头隐藏，每行成卡片，单元格纵向排列并用 data-label 标注列名 */
  table thead { display: none; }
  table, table tbody, table tr, table td { display: block; width: 100%; }
  table tr { background: var(--surface-done); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 10px; padding: 6px 10px; }
  table td { border: none; padding: 6px 0; text-align: right; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  table td::before { content: attr(data-label); color: #888; font-size: 13px; font-weight: 600; text-align: left; flex-shrink: 0; }
  table td[data-label="操作"] { flex-wrap: wrap; justify-content: flex-start; }
  table td[data-label="操作"]::before { width: 100%; margin-bottom: 4px; }
  .btn.sm { margin-bottom: 4px; }
  /* 汇总统计卡在窄屏两列 */
  .grid-stats { grid-template-columns: repeat(2, 1fr); }
  /* 登录/加仓等居中容器留边距 */
  .login-wrap { margin: 40px auto; padding: 0 12px; }
  /* 窄屏下拉菜单左对齐, modal 内边距收小 */
  .dropdown-menu { right: auto; left: 0; }
  .modal-mask { padding: 20px 10px calc(20px + var(--kb-inset, 0px)); }
  .modal-mask.kb-on .modal-box { margin-top: 20px; }
  /* 多选面板窄屏: 改为居中 modal 弹窗 (JS 侧已把 .mp-menu 移到 body 末尾, 彻底脱离 card 堆叠上下文,
     否则 .card 的 z-index/backdrop-filter 会封印内部 fixed 元素, 导致遮罩必然盖住面板)
     居中显示、大触点、显式"完成"按钮, 比底部弹出更好操作 */
  .mp-menu {
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    margin: 0; width: 92vw; max-width: 400px; max-height: 78vh;
    border-radius: 14px;
    padding: 16px 14px 12px;
    box-shadow: 0 20px 60px rgba(0,0,0,.28);
    z-index: 1200;
  }
  .mp-menu.show { grid-template-columns: repeat(4, 1fr); gap: 6px; min-width: 0; animation: mpModalIn .2s ease; }
  /* 渠道等自定义文本长度不定, 窄屏收成 1 列 + 允许换行, 避免撑爆 400px 容器出现横向滚动条 */
  .mp-menu-list.show { grid-template-columns: 1fr; }
  .mp-menu-list .mp-item { justify-content: flex-start; white-space: normal; word-break: break-all; text-align: left; }
  /* 加大触点与字号, 方便手指操作 */
  .mp-item { padding: 12px 6px; font-size: 15px; justify-content: center; background: #f8f9ff; }
  .mp-item input { width: 18px; height: 18px; }
  /* "完成"按钮: 铺满底部, 品牌色 */
  .mp-done {
    display: block; grid-column: 1 / -1;
    margin-top: 8px; padding: 12px; font-size: 15px; font-weight: 600;
    color: #fff; background: linear-gradient(135deg, #A855F7, #6366F1);
    border: none; border-radius: 10px; cursor: pointer;
  }
  /* 半透明遮罩: :has() 老浏览器降级为无遮罩不影响功能 */
  body:has(.mp-menu.show)::before {
    content: ''; position: fixed; inset: 0;
    background: rgba(0,0,0,.5); z-index: 1100;
    animation: mpMaskIn .2s ease;
  }
}
@keyframes mpModalIn { from { transform: translate(-50%, -50%) scale(.92); opacity: 0; } to { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
@keyframes mpMaskIn { from { opacity: 0; } to { opacity: 1; } }
@media (max-width: 640px) {
  /* 长列表窄屏限高滚动: 让分页按钮始终在屏内, 避免用户长滑找不到"下一页"
     max-height 用 vh 而非固定 px, 适应不同屏幕. 底部渐隐提示还有内容可滚 */
  .table-scroll-mobile { max-height: 60vh; overflow-y: auto; -webkit-overflow-scrolling: touch; border-radius: 8px; position: relative; }
  .table-scroll-mobile::-webkit-scrollbar { width: 4px; }
  .table-scroll-mobile::-webkit-scrollbar-thumb { background: #cbcfda; border-radius: 2px; }
  /* 待办树：缩进收窄, 操作按钮常显 */
  .todo-row { margin-left: calc(var(--depth, 0) * 16px); gap: 8px; padding: 8px 10px; }
  .todo-node[data-depth]:not([data-depth="0"]) > .todo-row::before { left: calc(var(--depth, 0) * 16px - 9px); width: 8px; }
  .todo-ops { opacity: 1; }
  /* 手机端拖拽手柄隐藏: 改为长按整行拖拽(见 todoBindDrag), 操作区少一个小按钮防误触 */
  .todo-drag { display: none !important; }
  /* 长按拖起时手机上"浮起"更强: 放大更多 + 倾斜 + 大投影, 明确区别于普通按压 */
  .todo-node.dragging > .todo-row {
    transform: scale(1.045) rotate(-.8deg);
    box-shadow: 0 22px 44px rgba(31,35,41,.26), 0 8px 18px rgba(168,85,247,.26), 0 0 0 2px rgba(168,85,247,.28);
  }
  .todo-stat { min-width: 70px; padding: 10px; }
  /* 卡片视图窄屏收小内边距 */
  .todo-card__body { padding: 12px 14px 8px; }
  .todo-card__title { font-size: 16px; }
  .todo-card__foot { padding: 6px 10px; }
  /* 详情面包屑: 窄屏允许换行, 标题独占一行避免按钮把它挤没; 按钮成对紧凑排列 */
  .todo-crumb { flex-wrap: wrap; gap: 8px; padding: 8px 10px; }
  .todo-crumb__title { flex: 1 0 100%; order: -1; font-size: 15px; white-space: normal; overflow: visible; text-overflow: clip; line-height: 1.35; }
  .todo-crumb .btn.sm { padding: 5px 10px; font-size: 12px; }
  /* 全屏模式下, 抽屉浮层覆盖: 从左侧滑入, 半透明遮罩 */
  .todo-fullscreen { flex-direction: row; }
  .todo-drawer {
    position: fixed; top: 0; left: 0; bottom: 0; z-index: 1001;
    transform: translateX(-100%);
    box-shadow: 2px 0 20px rgba(0,0,0,.15);
  }
  .todo-drawer.closed { display: flex; transform: translateX(-100%); }
  .todo-drawer.open { transform: translateX(0); }
  .todo-drawer-mask {
    display: none; position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,.35);
  }
  body.todo-fs-on .todo-drawer-mask.show { display: block; }
  /* 手机端全屏顶栏 sticky + 滚动方向隐藏/显示; PC 端不生效 */
  /* 把 fs-main 的 padding-top 移到 fs-top 自身, 让 sticky 到 top:0 时无空隙 */
  .todo-fs-main { padding: 0 12px calc(14px + var(--kb-inset, 0px)); }
  .todo-fs-top {
    position: sticky; top: 0; z-index: 5;
    padding-top: 12px; margin-left: -12px; margin-right: -12px;
    padding-left: 12px; padding-right: 12px;
  }
  .todo-fs-top--hidden { transform: translateY(-110%); opacity: 0; pointer-events: none; }
}
`;

/**
 * 渲染顶部导航（登录后页面）
 * @param {Object} user - { username, role }
 * @param {string} active - 当前激活页 key
 * @returns {string}
 */
function renderTopbar(user, active = '') {
  // 原生 App 壳内（WebView 带 app_shell cookie）：顶部网站导航交给底部原生 Tab，不渲染。
  // 保留超管 impersonate 黄条（重要提示），并收紧内容区顶部留白。
  if (user.appShell) {
    return `<style>.container{margin-top:0 !important;}</style>` + (user.impersonating ? `<div class="impersonate-banner">
      ⚠️ 你（超管 ${user.admin_username || ''}）正在以 <b>${user.username}</b> 的身份浏览
      <a href="#" id="stopImpersonateBtn">点此退出</a>
    </div>` : '');
  }
  const links = [
    { key: 'dashboard', href: '/dashboard', text: '仪表盘' },
    { key: 'todo', href: '/todo', text: '待办清单' },
    { key: 'monitor', href: '/monitor', text: '定时任务' },
    { key: 'channels', href: '/channels', text: '通知渠道' },
    { key: 'fund', href: '/fund', text: '基金追踪' },
    { key: 'asset', href: '/asset', text: '资产报表' },
    { key: 'weight', href: '/weight', text: '体重曲线' }
  ];
  if (user.role === 'admin') links.push({ key: 'admin', href: '/admin', text: '用户管理' });

  // 受限免密会话：导航只保留对应模块，隐藏设置/登出以外的其他入口
  const restricted = !!user.quickloginModule;
  const shownLinks = restricted ? links.filter(l => l.key === user.quickloginModule) : links;

  const navHtml = shownLinks.map(l =>
    `<a href="${l.href}" class="${active === l.key ? 'active' : ''}">${l.text}</a>`
  ).join('');

  return `<div class="topbar">
    <h1><span class="brand"><span class="brand-rocket" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><defs><linearGradient id="rocketGrad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#FFD86B"/><stop offset="100%" stop-color="#FF7A59"/></linearGradient></defs><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" fill="url(#rocketGrad)" stroke="url(#rocketGrad)"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" fill="url(#rocketGrad)" stroke="#fff" stroke-width="1.2"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" stroke="url(#rocketGrad)"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" stroke="url(#rocketGrad)"/></svg></span><span class="brand-w1">监控追踪</span><span class="brand-sep" aria-hidden="true"></span><span class="brand-w2">定时发送</span></span><span class="brand-clock" id="brandClock" aria-live="off"></span></h1>
    <div class="nav">${navHtml}</div>
    <div class="user">${user.nickname || user.username} <span class="tag ${user.role}">${user.role === 'admin' ? '超管' : '用户'}</span>
      <a href="#" id="themeToggle" class="act-btn" title="切换主题（浅色 / 暗色 / 护眼）"><span id="themeToggleIcon" style="display:inline-flex;align-items:center;"></span><span id="themeToggleLabel"></span></a>
      ${restricted ? '' : '<a href="/settings" class="act-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>设置</a>'}
      <a href="#" id="logoutBtn" class="act-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>登出</a>
    </div>
  </div>` + (user.impersonating ? `<div class="impersonate-banner">
    ⚠️ 你（超管 ${user.admin_username || ''}）正在以 <b>${user.username}</b> 的身份浏览
    <a href="#" id="stopImpersonateBtn">点此退出</a>
  </div>` : '') +
  // 顶栏时钟按配置时区(app_settings.tz_offset)显示，内联注入供 COMMON_JS 的 initBrandClock 读取
  `<script>window.__TZ_OFFSET__=${Number.isFinite(user.tzOffset) ? user.tzOffset : 8};</script>`;
}

export { renderPage, renderTopbar, BASE_CSS };
