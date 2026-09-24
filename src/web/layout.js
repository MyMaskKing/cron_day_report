/**
 * HTML 页面框架：统一 CSS、导航、页面外壳
 */

// 与 static.js 构成循环 import：仅在 renderPage 函数体内调用 assetUrl（请求时才执行），
// ESM live binding 下模块已全部就绪。静态资源 URL 带「内容 hash」版本：内容变 hash 自动变、
// 浏览器自动重新下载，内容不变则走 immutable 强缓存零传输，无需手动维护版本号。
import { assetUrl } from './static.js';

/**
 * 站点 favicon（SVG 矢量）：白色圆角纸飞机居中，机身就是钟面——
 * 短时针指向机头（右上）、长分针指向尾翼（左），约 10:10 钟表造型；
 * 交叉原点用品牌渐变暖端橙色 #FF7A59 与蓝紫针身区分。
 * 尖角用同色描边 linejoin=round 圆化；path 包围盒四边对称（9.5/9.5），中心在 32,32。
 * 经 /s/favicon.svg 外链，内容 hash 自动缓存。
 */
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#4F63E8"/><stop offset=".55" stop-color="#7C5CFF"/><stop offset="1" stop-color="#A855F7"/>
</linearGradient></defs>
<rect width="64" height="64" rx="14" fill="url(#g)"/>
<path d="M54.5 9.5 L9.5 29.1 L31.4 34.9 L37.2 54.5 Z"
  fill="#fff" stroke="#fff" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>
<path d="M36.1 28.4 L18.8 28.9" stroke="#4F63E8" stroke-width="3.8" stroke-linecap="round"/>
<path d="M36.1 28.4 L42 22.3" stroke="#4F63E8" stroke-width="4.8" stroke-linecap="round"/>
<circle cx="36.1" cy="28.4" r="3" fill="#FF7A59"/>
</svg>`;

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
<link rel="icon" type="image/svg+xml" href="${assetUrl('favicon.svg')}">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/marked/4.3.0/marked.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.6/purify.min.js"></script>
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
  --muted: #6f7079;         /* 弱化说明 .muted/关闭钮(原 #999, 提深达 AA) */
  --muted-2: #6b7299;       /* 蓝灰说明 todo-count/note(原 #8890b8, 提深达 AA) */
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
  --brand-strong: #7C3AED;  /* 实色/渐变首段: 主按钮/侧栏 logo(白字对比 5.6:1) */
  --brand-grad: linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%);  /* 主按钮等行动点 */
  --brand-tint: #F3EEFE;    /* 品牌浅紫底(blockquote/标签/按压态) */
  --on-brand: #fff;
  --danger: #cf1322;
  --ok: #34b34a;
  --danger-bg: #fff1f0;
  --ok-bg: #f6ffed;
  --warn: #b45309;        /* 临近到期(明天/本周内)琥珀色 */
  --warn-bg: #fdf2e2;
  /* child_due「各自截止」模式标识: 品牌浅紫族(与"今天"chip 同语言, 低唤醒), 三主题各自取值 */
  --cd-bg: #F3EEFE;
  --cd-fg: #7C3AED;
  --cd-border: #dfe4fb;
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
  --brand-tint: rgba(168,85,247,.18);
  --danger: #ff6b6b;
  --ok: #4ade80;
  --danger-bg: rgba(255,107,107,.14);
  --ok-bg: rgba(74,222,128,.12);
  --warn: #fbbf24;
  --warn-bg: rgba(251,191,36,.15);
  --cd-bg: rgba(168,85,247,.18);
  --cd-fg: #b97bff;
  --cd-border: rgba(185,123,255,.45);
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
  --muted: #7d7358;
  --muted-2: #6f654d;
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
  --brand-tint: #f0e6f8;
  --danger: #c0392b;
  --ok: #2f9e44;
  --danger-bg: #fbeae7;
  --ok-bg: #e9f5ea;
  --warn: #93611a;
  --warn-bg: #f6ead2;
  --cd-bg: #f0e6f8;
  --cd-fg: #7e22ce;
  --cd-border: #d9cdf5;
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
  line-height: 1.6;
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
/* ============ 应用外壳：桌面侧边导航 (.app-side) + 手机底部 Tab (.m-tabbar) ============
   仅登录态页面由 renderTopbar 输出；原生 App 壳(appShell)/公开免密页不输出, body:has() 不匹配,
   容器零偏移。断点: ≥1100px 全宽侧栏 232 / 641–1099px 图标栏 64 / ≤640px 隐藏侧栏改底部 Tab。 */
.app-side {
  position: fixed; left: 0; top: 0; bottom: 0; z-index: 200;
  width: 232px; display: flex; flex-direction: column;
  background: var(--surface); border-right: 1px solid var(--border);
}
.app-side__brand { display: flex; align-items: center; gap: 10px; padding: 18px 18px 12px; color: inherit; }
.app-side__brand:hover { text-decoration: none; }
.app-side__logo {
  width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
  background: var(--brand-grad); color: #fff;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 12px rgba(124, 58, 237, .30);
}
.app-side__logo svg { width: 19px; height: 19px; display: block; }
.app-side__name { display: flex; flex-direction: column; line-height: 1.3; min-width: 0; }
.app-side__name b { font-size: 14px; font-weight: 800; color: var(--text-strong); letter-spacing: .01em; white-space: nowrap; }
.app-side__name small { font-size: 11px; font-weight: 600; color: var(--brand); white-space: nowrap; }
.app-side__clock { padding: 0 20px 10px; font-size: 11.5px; color: var(--muted-2); font-variant-numeric: tabular-nums; }
.app-side__nav { flex: 1; overflow-y: auto; padding: 2px 12px 12px; overscroll-behavior: contain; }
.app-side__grp { font-size: 11px; font-weight: 700; letter-spacing: .08em; color: var(--faint); padding: 12px 10px 4px; white-space: nowrap; }
.app-side__grp:first-child { padding-top: 2px; }
a.app-side__item, button.app-side__item {
  display: flex; align-items: center; gap: 10px; width: 100%;
  margin: 1px 0; padding: 8px 10px; border-radius: 9px;
  font-size: 13.5px; font-weight: 500; font-family: inherit; text-align: left;
  color: var(--label); background: none; border: none; cursor: pointer; white-space: nowrap;
  transition: background .15s, color .15s;
}
a.app-side__item { text-decoration: none; }
.app-side__item svg { width: 17px; height: 17px; flex-shrink: 0; }
.app-side__item:hover { background: var(--hover-bg); color: var(--text-strong); }
a.app-side__item.active { background: var(--hover-brand); color: var(--brand); font-weight: 700; }
.app-side__foot { flex-shrink: 0; border-top: 1px solid var(--border); padding: 8px 12px 12px; }
.app-side__me {
  display: flex; align-items: center; gap: 9px; margin-top: 8px;
  padding: 8px 10px; border: 1px solid var(--border); border-radius: 11px;
}
.app-side__avatar {
  width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
  background: var(--brand-grad); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700;
}
.app-side__who { min-width: 0; display: flex; flex-direction: column; line-height: 1.3; }
.app-side__who b { font-size: 13px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.app-side__who .tag { align-self: flex-start; margin-top: 1px; }
/* 内容区给侧栏让位: body 左 padding 留出侧栏宽度(fixed 元素不受影响),
   .container 在右侧工作区内 margin:auto 居中, 宽屏下左右留白对称 */
@media (min-width: 1100px) {
  body:has(.app-side) { padding-left: 232px; }
  body:has(.app-side) .container { max-width: 1180px; margin: 24px auto; }
}
/* 641–1099px: 侧栏收成 64px 图标栏 */
@media (min-width: 641px) and (max-width: 1099px) {
  .app-side { width: 64px; }
  .app-side__brand { justify-content: center; padding: 16px 0 10px; }
  .app-side__name, .app-side__clock { display: none; }
  .app-side__nav { padding: 2px 8px 8px; overflow: hidden; }
  .app-side__grp { height: 10px; padding: 0; text-indent: -999px; overflow: hidden; }
  a.app-side__item, button.app-side__item { justify-content: center; padding: 10px 0; }
  .app-side__item .as-label { display: none; }
  .app-side__foot { padding: 8px 6px 10px; }
  .app-side__foot .app-side__item { justify-content: center; }
  .app-side__me { justify-content: center; padding: 6px 0; border: none; }
  .app-side__who { display: none; }
  body:has(.app-side) { padding-left: 64px; }
  body:has(.app-side) .container { margin: 16px auto; }
}
/* ≤640px: 侧栏隐藏, 改底部 Tab（仅浏览器: App 壳不输出该节点） */
.m-tabbar, .m-fab { display: none; }
@media (max-width: 640px) {
  .app-side { display: none; }
  .m-tabbar {
    display: flex; position: fixed; left: 0; right: 0; bottom: 0; z-index: 200;
    height: calc(60px + env(safe-area-inset-bottom, 0px));
    padding-bottom: env(safe-area-inset-bottom, 0px);
    background: var(--surface); border-top: 1px solid var(--border);
    box-shadow: 0 -2px 14px rgba(20, 20, 40, .06);
    transition: transform .22s ease;
  }
  .m-tabbar a {
    position: relative; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
    font-size: 10.5px; font-weight: 500; color: var(--faint); text-decoration: none;
  }
  .m-tabbar a.on { color: var(--brand); font-weight: 700; }
  .m-tabbar a.on::before {
    content: ''; position: absolute; top: 0; width: 24px; height: 2.5px; border-radius: 99px; background: var(--brand);
  }
  .m-tabbar svg { width: 21px; height: 21px; }
  body:has(.m-tabbar) .container { padding-bottom: 80px; }
  /* 新建任务 FAB: 仅待办页(renderTopbar 按 active 输出); 默认态代理 #tAdd, 全屏态代理 #tAddFs
     (renderTopbar 的内联脚本按 body.todo-fs-on 自动选择)。App 壳无 .m-tabbar 时贴底 20px。 */
  .m-fab {
    position: fixed; right: 16px; bottom: calc(20px + env(safe-area-inset-bottom, 0px)); z-index: 1003;
    width: 54px; height: 54px; border-radius: 18px; border: none; cursor: pointer;
    background: var(--brand-grad); color: #fff;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 12px 28px rgba(124, 58, 237, .45), 0 3px 8px rgba(124, 58, 237, .32);
    transition: transform .22s ease, opacity .2s ease;
  }
  body:has(.m-tabbar) .m-fab { bottom: calc(82px + env(safe-area-inset-bottom, 0px)); }
  .m-fab:active { transform: scale(.94); }
  .m-fab svg { width: 26px; height: 26px; }
  .m-tabbar { z-index: 1002; }
  /* FAB 隐藏场景: 卡片详情态(添加走子任务入口) / 抽屉打开 / 弹窗打开 / 键盘弹起 */
  body.todo-detail .m-fab,
  body:has(.todo-drawer.open) .m-fab,
  body:has(#modalMask.show) .m-fab { transform: scale(.4); opacity: 0; pointer-events: none; }
  body.kb-on .m-tabbar, body.kb-on .m-fab {
    transform: translateY(130%); opacity: 0; pointer-events: none;
  }
  /* 覆盖式(App/部分浏览器): 系统不压缩 layout, 底部留白=键盘高;
     压缩式浏览器(kb-resize): 系统已把容器缩到键盘上方, 只留小呼吸, 不双倍留白 */
  body.kb-on .todo-fs-main { padding-bottom: calc(12px + var(--kb-inset, 0px)); }
  body.kb-resize .todo-fs-main { padding-bottom: 14px; }
  /* 手机待办树(完整树/卡片进入的子任务详情): 操作收进「⋯」弹层, 行内只留更多钮;
   标题保留完整显示；备注仍单行截断，完整内容点详情查看 */
  body .todo-tree .todo-ops { opacity: 1; gap: 0; }
  body .todo-tree .todo-ops .todo-op:not(.todo-more) { display: none; }
  body .todo-tree .todo-op.todo-more { display: inline-flex; }
  body:not(.todo-detail) .todo-tree .todo-title { white-space: pre-wrap; overflow: visible; text-overflow: clip; }
  /* 基金页策略浮层在底栏之上的避让规则写在 .strat-* 原媒体块旁(该处带 !important) */
}
/* 手机完整树「⋯」操作弹层(桌面 ⋯ 隐藏, 弹层也不会被触发) */
.todo-op.todo-more { display: none; }
.todo-op-menu {
  position: absolute; right: 4px; top: calc(100% - 4px); z-index: 300; min-width: 162px;
  display: flex; flex-direction: column; gap: 1px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 5px;
  box-shadow: 0 12px 32px rgba(20,20,40,.18), 0 2px 8px rgba(20,20,40,.08);
  animation: fabMenuIn .15s cubic-bezier(.2,.9,.3,1);
}
.todo-op-menu__item {
  display: flex; align-items: center; gap: 10px; width: 100%;
  border: 0; background: none; color: var(--text); font-family: inherit; font-size: 13.5px;
  text-align: left; padding: 9px 11px; border-radius: 8px; cursor: pointer; white-space: nowrap;
}
.todo-op-menu__item svg { width: 16px; height: 16px; color: var(--link-dim); flex: none; }
.todo-op-menu__item.danger { color: var(--danger); }
.todo-op-menu__item.danger svg { color: var(--danger); }
.todo-op-menu__item:active { background: var(--surface-2); }
.todo-op-menu--fixed {
  position: fixed; right: auto; z-index: 2000;
  max-width: calc(100vw - 16px);
}
/* 打开菜单的行与整个任务节点一起抬层, 避免后续兄弟行/子行的白底盖住弹层 */
.todo-node:has(> .todo-row.op-menu-open) { position: relative; z-index: 200; }
.todo-row.op-menu-open { z-index: 210; }
/* 菜单展开期间收起右下 FAB, 避免遮住最后几行的弹层 */
body.todo-opmenu .m-fab { transform: scale(.4); opacity: 0; pointer-events: none; }
/* FAB 加号弹出菜单: 两个竖排卡片按钮(任务/备忘录), 定位由 JS 按锚点按钮写 top/bottom+right */
.fab-menu {
  position: fixed; z-index: 1004;
  display: flex; flex-direction: column; gap: 6px;
  width: max-content;
  animation: fabMenuIn .16s cubic-bezier(.2,.9,.3,1);
}
@keyframes fabMenuIn { from { opacity: 0; transform: translateY(8px) scale(.96); } to { opacity: 1; transform: none; } }
.fab-menu__item {
  display: flex; align-items: center; gap: 8px; min-height: 40px; text-align: left;
  padding: 6px 12px; border-radius: 10px; font-family: inherit; cursor: pointer;
  background: var(--surface); color: var(--text); border: 1px solid var(--border);
  box-shadow: 0 10px 30px rgba(20,20,40,.16), 0 2px 8px rgba(20,20,40,.08);
  transition: transform .12s ease, border-color .12s ease;
}
.fab-menu__item:active { transform: scale(.97); border-color: var(--brand-border); }
.fab-menu__ic { flex: none; width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center;
  background: var(--brand-tint); color: var(--brand); }
.fab-menu__ic svg { width: 15px; height: 15px; }
.fab-menu__t { font-size: 14px; font-weight: 600; line-height: 1.3; }
@media (prefers-reduced-motion: reduce) { .fab-menu { animation: none; } }
.impersonate-banner { background: #fff3cd; color: #856404; padding: 10px 24px; font-size: 14px; text-align: center; border-bottom: 1px solid #ffe58f; }
.impersonate-banner a { color: var(--danger); font-weight: 600; margin-left: 8px; }
/* 全站公告强制阅读弹窗：独立遮罩，层级高于 #globalLoading(10500)，无关闭叉、点空白不关闭 */
.announce-modal { z-index: 10600; }
.announce-modal .modal-box { width: 100%; max-width: 560px; }
.announce-modal .announce-md { max-height: 56vh; overflow-y: auto; font-size: 14px; line-height: 1.7; }
.announce-modal .announce-md > :first-child { margin-top: 0; }
.announce-modal .announce-md > :last-child { margin-bottom: 0; }
.announce-modal .announce-md img { max-width: 100%; }
.container { max-width: 1000px; margin: 24px auto; padding: 0 16px; }
/* 实色卡片: 表面色 + 1px 描边 + 极轻阴影（2025 主流语言, 低端机滚动无合成开销） */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 20px; margin-bottom: 18px;
  box-shadow: 0 1px 2px rgba(20, 20, 40, .04);
  /* card 统一 position:relative + z-index 参与堆叠排序, 否则内部绝对定位弹窗(.mp-menu)
     溢出到下方 card 会被后者遮住; :has 打开弹窗时再提升整卡 */
  position: relative;
  z-index: 1;
}
/* 当前打开多选弹窗 / 操作下拉菜单的 card 提升到最上层, 弹窗才能压过后续 card */
.card:has(.mp-menu.show),
.card:has(.dropdown-menu.show) { z-index: 100; }
.card h2 { font-size: 16px; margin-bottom: 14px; color: var(--text-strong); }
/* 推送配置折叠卡: 低频设置默认收起, 不占页面主流程; 内部 id/class 全部保留, JS 零感知 */
.card.push-card { padding: 0; overflow: hidden; }
/* 多选下拉打开时放开裁切: 否则 .mp-menu 向下溢出卡片的部分（24 个小时选项的下半段）被
   overflow:hidden 切掉; 层叠顺序由上方 .card:has(.mp-menu.show){z-index:100} 保证 */
.card.push-card:has(.mp-menu.show) { overflow: visible; }
.push-card > summary {
  list-style: none; cursor: pointer; user-select: none;
  display: flex; align-items: center; gap: 10px;
  padding: 14px 20px; font-size: 15px; font-weight: 700; color: var(--text-strong);
}
.push-card > summary::-webkit-details-marker { display: none; }
.push-card__icon {
  width: 30px; height: 30px; border-radius: 9px; flex-shrink: 0;
  background: var(--brand-tint); color: var(--brand);
  display: flex; align-items: center; justify-content: center;
}
.push-card__icon svg { width: 16px; height: 16px; }
.push-card__chev { margin-left: auto; width: 17px; height: 17px; color: var(--faint); transition: transform .2s; flex-shrink: 0; }
.push-card[open] .push-card__chev { transform: rotate(180deg); }
.push-card__body { padding: 2px 20px 18px; border-top: 1px solid var(--border); }
@media (max-width: 640px) {
  .push-card > summary { padding: 13px 15px; }
  .push-card__body { padding: 2px 15px 15px; }
}
/* 仅手机显示(桌面侧栏已含全部入口): 设置页"功能入口"卡 */
.m-only { display: none; }
@media (max-width: 640px) { .m-only { display: block; } }
.m-entry { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.m-entry a {
  display: flex; align-items: center; gap: 8px; padding: 12px 14px;
  border: 1px solid var(--border); border-radius: 10px;
  color: var(--text); font-size: 14px; font-weight: 500;
}
.m-entry a svg { color: var(--brand); flex-shrink: 0; }
.m-entry a:hover { border-color: var(--brand-border); background: var(--hover-brand); text-decoration: none; }
/* 退出登录（仅手机浏览器功能入口卡；App 壳不输出该项，登出走原生「我的」） */
.m-entry a.m-entry__logout { color: var(--danger); }
.m-entry a.m-entry__logout svg { color: var(--danger); }
.m-entry a.m-entry__logout:hover { border-color: rgba(207,19,34,.35); background: rgba(207,19,34,.06); }
/* 仪表盘 KPI 语义数字 */
#kpiToday { color: var(--brand); }
#kpiOverdue.num:not(:empty) { color: var(--danger); }
/* 仪表盘今日待办行 */
.dash-todo .dash-row {
  position: relative;
  display: flex; align-items: center; gap: 10px;
  padding: 9px 2px; border-bottom: 1px solid var(--th-border); font-size: 14px;
}
.dash-todo .dash-row:last-child { border-bottom: none; }
.dash-row .d-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; background: var(--brand); }
.dash-row .d-dot.od { background: var(--danger); }
.dash-row a { flex: 1; min-width: 0; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dash-row a:hover { color: var(--brand); }
/* 整行都是链接热区：伪元素铺满行（含圆点/日期标签），点哪都直达该任务详情 /todo?root=id */
.dash-row a::after { content: ''; position: absolute; inset: 0; }
.dash-row .d-tag { font-size: 11.5px; color: var(--muted-2); flex-shrink: 0; font-variant-numeric: tabular-nums; }
.dash-row .d-tag.od { color: var(--danger); font-weight: 600; }
/* 仪表盘今日待办：手风琴行（圆点主任务行 + 就地展开子任务勾选行，行间细分隔线，无卡片框） */
.dash-todo .dash-groups { display: flex; flex-direction: column; max-height: 360px; overflow-y: auto; padding: 2px 0; }
.dash-todo .dash-acc { border-bottom: 1px solid var(--th-border); }
.dash-todo .dash-acc:last-child { border-bottom: none; }
.dash-todo .dash-arow { position: relative; display: flex; align-items: center; gap: 10px; padding: 9px 2px; }
.dash-todo .dash-adot { width: 7px; height: 7px; border-radius: 50%; flex: none; background: var(--brand); }
.dash-todo .dash-adot.od { background: var(--danger); }
.dash-todo .dash-aname {
  flex: 1; min-width: 0; font-size: 14px; color: var(--text);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.dash-todo .dash-aname:hover { color: var(--brand); }
/* 主标题链接热区铺满整行；折叠箭头/日期靠 z-index 独立点击 */
.dash-todo .dash-aname::after { content: ''; position: absolute; inset: 0; }
.dash-todo .dash-aarrow {
  flex: none; width: 22px; height: 22px; padding: 0; border: 0; background: transparent;
  color: var(--muted); font-size: 10px; cursor: pointer; border-radius: 5px; z-index: 1;
  transition: transform .18s;
}
.dash-todo .dash-aarrow:hover { color: var(--brand); }
.dash-todo .dash-acc.collapsed .dash-aarrow { transform: rotate(-90deg); }
.dash-todo .dash-atag { flex: none; font-size: 11.5px; color: var(--muted-2); font-variant-numeric: tabular-nums; z-index: 1; }
.dash-todo .dash-atag.od { color: var(--danger); font-weight: 600; }
.dash-todo .dash-akids { padding: 0 2px 7px 19px; }
.dash-todo .dash-acc.collapsed .dash-akids { display: none; }
.dash-todo .dash-achild { display: flex; align-items: flex-start; gap: 9px; padding: 5px 2px; }
/* 勾选圆复用待办页 .todo-card__check，尺寸收紧 */
.dash-todo .dash-achild .todo-card__check { width: 20px; height: 20px; flex: none; z-index: 1; }
.dash-todo .dash-achild .todo-card__check::after { font-size: 12px; }
.dash-todo .dash-actitle {
  flex: 1; min-width: 0; font-size: 13.5px; color: var(--text);
  word-break: break-word;
}
/* 多行标题时勾选圆/日期与首行文字对齐 */
.dash-todo .dash-achild .todo-card__check { margin-top: 1px; }
.dash-todo .dash-acdate { margin-top: 3px; }
.dash-todo .dash-actitle:hover { color: var(--brand); }
.dash-todo .dash-acdate { flex: none; font-size: 11.5px; color: var(--muted-2); font-variant-numeric: tabular-nums; }
.dash-todo .dash-acdate.od { color: var(--danger); font-weight: 600; }
/* 手机端适配：限高收缩、触控热区放大、缩进收紧 */
@media (max-width: 640px) {
  .dash-todo .dash-groups { max-height: 300px; -webkit-overflow-scrolling: touch; }
  .dash-todo .dash-arow { gap: 8px; padding: 11px 2px; }
  .dash-todo .dash-aarrow { width: 30px; height: 30px; }
  .dash-todo .dash-akids { padding: 0 2px 8px 16px; }
  .dash-todo .dash-achild { gap: 10px; padding: 6px 2px; }
  .dash-todo .dash-actitle { font-size: 14px; }
}
/* 手机视图：所有滚动条强制透明隐藏（触屏滑动不受影响）。
   !important 必须保留——极光滚动条全局规则在本文件后段, 同特异性会反覆盖此规则 */
@media (max-width: 640px) {
  * { scrollbar-width: none !important; -ms-overflow-style: none !important; }
  *::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important; }
}
/* 主按钮: 品牌双色紫渐变 + 内高光, hover 提亮 + 品牌柔光, 点击涟漪 */
.btn {
  position: relative; overflow: hidden;
  display: inline-block; padding: 8px 16px; border: none; border-radius: 8px;
  background: var(--brand-grad);
  color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;
  box-shadow: 0 2px 8px rgba(124, 58, 237, .24), inset 0 1px 0 rgba(255,255,255,.18);
  transition: transform .12s ease, box-shadow .18s ease, filter .18s ease;
}
.btn:hover { filter: brightness(1.06); box-shadow: 0 6px 16px rgba(124, 58, 237, .32), inset 0 1px 0 rgba(255,255,255,.22); }
.btn:active { transform: translateY(1px); }
.btn::after {
  content: ''; position: absolute; left: 50%; top: 50%;
  width: 0; height: 0; border-radius: 50%;
  background: radial-gradient(circle, rgba(255,255,255,.55) 0%, rgba(255,255,255,0) 70%);
  transform: translate(-50%, -50%);
  pointer-events: none; opacity: 0;
}
.btn:active::after { width: 260px; height: 260px; opacity: 1; transition: width .38s ease-out, height .38s ease-out, opacity .5s ease-out; }
.btn.danger { background: linear-gradient(135deg, #DC2626, #B91C1C); box-shadow: 0 2px 8px rgba(185, 28, 28, .22), inset 0 1px 0 rgba(255,255,255,.16); font-weight: 600; }
.btn.danger:hover { filter: brightness(1.06); box-shadow: 0 6px 16px rgba(185, 28, 28, .32), inset 0 1px 0 rgba(255,255,255,.2); }
.btn.gray { background: linear-gradient(135deg, #7B7E8C, #5F6270); box-shadow: 0 2px 8px rgba(60, 66, 80, .16), inset 0 1px 0 rgba(255,255,255,.12); font-weight: 600; }
.btn.sm { padding: 4px 10px; font-size: 12px; }
/* select 复用 .btn 样式时(如 profitRange/unitSel), select 本身是灰底白字,
   但原生 <option> 展开层由浏览器接管、白底继承 color:#fff 会出现"白底白字看不清";
   显式给 option 打回深色文字 + 白底 */
select.btn option { color: var(--text-strong); background: var(--surface); }
input, select, textarea { width: 100%; padding: 9px 12px; border: 1px solid var(--border-input); border-radius: 8px; font-size: 14px; margin-bottom: 12px; font-family: inherit; background: var(--input-bg); color: var(--text); }
input:focus, select:focus, textarea:focus { outline: none; border-color: var(--brand); box-shadow: 0 0 0 3px rgba(168, 85, 247, .14); background: var(--surface); }
/* 键盘焦点环: 鼠标点击不出现, Tab/读屏导航时所有可交互元素可见 */
:where(a, button, select, input, textarea, [tabindex]):focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; border-radius: 6px; }
label { display: block; font-size: 13px; color: var(--label); margin-bottom: 5px; }
.todo-priority {
  display: flex; gap: 4px; padding: 3px; margin: 0 0 12px;
  background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px;
}
.todo-priority label {
  flex: 1; min-width: 0; min-height: 34px; margin: 0;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  border-radius: 8px; color: var(--muted); font-size: 13px; font-weight: 600;
  cursor: pointer; transition: background .15s ease, color .15s ease, box-shadow .15s ease;
}
.todo-priority label:hover { color: var(--text); background: var(--hover-bg); }
.todo-priority input {
  position: absolute; width: 1px; height: 1px; margin: 0;
  opacity: 0; pointer-events: none;
}
.todo-priority-dot { width: 8px; height: 8px; border-radius: 50%; background: #b4bccb; }
.todo-priority-dot.pri-2 { background: #e5484d; }
.todo-priority-dot.pri-1 { background: #e8a317; }
.todo-priority label.is-checked,
.todo-priority label:has(input:checked) {
  background: var(--surface);
  box-shadow: 0 1px 2px rgba(15, 23, 42, .12), 0 1px 3px rgba(15, 23, 42, .08);
}
.todo-priority label.is-checked[data-priority="2"],
.todo-priority label:has(input[value="2"]:checked) { color: #e5484d; }
.todo-priority label.is-checked[data-priority="1"],
.todo-priority label:has(input[value="1"]:checked) { color: #d97706; }
.todo-priority label.is-checked[data-priority="0"],
.todo-priority label:has(input[value="0"]:checked) { color: #6b7280; }
.todo-priority label:has(input:focus-visible) { outline: 2px solid var(--brand); outline-offset: 2px; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--th-border); }
th { color: var(--label); font-weight: 600; background: var(--th-bg); }
/* tag: 语义底色全部走主题 token, 亮/暗/护眼自动适配, 不再硬编码浅色系 */
.tag { display: inline-block; padding: 2px 8px; border-radius: 5px; font-size: 12px; border: 1px solid transparent; font-weight: 500; }
.tag.admin, .tag.fail { background: var(--danger-bg); color: var(--danger); }
.tag.user { background: var(--hover-brand); color: var(--brand); }
.tag.active, .tag.ok { background: var(--ok-bg); color: var(--ok); }
.tag.disabled { background: var(--surface-2); color: var(--muted); }
/* debt: 负债/欠款专用, 与 fail 同红系但加描边+粗体如账单, 与 disabled(停用灰) 语义拉开 */
.tag.debt { background: var(--danger-bg); color: var(--danger); border-color: var(--danger); font-weight: 700; letter-spacing: .3px; }
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
/* stat: 实色面 + hairline, 数字深墨黑 + tabular-nums; 不可点卡不浮起 */
.stat {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px; padding: 16px; text-align: center;
}
/* 数字统一: 深墨黑, tabular-nums 让千分位数字等宽对齐 */
.stat .num {
  font-size: 28px; font-weight: 700; color: var(--text-strong);
  font-variant-numeric: tabular-nums;
  letter-spacing: -.01em;
}
/* 图标态: SVG 图标居中在浅面圆角方块里, 尺寸/颜色由 accent 规则控制 */
.stat .num.num--icon {
  color: var(--label); font-size: 32px; line-height: 1;
  display: inline-flex; align-items: center; justify-content: center;
  width: 56px; height: 56px; margin: 0 auto 4px; border-radius: 16px;
  background-color: var(--surface-2);
  border: 1px solid var(--border);
  font-variant-numeric: normal;
  transition: background-color .2s ease, box-shadow .2s ease, color .2s ease;
}
.stat .num.num--icon svg { width: 28px; height: 28px; display: block; }
/* 功能入口各自 accent 色: hover 只染图标底/卡片边, 不位移(Operate 型工具克制) */
.stat-nav .stat { transition: box-shadow .2s ease, border-color .2s ease; }
.stat-nav .stat[data-nav="monitor"] .num--icon { color: #3b82f6; }
.stat-nav .stat[data-nav="monitor"]:hover { box-shadow: 0 6px 18px rgba(59,130,246,.14); border-color: rgba(59,130,246,.35); }
.stat-nav .stat[data-nav="monitor"]:hover .num--icon { background-color: rgba(59,130,246,.12); color: #3b82f6; }
.stat-nav .stat[data-nav="fund"] .num--icon { color: var(--brand); }
.stat-nav .stat[data-nav="fund"]:hover { box-shadow: 0 6px 18px rgba(168,85,247,.14); border-color: var(--brand-border); }
.stat-nav .stat[data-nav="fund"]:hover .num--icon { background-color: var(--hover-brand); color: var(--brand); }
.stat-nav .stat[data-nav="asset"] .num--icon { color: #f97316; }
.stat-nav .stat[data-nav="asset"]:hover { box-shadow: 0 6px 18px rgba(249,115,22,.15); border-color: rgba(249,115,22,.35); }
.stat-nav .stat[data-nav="asset"]:hover .num--icon { background-color: rgba(249,115,22,.12); color: #f97316; }
.stat-nav .stat[data-nav="weight"] .num--icon { color: #10b981; }
.stat-nav .stat[data-nav="weight"]:hover { box-shadow: 0 6px 18px rgba(16,185,129,.14); border-color: rgba(16,185,129,.35); }
.stat-nav .stat[data-nav="weight"]:hover .num--icon { background-color: rgba(16,185,129,.12); color: #10b981; }
.stat-nav .stat[data-nav="todo"] .num--icon { color: #f59e0b; }
.stat-nav .stat[data-nav="todo"]:hover { box-shadow: 0 6px 18px rgba(245,158,11,.15); border-color: rgba(245,158,11,.35); }
.stat-nav .stat[data-nav="todo"]:hover .num--icon { background-color: rgba(245,158,11,.12); color: #d97706; }
.stat-nav .stat[data-nav="admin"] .num--icon { color: #ec4899; }
.stat-nav .stat[data-nav="admin"]:hover { box-shadow: 0 6px 18px rgba(236,72,153,.14); border-color: rgba(236,72,153,.35); }
.stat-nav .stat[data-nav="admin"]:hover .num--icon { background-color: rgba(236,72,153,.12); color: #ec4899; }
.stat .lbl { font-size: 13px; color: var(--label); margin-top: 4px; }
.asset-title { font-size: 19px; margin-bottom: 6px; }
.asset-small { font-size: 12px; color: var(--muted); font-weight: 400; }
.asset-title__btn { float: right; margin-top: 2px; }
.asset-desc { margin: 0 0 14px; color: var(--muted); font-size: 13px; }
.asset-summary-stats { grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px; }
.asset-summary-stats .stat { padding: 13px; border-radius: 14px; background: var(--surface-3); min-width: 0; }
.asset-summary-stats .num { font-size: clamp(20px, 2.6vw, 27px); font-weight: 800; letter-spacing: -.4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.asset-summary-stats .lbl { color: var(--muted); font-size: 12px; margin-top: 3px; }
.asset-stat-sub { font-size: 12px; color: var(--muted); margin-top: 4px; }
.asset-summary-stats #sAssets { color: #f97316; }
.asset-summary-stats #sDebt { color: var(--danger); }
.asset-summary-stats #sNet { color: var(--brand-strong); }
.asset-summary-stats .num.is-up, .asset-status-number.is-up, .asset-metric__value.is-up, .asset-delta.is-up { color: var(--ok); }
.asset-summary-stats .num.is-down, .asset-status-number.is-down, .asset-metric__value.is-down, .asset-delta.is-down, .asset-money.is-down, .asset-type-pill__num.is-down { color: var(--danger); }
.asset-summary-stats .num.is-flat, .asset-status-number.is-flat, .asset-metric__value.is-flat, .asset-delta.is-flat { color: var(--muted); }
.asset-progress { height: 10px; border-radius: 999px; background: var(--surface-2); overflow: hidden; margin: 10px 0 8px; }
.asset-progress.is-achieved { background: var(--ok-bg); }
.asset-progress__fill { width: 0; height: 100%; border-radius: 999px; background: var(--brand-grad); box-shadow: 0 0 16px rgba(124,58,237,.22); }
.asset-progress.is-achieved .asset-progress__fill { background: var(--ok); box-shadow: 0 0 16px rgba(52,179,74,.28); }
.asset-goal-metrics { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px; }
.asset-metric { display: flex; justify-content: space-between; gap: 12px; padding-bottom: 10px; border-bottom: 1px solid var(--th-border); font-size: 14px; }
.asset-metric:last-child { padding-bottom: 0; border-bottom: 0; }
.asset-metric span { color: var(--muted); min-width: 0; }
.asset-metric b { text-align: right; color: var(--text-strong); font-variant-numeric: tabular-nums; }
.asset-metric--goal { cursor: pointer; }
.asset-goal-edit { cursor: pointer; }
.asset-metric--goal:hover .asset-goal-edit, .asset-goal-edit:hover { color: var(--brand-strong); }
.asset-type-pills { display: grid; grid-template-columns: repeat(6, minmax(0,1fr)); gap: 10px; margin-top: 14px; }
.asset-type-pill { border: 1px solid var(--border); background: var(--surface-2); border-radius: 14px; padding: 11px; min-width: 0; }
.asset-type-pill__num { display: block; color: var(--text-strong); font-size: 17px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.asset-type-pill span { display: block; color: var(--muted); font-size: 12px; margin-top: 2px; }
.asset-grid { display: grid; gap: 14px; margin-bottom: 18px; }
.asset-grid--84 { grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr); }
.asset-grid--75 { grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); }
.asset-grid > .card { margin-bottom: 0; min-width: 0; }
.asset-notice { border-radius: 14px; padding: 11px 13px; font-size: 13px; color: var(--brand-strong); background: var(--brand-tint); box-shadow: inset 0 0 0 1px rgba(124,58,237,.16); }
.asset-notice.warn { color: var(--warn); background: var(--warn-bg); box-shadow: inset 0 0 0 1px rgba(180,83,9,.22); }
.asset-legend { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 8px; color: var(--muted); font-size: 12px; }
.asset-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 5px; }
.asset-chart { display: block; width: 100%; height: 270px; max-height: 270px; }
.asset-status-number { font-size: 32px; font-weight: 850; line-height: 1.2; margin: 10px 0 4px; color: var(--text-strong); font-variant-numeric: tabular-nums; }
.asset-status-text { color: var(--muted); font-size: 13px; }
.asset-metric-list { display: grid; gap: 10px; margin-top: 12px; }
.asset-metric-list .asset-metric:last-child { border-bottom: 0; padding-bottom: 0; }
.asset-composition { display: grid; grid-template-columns: 220px minmax(0,1fr); gap: 20px; align-items: center; }
.asset-donut { width: 210px; height: 210px; border-radius: 50%; margin: auto; position: relative; background: var(--surface-2); }
.asset-donut__center { position: absolute; inset: 38px; border-radius: 50%; background: var(--surface); display: grid; place-items: center; text-align: center; color: var(--muted); font-size: 13px; box-shadow: 0 0 0 1px var(--th-border); }
.asset-donut__center strong { display: block; color: var(--text-strong); font-size: 15px; margin-top: 2px; }
.asset-legend-list { display: grid; gap: 9px; }
.asset-legend-row { display: grid; grid-template-columns: 12px minmax(0,1fr) auto; gap: 9px; align-items: center; font-size: 13px; }
.asset-legend-row i { width: 10px; height: 10px; border-radius: 50%; }
.asset-legend-row span { min-width: 0; }
.asset-legend-row b { text-align: right; color: var(--text-strong); font-variant-numeric: tabular-nums; }
.asset-table-wrap { overflow-x: auto; border: 1px solid var(--th-border); border-radius: 14px; }
.asset-table { font-size: 13px; }
.asset-table th, .asset-table td { padding: 10px 9px; text-align: right; white-space: nowrap; }
.asset-table th:first-child, .asset-table td:first-child { text-align: left; }
.asset-table th { color: var(--muted); background: var(--th-bg); font-weight: 600; }
.asset-table tr:last-child td { border-bottom: 0; }
.asset-table .asset-table__total td { background: var(--brand-tint); font-weight: 700; color: var(--text-strong); }
.asset-table .btn.sm { margin-right: 4px; }
.asset-table .btn.sm:last-child { margin-right: 0; }
.btn.asset-btn--secondary { background: var(--brand-tint); color: var(--brand-strong); box-shadow: none; }
.btn.asset-btn--secondary:hover { filter: none; box-shadow: 0 4px 12px rgba(124,58,237,.16); }
.asset-record-admin { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
@media (max-width: 900px) {
  .asset-grid--84, .asset-grid--75 { grid-template-columns: 1fr; }
}

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
/* 键盘避让: 短弹窗保持垂直居中不动布局, JS(assets.js liftFocused)按当前聚焦框算最小位移
   translateY 上移(带过渡), 键盘贴在当前输入框下面; 弹窗放不进键盘上方可视区时 JS 加 .kb-tall
   切"靠顶+遮罩整体滚动", 卡片保持【自然完整高度不裁切】(不设 max-height), 键盘下方字段滚动可达。 */
.modal-mask { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 10000; padding: 40px 16px; overflow-y: auto; touch-action: pan-y; overscroll-behavior: contain; }
.modal-mask.show { display: flex; }
/* 键盘弹出·短弹窗(.kb-on 非 .kb-tall): 布局仍居中, 弹窗整体 translateY 最小位移
   (JS 写 transform: 聚焦框底边送到键盘上沿-GAP, 顶边不低于 40px), 这里只负责平滑过渡 */
.modal-mask.kb-on .modal-box { transition: transform .18s ease; }
/* 键盘弹出·长弹窗(JS 加 .kb-tall): 弹窗【靠顶部】排列(不是居中、不缩放位移); 卡片不设限高、
   保持自然完整高度, 内容超出键盘上方区域时由遮罩(.modal-mask 自身 overflow-y:auto)整体滚动——不裁切字段。
   padding-bottom=键盘高让滚到底时最后一个字段也能停在键盘上沿。
   resize 模式(手机浏览器) inset=0, 100vh 已被系统压缩, 形态两端一致 */
.modal-mask.kb-tall { padding: 0 16px var(--kb-inset, 0px); align-items: flex-start; }
.modal-mask.kb-tall .modal-box { margin: 40px auto 0; }
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
input[type="date"], input[type="month"] { cursor: pointer; }

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
  background: var(--brand-grad); color: #fff;
  font-size: 24px; cursor: pointer; box-shadow: 0 6px 18px rgba(124,58,237,.4);
  transition: transform .15s ease, box-shadow .15s ease;
  touch-action: none;
}
.strat-fab:hover { transform: translateY(-2px); box-shadow: 0 10px 22px rgba(124,58,237,.5); }
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
  padding: 10px 14px; background: var(--brand-grad);
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
.strat-view a { color: var(--brand); text-decoration: none; }
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
    top: auto !important; bottom: calc(8px + var(--kb-inset, 0px)) !important;
    width: auto !important; height: 75vh !important;
    /* 键盘弹起(--kb-inset): 面板随底边上抬, max-height 同步压缩, 标题栏不飞出屏顶 */
    max-height: calc(100vh - 16px - var(--kb-inset, 0px)); min-width: 0; min-height: 0;
    resize: none; border-radius: 14px;
  }
  .strat-head { cursor: default; padding: 12px 14px; }
  .strat-title { font-size: 15px; }
  .strat-actions .btn.sm { padding: 6px 12px; font-size: 13px; }
  .strat-close { font-size: 24px; padding: 0 6px; }
  .strat-body { padding: 12px 14px; }
  .strat-fab { right: 16px; bottom: 16px; width: 48px; height: 48px; font-size: 22px; }
  /* 浏览器(有底部 Tab)抬到 Tab 之上; App 壳无 .m-tabbar 保持 16px 原位 */
  body:has(.m-tabbar) .strat-fab { bottom: calc(78px + env(safe-area-inset-bottom, 0px)); }
  body:has(.m-tabbar) .strat-panel {
    bottom: calc(78px + var(--kb-inset, 0px)) !important;
    max-height: calc(100vh - 92px - var(--kb-inset, 0px));
  }
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
/* 圆形勾选框: 视觉 22px, ::before 透明热区扩到约 44px(手机最高频操作防误触);
   伪元素事件 target 仍是 button, assets.js 行点击/长按的 closest('.todo-check') 守卫自洽,
   故不可加 pointer-events:none */
.todo-check {
  flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%;
  border: 2px solid var(--check-ring); background: var(--surface); cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; position: relative;
  transition: background .18s, border-color .18s; padding: 0;
}
.todo-check::before {
  content: ''; position: absolute; top: 50%; left: 50%;
  width: 44px; height: 44px; transform: translate(-50%, -50%);
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
.todo-chip.due svg { width: 12px; height: 12px; }
.todo-chip.due.overdue { background: var(--danger-bg); color: var(--danger); font-weight: 600; }
.todo-chip.due.today { background: var(--brand-grad); color: #fff; font-weight: 700; }
/* "今天"统一浅紫语言(柔和但保留今日特殊感): 面包屑主任务日期 / 眼睛详情弹窗 /
   完整树与详情子树(根行+子任务行) / 卡片列表根卡仍保留深紫渐变作为扫视重点 */
.todo-crumb .todo-chip.due.today,
.td-sub .todo-chip.due.today,
.todo-tree .todo-chip.due.today,
.td-chip.td-chip--today { background: var(--brand-tint); color: var(--brand-strong); font-weight: 600; }
/* 完整树(非详情视图)根行"今天"保持深紫渐变白字, 与卡片视图根卡一致; 子任务行仍为浅紫 */
body:not(.todo-detail) .todo-tree .todo-row.is-root .todo-chip.due.today {
  background: var(--brand-grad); color: #fff; font-weight: 700;
}
/* 弹窗顶部日期 chip 本体是描边中性样式, 浅紫态换品牌浅紫边 */
.td-chip.td-chip--today { border-color: var(--brand-border); }
/* 暗色下根级深紫在浅紫底上对比不足, 换用主题亮紫(dark 未定义 --brand-strong, 会回退根值) */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .todo-crumb .todo-chip.due.today,
  :root:not([data-theme="light"]) .td-sub .todo-chip.due.today,
  :root:not([data-theme="light"]) .todo-tree .todo-chip.due.today,
  :root:not([data-theme="light"]) .td-chip.td-chip--today,
  :root:not([data-theme="light"]) .todo-chip.repeat { color: var(--brand); }
}
[data-theme="dark"] .todo-crumb .todo-chip.due.today,
[data-theme="dark"] .td-sub .todo-chip.due.today,
[data-theme="dark"] .todo-tree .todo-chip.due.today,
[data-theme="dark"] .td-chip.td-chip--today,
[data-theme="dark"] .todo-chip.repeat { color: var(--brand); }
.todo-crumb .todo-chip { flex: none; }
.todo-chip.due.soon { background: var(--warn-bg); color: var(--warn); font-weight: 600; }
.todo-chip.due.future { background: var(--surface-2); color: var(--link-dim); }
.todo-chip.due .due-days { opacity: .72; font-weight: 500; }
.todo-chip.done-at { background: var(--ok-bg); color: var(--ok); }
.todo-chip.repeat { background: var(--brand-tint); color: var(--brand-strong); font-weight: 600; }
/* child_due「子任务各自设置截止日期」模式标识 —— 鼠尾草绿低唤醒语言(浅底深字细边, 无渐变白字块):
   主任务(根)=浅绿底贴(卡片右上角贴/树行尾贴/面包屑/详情信息行); 中间层子分组=透明底描边胶囊 */
.todo-cd-ribbon {
  position: absolute; top: 0; right: 0; display: inline-flex; align-items: center; gap: 3px;
  background: var(--cd-bg); color: var(--cd-fg);
  border-left: 1px solid var(--cd-border); border-bottom: 1px solid var(--cd-border);
  font-size: 10.5px; font-weight: 600;
  padding: 3px 9px 4px 10px; border-bottom-left-radius: 10px;
}
.todo-cd-ribbon svg { width: 11px; height: 11px; display: block; }
/* 卡片标识下移到 3px 优先级顶带下方，避免遮盖优先级色带 */
.todo-card .todo-cd-ribbon { top: 3px; }
/* 角贴避让标题, 防长标题钻到角贴下 */
.todo-card.cd-on .todo-card__head { padding-right: 88px; }
/* 根行尾/面包屑/详情行内贴 */
.todo-cd-tag {
  flex: none; align-self: center; display: inline-flex; align-items: center; gap: 3px;
  background: var(--cd-bg); color: var(--cd-fg); border: 1px solid var(--cd-border);
  font-size: 10.5px; font-weight: 600;
  padding: 1px 7px; border-radius: 6px; line-height: 1.6;
}
.todo-cd-tag svg { width: 10px; height: 10px; display: block; }
/* 中间层子分组: 透明底描边胶囊(比根贴再弱一级), 置于该行 meta 最前 */
.todo-chip.cd-sub {
  display: inline-flex; align-items: center; gap: 3px;
  background: transparent; color: var(--cd-fg); border: 1px solid var(--cd-border); font-weight: 600;
}
.todo-chip.cd-sub svg { width: 11px; height: 11px; display: block; }
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
/* ============ 手风琴视图（accordion：Things 风留白行，无行间分隔线，悬停浮现操作组） ============ */
.todo-acc__row {
  position: relative; display: flex; align-items: center; gap: 9px;
  padding: 7px 10px; border-radius: 9px; border-bottom: 1px solid var(--th-border);
  transition: background .13s;
}
.todo-acc__row:hover { background: var(--hover-bg); }
.todo-acc__caret {
  flex: none; width: 18px; height: 20px; padding: 0; border: 0; background: transparent;
  color: var(--faint); cursor: pointer; border-radius: 5px;
  display: inline-flex; align-items: center; justify-content: center;
  transition: color .15s, background .13s;
}
.todo-acc__caret svg { width: 12px; height: 12px; display: block; transition: transform .2s cubic-bezier(.4,0,.2,1); }
.todo-acc__caret:hover { color: var(--brand); background: var(--brand-tint); }
.todo-acc__caret.leaf { cursor: default; font-size: 10px; }
.todo-acc__caret.leaf:hover { color: var(--faint); background: transparent; }
/* 状态圆点编码优先级（同 .todo-dot 配色） */
.todo-acc__dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--brand); }
.todo-acc__dot.pri-2 { background: #e5484d; }
.todo-acc__dot.pri-1 { background: #e8a317; }
.todo-acc__dot.pri-0 { background: #b4bccb; }
.todo-acc__name {
  flex: 1; min-width: 0; font-size: 14px; font-weight: 600; color: var(--text-strong);
  word-break: break-word; cursor: pointer;
}
.todo-acc__name:hover { color: var(--brand); }
/* 顶层主任务：更大更粗 + 圆点略大，与中间层分组行区分（中间层=14px/600） */
.todo-acc__row--root { padding-top: 9px; padding-bottom: 8px; }
.todo-acc__row--root .todo-acc__name { font-size: 15px; font-weight: 700; }
.todo-acc__row--root .todo-acc__dot { width: 9px; height: 9px; }
/* 「各自截止」标识小图标（child_due） */
.todo-acc__cdmark {
  flex: none; width: 16px; height: 16px; color: var(--muted-2);
  display: inline-flex; align-items: center; justify-content: center;
}
.todo-acc__cdmark svg { width: 15px; height: 15px; display: block; }
.todo-acc__cdmark:hover { color: var(--brand); }
.todo-acc__repeat { flex: none; font-size: 11px; line-height: 1; }
.todo-acc__date { flex: none; font-size: 11.5px; color: var(--muted-2); font-variant-numeric: tabular-nums; }
.todo-acc__date.od { color: var(--danger); font-weight: 600; }
.todo-acc__kids { padding-left: 22px; }
/* 叶子行：标题自然换行 */
.todo-acc__leafrow {
  display: flex; align-items: flex-start; gap: 9px; padding: 6px 10px;
  border-radius: 9px; border-bottom: 1px solid var(--th-border); transition: background .13s;
}
.todo-acc__leafrow:hover { background: var(--hover-bg); }
.todo-acc__leafrow .todo-check { margin-top: 1px; }
.todo-acc__leafname {
  flex: 1; min-width: 0; font-size: 13.5px; color: var(--text);
  word-break: break-word; cursor: pointer; align-self: center;
}
.todo-acc__leafname:hover { color: var(--brand); }
.todo-acc__leafrow.done .todo-acc__leafname { color: var(--muted); text-decoration: line-through; }
.todo-acc__leafrow .todo-chip.due { align-self: center; }
/* 桌面：操作组绝对定位贴右（不占流，标题空间最大化），平时透明，悬停行才浮现 */
@media (min-width: 641px) {
  .todo-acc .todo-ops {
    position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
    background: var(--surface); padding: 2px; border-radius: 9px;
    box-shadow: 0 2px 12px rgba(16,24,40,.10);
  }
}
.todo-acc .todo-ops { opacity: 0; }
.todo-acc__leafrow .todo-ops { align-self: center; }
.todo-acc__row:hover .todo-ops,
.todo-acc__leafrow:hover .todo-ops { opacity: 1; }
/* 桌面悬停：右侧日期让位淡出，避免与浮起的操作组重叠（手机日期保留） */
@media (min-width: 641px) {
  .todo-acc__row:hover .todo-chip.due,
  .todo-acc__leafrow:hover .todo-chip.due { opacity: 0; }
}
/* 拖拽浮起（对齐老树 .todo-node.dragging > .todo-row） */
.todo-node.dragging > .todo-acc__row,
.todo-node.dragging > .todo-acc__leafrow {
  border-radius: 10px; border-bottom-color: transparent;
  box-shadow: 0 22px 44px rgba(31,35,41,.26), 0 8px 18px rgba(168,85,247,.26), 0 0 0 2px rgba(168,85,247,.28);
}
/* 折叠态：箭头旋转 + 子树隐藏 */
.todo-acc__caret.is-collapsed svg { transform: rotate(-90deg); }
.todo-acc__kids.collapsed { display: none; }
/* 手机「⋯」弹层打开时抬层（行 class 由 todoOpMenuToggle 添加） */
.todo-node:has(> .todo-acc__row.op-menu-open),
.todo-node:has(> .todo-acc__leafrow.op-menu-open) { position: relative; z-index: 200; }
.todo-acc__row.op-menu-open, .todo-acc__leafrow.op-menu-open { z-index: 210; }
@media (max-width: 640px) {
  .todo-acc__kids { padding-left: 14px; }
  /* 手机：操作组只留「⋯」，与老树 .todo-tree 同口径 */
  body .todo-acc .todo-ops { opacity: 1; gap: 0; }
  body .todo-acc .todo-ops .todo-op:not(.todo-more) { display: none; }
  body .todo-acc .todo-op.todo-more { display: inline-flex; }
  /* 添加子任务只走⋯菜单：隐藏分组底部常驻占位行（editing 展开的编辑器不受影响，照常显示） */
  body .todo-acc .todo-detail-adder .todo-detail-adder__placeholder,
  body .todo-tree .todo-detail-adder .todo-detail-adder__placeholder { display: none; }
}
/* ============ 速览视图（flat-view：叶子拍平 + 祖先面包屑，与桌面小组件同源） ============ */
.flat-group { position: relative; padding: 8px 0 2px; }
.flat-group__head {
  position: relative; display: flex; align-items: center; gap: 8px;
  padding: 4px 10px; border-radius: 9px;
  border-bottom: 1px solid var(--th-border);
  transition: background .13s;
}
.flat-group__head:hover { background: var(--hover-bg); }
.flat-group__title { font-size: 15px; font-weight: 700; color: var(--text-strong); cursor: pointer; }
.flat-group__title:hover { color: var(--brand); }
.flat-group__count { font-size: 12px; color: var(--muted-2); font-variant-numeric: tabular-nums; }
.flat-group__repeat { font-size: 11px; line-height: 1; }
/* 「各自截止」标识（child_due），样式与手风琴 .todo-acc__cdmark 一致 */
.flat-group__cdmark {
  flex: none; width: 16px; height: 16px; color: var(--muted-2);
  display: inline-flex; align-items: center; justify-content: center;
}
.flat-group__cdmark svg { width: 15px; height: 15px; display: block; }
.flat-group__cdmark:hover { color: var(--brand); }
/* 叶子行：勾选圆 + 文本列（面包屑/标题）+ 日期 */
.flat-item {
  position: relative; display: flex; align-items: flex-start; gap: 9px;
  padding: 6px 10px; border-radius: 9px;
  transition: background .13s;
}
.flat-item:hover { background: var(--hover-bg); }
.flat-item .todo-check { margin-top: 1px; }
.flat-text { flex: 1; min-width: 0; }
.flat-crumb {
  font-size: 11.5px; color: var(--faint); line-height: 1.35; margin-bottom: 1px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.flat-title { font-size: 13.5px; color: var(--text); word-break: break-word; cursor: pointer; }
.flat-title:hover { color: var(--brand); }
.flat-item.done .flat-title { color: var(--muted-2); text-decoration: line-through; }
.flat-item .todo-chip.due { align-self: center; }
/* 操作组：平时透明，悬停行才浮现 */
.flat-group .todo-ops, .flat-item .todo-ops { opacity: 0; transition: opacity .13s; }
.flat-item .todo-ops { align-self: center; }
.flat-group__head:hover .todo-ops, .flat-item:hover .todo-ops { opacity: 1; }
/* 桌面：操作组绝对定位贴右浮起（不占流）；悬停时日期让位淡出（手机日期保留） */
@media (min-width: 641px) {
  .flat-group .todo-ops, .flat-item .todo-ops {
    position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
    background: var(--surface); padding: 2px; border-radius: 9px;
    box-shadow: 0 2px 12px rgba(16,24,40,.10);
  }
  .flat-group__head:hover .todo-chip.due,
  .flat-item:hover .todo-chip.due { opacity: 0; }
}
/* 手机「⋯」弹层打开时抬层（class 由 todoOpMenuToggle 添加） */
.todo-node:has(> .flat-group__head.op-menu-open),
.flat-item.op-menu-open { position: relative; z-index: 200; }
.flat-group__head.op-menu-open { z-index: 210; }
@media (max-width: 640px) {
  /* 操作组只留「⋯」 */
  body .flat-group .todo-ops, body .flat-item .todo-ops { opacity: 1; gap: 0; }
  body .flat-group .todo-op:not(.todo-more),
  body .flat-item .todo-op:not(.todo-more) { display: none; }
  body .flat-group .todo-op.todo-more,
  body .flat-item .todo-op.todo-more { display: inline-flex; }
  body .flat-item, body .flat-group__head { padding-left: 8px; padding-right: 8px; }
  /* 组间距收紧；添加子任务走 ⋯ 菜单：手机端整个收起组底 adder（编辑器无入口，不会被打开） */
  body .flat-group { padding: 5px 0 1px; }
  body .flat-group .todo-detail-adder { display: none; }
}
/* 概览统计条 */
.todo-stats { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 4px; }
.todo-stat { flex: 1; min-width: 90px; background: var(--surface-3); border-radius: 10px; padding: 12px 14px; text-align: center; }
.todo-stat .n { font-size: 24px; font-weight: 700; color: var(--brand); }
.todo-stat.overdue .n { color: var(--danger); }
.todo-stat.done .n { color: var(--ok); }
.todo-stat .l { font-size: 12px; color: var(--muted-2); margin-top: 2px; }
/* 标题支持换行长文本；备注次级灰字 */
.todo-title { white-space: pre-wrap; }
.todo-note { font-size: 13px; color: var(--muted-2); margin-top: 4px; white-space: pre-wrap; line-height: 1.5; }
/* 备注单行截断（完整树/详情子任务同卡片口径），全文进任务详情查看 */
.todo-note--clip { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* Markdown 备注渲染（任务详情/编辑器预览） */
.md-body { font-size: 14px; line-height: 1.7; color: var(--text); word-break: break-word; }
.md-body > *:first-child { margin-top: 0; }
.md-body > *:last-child { margin-bottom: 0; }
.md-body p { margin: 6px 0; }
.md-body h1, .md-body h2, .md-body h3 { margin: 12px 0 6px; line-height: 1.35; color: var(--text-strong); }
.md-body h1 { font-size: 19px; } .md-body h2 { font-size: 17px; } .md-body h3 { font-size: 15.5px; }
.md-body ul, .md-body ol { margin: 6px 0; padding-left: 22px; }
.md-body li { margin: 3px 0; }
.md-body ul.md-tasks { list-style: none; padding-left: 2px; }
.md-body li.md-task { display: flex; align-items: flex-start; gap: 8px; }
.md-body .tk { width: 16px; height: 16px; border-radius: 4px; border: 1.5px solid var(--border-strong); flex: none; margin-top: 4px; display: grid; place-items: center; font-size: 10px; color: #fff; }
.md-body .tk.on { background: var(--ok); border-color: var(--ok); }
.md-body li.done > *:last-child { color: var(--faint); text-decoration: line-through; }
.md-body blockquote { border-left: 3px solid var(--brand); background: var(--brand-tint); border-radius: 0 8px 8px 0; padding: 6px 12px; margin: 8px 0; color: var(--text); }
.md-body code { font-family: ui-monospace, Consolas, monospace; font-size: .88em; background: var(--code-bg); border-radius: 4px; padding: 1px 5px; }
.md-body pre { background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; overflow-x: auto; margin: 8px 0; }
.md-body pre code { background: transparent; padding: 0; }
.md-body a { color: var(--brand); }
.md-body img { max-width: 100%; border-radius: 8px; border: 1px solid var(--border); margin: 8px 0; display: block; }
.md-body hr { border: 0; border-top: 1px solid var(--border); margin: 12px 0; }
.md-body table { border-collapse: collapse; margin: 8px 0; display: block; overflow-x: auto; }
.md-body th, .md-body td { border: 1px solid var(--border); padding: 5px 10px; font-size: 13px; }
/* md 图片与附件缩略图可点击（手机端走灯箱而非新标签） */
.md-body img, .td-att-img { cursor: zoom-in; }
/* 图片灯箱：层级高于 modal(10000)，黑底居中，点击任意处关闭 */
.img-lightbox { display: none; position: fixed; inset: 0; z-index: 20000; background: rgba(0,0,0,.88); padding: 24px; align-items: center; justify-content: center; }
/* touch-action:none：灯箱打开期间双指手势全部交给图片缩放，不允许缩放/滚动整个页面 */
.img-lightbox.show { display: flex; touch-action: none; }
.img-lightbox .img-lb-pic { max-width: 100%; max-height: 100%; border-radius: 8px; box-shadow: 0 10px 50px rgba(0,0,0,.5); transform-origin: center center; will-change: transform; user-select: none; -webkit-user-drag: none; }
.img-lightbox .img-lb-x { position: absolute; top: 14px; right: 22px; color: #fff; font-size: 32px; line-height: 1; opacity: .8; cursor: pointer; }
/* 附件存储页手机端全选：桌面端用表头 checkbox，此标签仅窄屏显示 */
.fm-mobile-sel { display: none; align-items: center; gap: 6px; font-size: 13px; color: var(--label); }
/* 任务详情弹窗 */
#tdEditBtn { float: right; margin: 2px 0 8px 10px; }
#tdEditBtn svg { width: 13px; height: 13px; vertical-align: -2px; margin-right: 3px; }
.td-title { font-size: 17px; font-weight: 700; color: var(--text-strong); margin-bottom: 10px; padding-right: 8px; }
.td-meta { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
.td-chip { font-size: 12px; border: 1px solid var(--border); background: var(--surface-2); color: var(--label); border-radius: 999px; padding: 3px 10px; display: inline-flex; align-items: center; gap: 4px; }
.td-chip svg { width: 12px; height: 12px; }
/* 任务详情弹窗: 第一子层级预览(普通主任务)/最近到期(child_due 主任务) */
.td-subs { margin: 4px 0 2px; }
.td-subs__head { font-size: 12.5px; font-weight: 700; color: var(--muted); margin: 0 2px 7px; }
.td-subs__head span { font-weight: 500; }
.td-sub { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 11px; }
.td-sub:hover { background: var(--surface-2); }
.td-sub__t { flex: 1; min-width: 0; font-size: 13.5px; color: var(--text); white-space: normal; overflow: visible; text-overflow: clip; word-break: break-word; }
.td-sub .todo-check { width: 19px; height: 19px; border-width: 1.7px; }
.td-sub .todo-check.readonly { cursor: default; }
.td-sub .todo-check.readonly:hover { border-color: var(--check-ring); }
.td-sub--next, .td-sub--next:hover { background: var(--surface-2); }
.td-sub--next.is-over, .td-sub--next.is-over:hover { background: var(--danger-bg); }
.td-sub--next.is-today, .td-sub--next.is-today:hover { background: var(--brand-tint); }
.td-sub-empty { font-size: 13px; color: var(--muted); padding: 4px 2px; }
.td-att-title { font-size: 13px; font-weight: 600; color: var(--label); margin: 18px 0 8px; }
.td-att-list { display: flex; flex-direction: column; gap: 8px; }
a.td-att { display: flex; align-items: center; gap: 10px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 8px 11px; text-decoration: none; color: var(--text); }
.td-att-img { width: 44px; height: 44px; object-fit: cover; border-radius: 8px; flex: none; border: 1px solid var(--border); }
.td-att-ph { width: 44px; height: 44px; border-radius: 8px; background: var(--brand-tint); color: var(--brand); display: grid; place-items: center; flex: none; }
.td-att-ph svg { width: 18px; height: 18px; }
.td-att-nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.td-att-sz { font-size: 11.5px; }
/* Markdown 编辑器（形态 A：写/预览） */
.mde { border: 1px solid var(--border-strong); border-radius: 10px; overflow: hidden; background: var(--surface); }
.mde-seg { display: flex; gap: 3px; padding: 5px; background: var(--surface-2); border-bottom: 1px solid var(--border); }
.mde-seg button { flex: 1; border: 0; background: transparent; color: var(--label); font-size: 13px; padding: 6px 0; border-radius: 7px; cursor: pointer; font-family: inherit; }
.mde-seg button.on { background: var(--surface); color: var(--text-strong); font-weight: 600; box-shadow: 0 1px 3px rgba(20,20,40,.1); }
.mde-bar { display: flex; gap: 4px; align-items: center; padding: 7px 9px; border-bottom: 1px solid var(--border); overflow-x: auto; }
.mde-btn { width: 32px; height: 30px; flex: none; border: 1px solid var(--border); border-radius: 7px; background: var(--surface); color: var(--label); display: grid; place-items: center; cursor: pointer; font-size: 13px; }
.mde-btn:active { background: var(--brand-tint); border-color: var(--brand-border); }
.mde-sep { width: 1px; height: 18px; background: var(--border); margin: 0 3px; flex: none; }
.mde-write, .mde-preview { display: none; }
.mde[data-mode="write"] .mde-write { display: block; }
.mde[data-mode="preview"] .mde-preview { display: block; }
.mde-text { width: 100%; border: 0; outline: none; resize: vertical; padding: 10px 12px; font-family: ui-monospace, Consolas, monospace; font-size: 13px; line-height: 1.7; background: var(--surface); color: var(--text); min-height: 150px; max-height: 46vh; overflow-y: auto; touch-action: pan-y; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
.mde-preview { padding: 10px 12px; min-height: 150px; max-height: 46vh; overflow-y: auto; background: var(--surface); touch-action: pan-y; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
.mde-chips { display: flex; gap: 7px; flex-wrap: wrap; padding: 8px 10px; border-top: 1px solid var(--border); }
.mde-chips:empty { display: none; padding: 0; }
.mde-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 999px; padding: 3px 10px 3px 6px; color: var(--label); max-width: 100%; }
.mde-chip img { width: 18px; height: 18px; border-radius: 50%; object-fit: cover; }
.mde-chip-nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mde-chip-ok { color: var(--ok); }
.mde-chip-st { color: var(--muted); }
/* PC 大弹窗：左右分栏，写/预览分段隐藏；选择器需压过 [data-mode] 的单栏显隐规则 */
@media (min-width: 640px) {
  .modal-mask--lg .mde-panes { display: grid; grid-template-columns: 1fr 1fr; }
  .modal-mask--lg .mde[data-mode] .mde-write,
  .modal-mask--lg .mde[data-mode] .mde-preview { display: block; }
  .modal-mask--lg .mde-seg { display: none; }
  .modal-mask--lg .mde-write { border-right: 1px solid var(--border); }
  .modal-mask--lg .mde-text, .modal-mask--lg .mde-preview { min-height: 230px; }
}
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

/* ============ 区间判断（报告视图：待办分析/基金/体重共用） ============ */
/* 图多解读少：各模块曲线图下方统一的「当前值 vs 区间均值」判断卡，基准=当前所选区间的平均值 */
.jn { margin-top: 20px; padding-top: 18px; border-top: 1px dashed var(--border); }
.jn-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.jn-head h3 { font-size: 15px; font-weight: 700; color: var(--text-strong); }
.jn-head .jn-sub { font-size: 12px; color: var(--muted); margin-top: 2px; }
/* 成员切换 chip（体重多成员） */
.jn-members { display: inline-flex; flex-wrap: wrap; gap: 6px; }
.jn-members button { border: 1px solid var(--border); background: var(--surface); color: var(--muted);
  font-size: 13px; font-weight: 600; padding: 6px 14px; min-height: 34px; border-radius: 999px; cursor: pointer; font-family: inherit;
  -webkit-tap-highlight-color: transparent; transition: border-color .15s, background .15s, color .15s; }
.jn-members button.on { background: var(--brand-tint); border-color: var(--brand-border); color: var(--brand-strong); }
/* hero：当前值 − 区间均值 */
.jn-hero { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin: 12px 0 4px; }
.jn-hero__num { font-size: 32px; font-weight: 850; line-height: 1.2; color: var(--text-strong);
  font-variant-numeric: tabular-nums; letter-spacing: -.01em; }
.jn-hero__num small { font-size: 13px; font-weight: 500; color: var(--muted); margin-left: 4px; }
.jn-hero__calc { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
/* 一句话判断：状态底 + 状态点（不使用 color-mix，兼容微信 X5） */
.jn-note { display: flex; gap: 9px; align-items: flex-start; border-radius: 10px; padding: 10px 13px; margin-top: 10px;
  font-size: 13.5px; line-height: 1.75; background: var(--surface-2); border: 1px solid var(--border); }
.jn-note::before { content: ''; flex: none; width: 8px; height: 8px; border-radius: 50%; margin-top: 7px; background: var(--brand); }
.jn-note.good { background: var(--ok-bg); }
.jn-note.good::before { background: var(--ok); }
.jn-note.bad { background: var(--danger-bg); }
.jn-note.bad::before { background: var(--danger); }
.jn-note.flat::before { background: var(--faint); }
/* 周期对比三格 */
.jn-deltas { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
.jn-delta { background: var(--surface-3); border-radius: 10px; padding: 10px 12px; min-width: 0; }
.jn-delta__l { font-size: 12px; color: var(--muted); }
.jn-delta__v { font-size: 17px; font-weight: 700; color: var(--text-strong); margin-top: 2px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
.jn-delta__v .ar { font-size: 12px; font-weight: 700; margin-right: 2px; }
.jn-delta__v.is-up { color: var(--ok); }
.jn-delta__v.is-down { color: var(--danger); }
.jn-delta__v.is-money-pos { color: var(--danger); }   /* 基金红涨 */
.jn-delta__v.is-money-neg { color: var(--ok); }       /* 基金绿跌 */
.jn-delta__s { font-size: 11px; color: var(--muted); margin-top: 2px; line-height: 1.5; }
.jn-delta.is-off { opacity: .6; }
.jn-delta.is-off .jn-delta__v { color: var(--faint); font-size: 13.5px; font-weight: 600; padding: 2px 0; }
/* 基准指标行（与 .asset-metric 同语言） */
.jn-metrics { display: grid; gap: 9px; margin-top: 14px; }
.jn-metric { display: flex; justify-content: space-between; gap: 12px; padding-bottom: 9px;
  border-bottom: 1px solid var(--th-border); font-size: 13.5px; }
.jn-metric:last-child { padding-bottom: 0; border-bottom: 0; }
.jn-metric span { color: var(--muted); }
.jn-metric b { text-align: right; color: var(--text-strong); font-weight: 600; font-variant-numeric: tabular-nums; }
/* 基准行：橙色虚线段落标识（与曲线图均值线同色，沿用资产页 #f97316） */
.jn-metric--base span { color: var(--text); font-weight: 600; }
.jn-metric--base span::before { content: ''; display: inline-block; width: 14px; border-top: 2px dashed #f97316;
  margin-right: 7px; vertical-align: 3px; }
/* 曲线图图例：数据线 + 均值基准线 */
/* clear:both 防御 h2 内 float:right 控件（select/button）高度伸出标题区，把 BFC 容器挤窄 */
.jn-chart-legend { display: flex; gap: 16px; flex-wrap: wrap; clear: both; font-size: 12px; color: var(--muted); margin: 2px 0 8px; }
.jn-chart-legend .lg { display: inline-flex; align-items: center; gap: 6px; }
.jn-chart-legend i { display: inline-block; width: 18px; height: 0; border-top: 2.5px solid #667eea; border-radius: 2px; }
.jn-chart-legend i.avg { border-top: 2px dashed #f97316; }
.jn-chart-legend b { color: var(--text); font-weight: 600; font-variant-numeric: tabular-nums; }
@media (max-width: 640px) {
  .jn-head { flex-direction: column; align-items: stretch; gap: 10px; }
  .jn-members { width: 100%; }
  .jn-members button { flex: 1 1 auto; padding: 8px 10px; }
  .jn-hero__num { font-size: 28px; }
  .jn-hero__calc { flex: 1 1 100%; }
  /* 周期对比：三张卡片 → 三行（与基准指标同一语言，窄屏数字永不截断） */
  .jn-deltas { grid-template-columns: 1fr; gap: 0; margin-top: 12px; }
  .jn-delta { display: grid; grid-template-columns: minmax(0,1fr) auto;
    grid-template-areas: "l v" "s v"; align-items: center; gap: 1px 12px;
    background: none; border-radius: 0; padding: 10px 0; border-bottom: 1px solid var(--th-border); }
  .jn-delta:last-child { border-bottom: 0; }
  .jn-delta__l { grid-area: l; margin-top: 0; }
  .jn-delta__v { grid-area: v; margin-top: 0; font-size: 15px; white-space: normal; text-align: right; }
  .jn-delta__s { grid-area: s; margin-top: 1px; }
  .jn-delta.is-off .jn-delta__v { font-size: 13px; }
  .jn-metric { font-size: 13px; }
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
  position: relative; background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
  overflow: hidden; transition: box-shadow .18s, border-color .18s;
  cursor: default;
}
.todo-card.clickable { cursor: pointer; }
.todo-card.clickable:hover { box-shadow: 0 6px 20px rgba(124,58,237,.12); border-color: var(--brand-border); }
/* 优先级顶带 3px: 高=红 / 中=琥珀 / 无=中性灰（新色值与圆点/小组件一致） */
.todo-card__band { height: 3px; background: #C9CCD6; }
.todo-card.pri-2 .todo-card__band { background: #E0453E; }
.todo-card.pri-1 .todo-card__band { background: #E5A113; }
.todo-card.pri-0 .todo-card__band { background: #C9CCD6; }
.todo-card.is-done { opacity: .78; background: var(--surface-done); }
.todo-card__body { padding: 12px 14px 9px; }
.todo-card__head { display: flex; align-items: flex-start; gap: 11px; }
.todo-card__title {
  flex: 1; min-width: 0; font-size: 16px; font-weight: 700; color: var(--text);
  line-height: 1.42; word-break: break-word;
}
.todo-card.is-done .todo-card__title { color: var(--faint); text-decoration: line-through; }
.todo-card__check {
  flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%;
  border: 2px solid var(--check-ring); background: var(--surface); cursor: pointer; padding: 0;
  display: flex; align-items: center; justify-content: center; position: relative;
  transition: border-color .18s, background .18s;
}
.todo-card__check::before {
  content: ''; position: absolute; top: 50%; left: 50%;
  width: 44px; height: 44px; transform: translate(-50%, -50%);
}
.todo-card__check:hover { border-color: var(--brand); }
.todo-card__check.done { background: linear-gradient(135deg, #52c41a, #34b34a); border-color: #34b34a; }
.todo-card__check::after { content: '✓'; color: #fff; font-size: 14px; font-weight: 700; opacity: 0; transform: scale(.4); transition: .18s; }
.todo-card__check.done::after { opacity: 1; transform: scale(1); }
.todo-card__meta { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; align-items: center; }
.todo-card__note { margin-top: 6px; font-size: 13px; color: var(--muted-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* 底部操作条：入口位置保持不变, 视觉收紧到 42px 高, 图标钮 36px 触控 */
.todo-card__foot {
  display: flex; align-items: center; justify-content: space-between;
  padding: 5px 8px 5px 6px; background: var(--surface-done); border-top: 1px solid var(--border);
}
.todo-card__ops { display: flex; gap: 1px; }
.todo-card__ops .todo-op { font-size: 16px; padding: 0; width: 38px; height: 36px; }
.todo-card__ops .todo-op svg { width: 18px; height: 18px; }
.todo-card__enter { color: var(--brand); font-size: 13px; font-weight: 700; user-select: none; padding: 7px 8px; border-radius: 9px; }
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
/* 详情页底部常驻"+ 添加子任务"占位行: 点击就地展开为紫边小卡片(在内容流中, 非悬浮) */
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
/* "添加到：xxx"面包屑: 行内卡片(.todo-inline-add)与主任务底部卡片(.todo-detail-adder)共用 */
.todo-add-crumb {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  font-size: 12.5px; color: var(--muted-2);
}
.todo-add-crumb b { color: var(--brand); font-weight: 600; max-width: 56%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.todo-add-crumb__reset {
  margin-left: auto; flex-shrink: 0; cursor: pointer;
  border: 1px solid var(--border-strong); background: var(--surface); color: var(--muted-2);
  border-radius: 999px; font-size: 12px; padding: 1px 10px; line-height: 1.7;
}
.todo-add-crumb__reset:hover { border-color: var(--brand); color: var(--brand); }
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
body.todo-fs-on .app-side,
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
/* 手风琴视图：行无白底，主区铺白避免整页露出 body 暖白 --bg 显黄（手机大面积尤其明显） */
.todo-fs-main.fs-main--acc { background: var(--surface); }
.todo-fs-top {
  display: flex; align-items: center; gap: 10px; margin-bottom: 10px;
  padding: 8px 10px; border: 1px solid var(--border); border-radius: 12px;
  background: var(--surface);
  transition: transform .22s ease, opacity .22s ease;
}
.todo-fs-title { flex: 1; min-width: 0; font-size: 16px; font-weight: 800; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center; }
/* 全屏顶栏一行: 目录 / 视图切换 / 隐藏已完成 / 退出（公开页在目录后多一个 ＋ 图标钮） */
.todo-fs-hide { display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; color: var(--label); font-weight: normal; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
.todo-fs-hide input[type="checkbox"] { width: auto; margin: 0; accent-color: var(--brand); }
.fs-iconbtn {
  width: 38px; height: 38px; flex-shrink: 0; padding: 0;
  border: 1px solid var(--border); border-radius: 11px;
  background: var(--surface); color: var(--label);
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
}
.fs-iconbtn svg { width: 18px; height: 18px; }
.fs-segbtn {
  height: 36px; padding: 0 12px; flex-shrink: 0; flex: 1; min-width: 0;
  border: 1px solid var(--border); border-radius: 10px;
  background: var(--surface-2); color: var(--label);
  font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; white-space: nowrap; gap: 3px;
}
.fs-segbtn svg { width: 15px; height: 15px; }
/* 当前视图小指示：淡色小图标，点击弹小浮窗给视图名（PC/手机通用，浮层高 z-index 不被列表压住） */
.fs-viewcur { flex: none; position: relative; display: inline-flex; align-items: center; color: var(--faint); opacity: .6; line-height: 1; cursor: pointer; transition: opacity .13s, color .13s; }
.fs-viewcur:hover { opacity: 1; color: var(--muted-2); }
.fs-viewcur svg { width: 14px; height: 14px; display: block; }
.fs-viewcur-pop {
  position: absolute; top: calc(100% + 6px); right: 0; z-index: 20;
  padding: 5px 9px; border: 1px solid var(--border); border-radius: 8px;
  background: var(--surface); color: var(--text);
  font-size: 12px; font-weight: 600; line-height: 1.4; white-space: nowrap;
  box-shadow: 0 4px 14px rgba(0,0,0,.15); pointer-events: none;
  opacity: 0; visibility: hidden; transform: translateY(-2px);
  transition: opacity .15s, transform .15s, visibility .15s;
}
.fs-viewcur-pop.show { opacity: 1; visibility: visible; transform: translateY(0); }
.fs-exitbtn {
  height: 36px; padding: 0 12px; flex-shrink: 0;
  border: 1px solid var(--danger); border-radius: 10px;
  background: var(--surface); color: var(--danger);
  font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
}

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
  .app-side__logo { animation: none; }
}

/* ============ reduced-motion 覆盖 ============ */
@media (prefers-reduced-motion: reduce) {
  .card, .stat, .btn, .m-tabbar, .m-fab { transition: none; }
  .btn::after { display: none; }
  #globalLoading .spinner::before,
  #globalLoading .spinner::after { animation: none; }
}


/* ============ 移动端适配 (<=640px) ============ */
@media (max-width: 640px) {
  /* 旧顶栏已由 .app-side(隐藏)/.m-tabbar 取代, 无 topbar 移动样式 */
  .container { margin: 14px auto; padding: 0 12px; }
  body:has(.m-tabbar) .container { padding-bottom: 80px; }
  .card { padding: 15px; }
  /* 小按钮保持自然高度(与 PC 一致), 避免标题行内被撑成大方块; 需要大触控热区的场景(如待办内联添加钮)各自补 min-height */
  .btn.sm { display: inline-flex; align-items: center; }
  /* 待办筛选/图表区间 8 个胶囊: 单行横滑不换行, 项目不缩减; JS 筛选语义不变 */
  .todo-range { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; display: flex; }
  .todo-range::-webkit-scrollbar { display: none; }
  .todo-range button { flex-shrink: 0; }
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
  .asset-summary-stats, .asset-goal-metrics, .asset-type-pills { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .asset-summary-stats .num { font-size: 20px; }
  .asset-status-number { font-size: 28px; }
  .asset-stat-sub { min-height: 0; }
  .asset-title__btn { float: right; margin-top: 0; }
  .asset-grid--84, .asset-grid--75 { grid-template-columns: 1fr; }
  .asset-composition { grid-template-columns: 1fr; }
  .asset-donut { width: 190px; height: 190px; }
  .asset-chart { height: 240px; max-height: 240px; }
  .asset-table th, .asset-table td { white-space: normal; }
  .asset-metric { font-size: 13px; }
  /* 表头窄屏隐藏后，全选改在工具栏显示 */
  .fm-mobile-sel { display: inline-flex; }
  /* 空态单元格窄屏 flex 布局下保持居中（默认 space-between 会把无 data-label 的文本顶到左侧） */
  table td.cell-empty { justify-content: center; text-align: center; }
  /* 登录/加仓等居中容器留边距 */
  .login-wrap { margin: 40px auto; padding: 0 12px; }
  /* 窄屏下拉菜单左对齐, modal 内边距收小 */
  .dropdown-menu { right: auto; left: 0; }
  .modal-mask { padding: 16px 10px; }
  /* 键盘弹起·长弹窗: 弹窗靠顶部, 遮罩整体滚动、卡片不裁切(见 .modal-mask.kb-tall 主规则) */
  .modal-mask.kb-tall { padding: 0 10px var(--kb-inset, 0px); }
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
  .mp-item { padding: 12px 6px; font-size: 15px; justify-content: center; background: var(--surface-3); }
  .mp-item input { width: 18px; height: 18px; }
  /* "完成"按钮: 铺满底部, 品牌色 */
  .mp-done {
    display: block; grid-column: 1 / -1;
    margin-top: 8px; padding: 12px; font-size: 15px; font-weight: 600;
    color: #fff; background: var(--brand-grad);
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
  /* 待办树：缩进收窄, 操作按钮常显 */
  .todo-row { margin-left: calc(var(--depth, 0) * 16px); gap: 8px; padding: 8px 10px; }
  .todo-node[data-depth]:not([data-depth="0"]) > .todo-row::before { left: calc(var(--depth, 0) * 16px - 9px); width: 8px; }
  .todo-ops { opacity: 1; }
  /* 行内操作钮热区从约 28px 补到约 38px */
  .todo-op { padding: 9px 10px; }
  /* 手机端拖拽手柄隐藏: 改为长按整行拖拽(见 todoBindDrag), 操作区少一个小按钮防误触 */
  .todo-drag { display: none !important; }
  /* 长按拖起时手机上"浮起"更强: 放大更多 + 倾斜 + 大投影, 明确区别于普通按压 */
  .todo-node.dragging > .todo-row {
    transform: scale(1.045) rotate(-.8deg);
    box-shadow: 0 22px 44px rgba(31,35,41,.26), 0 8px 18px rgba(168,85,247,.26), 0 0 0 2px rgba(168,85,247,.28);
  }
  /* 概览统计卡强制单行: 4 卡(含备忘录)不再掉到第二行; 去掉最小宽度并收紧字号/内边距 */
  .todo-stats { flex-wrap: nowrap; gap: 6px; }
  .todo-stat { min-width: 0; flex: 1 1 0; padding: 10px 4px; }
  .todo-stat .n { font-size: 20px; }
  .todo-stat .l { font-size: 11px; }
  /* 卡片视图窄屏收小内边距 */
  .todo-card__body { padding: 12px 14px 8px; }
  .todo-card__title { font-size: 16px; }
  .todo-card__foot { padding: 5px 8px; }
  /* 详情面包屑: 窄屏允许换行, 标题独占一行避免按钮把它挤没; 按钮成对紧凑排列 */
  .todo-crumb { flex-wrap: wrap; gap: 8px; padding: 8px 10px; }
  .todo-crumb__title { flex: 1 0 100%; order: -1; font-size: 15px; white-space: normal; overflow: visible; text-overflow: clip; line-height: 1.35; }
  .todo-crumb .btn.sm { padding: 5px 10px; font-size: 12px; }
  /* 全屏模式下, 抽屉浮层覆盖: 从左侧滑入, 半透明遮罩 */
  .todo-fullscreen { flex-direction: row; }
  .todo-drawer {
    /* App 壳(无 .m-tabbar, 原生底栏已裁掉 WebView 高度)贴底; 浏览器才给网页底栏让位 */
    position: fixed; top: 0; left: 0; bottom: 0; z-index: 1001;
    transform: translateX(-100%);
    box-shadow: 2px 0 20px rgba(0,0,0,.15);
  }
  body:has(.m-tabbar) .todo-drawer { bottom: 60px; }
  .todo-drawer.closed { display: flex; transform: translateX(-100%); }
  .todo-drawer.open { transform: translateX(0); }
  .todo-drawer-mask {
    display: none; position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,.35);
  }
  body.todo-fs-on .todo-drawer-mask.show { display: block; }
  /* 手机端全屏顶栏 sticky + 滚动方向隐藏/显示; PC 端不生效 */
  /* 把 fs-main 的 padding-top 移到 fs-top 自身, 让 sticky 到 top:0 时无空隙;
     底部给常驻 Tab(60px)留位, 键盘弹起时随 --kb-inset 上抬 */
  /* 底部统一留 74px: 浏览器给网页底栏(60px)、App 壳给悬浮 FAB(bottom20+54)让位;
     键盘弹起由 kb-on 规则收紧为 12px + 键盘高度(底栏/FAB 此时已隐藏) */
  .todo-fs-main { padding: 0 12px calc(74px + var(--kb-inset, 0px)); }
  .todo-fs-top {
    position: sticky; top: 0; z-index: 5;
    padding-top: 12px; margin-left: -12px; margin-right: -12px;
    padding-left: 12px; padding-right: 12px;
    /* 手机贴边全宽：去掉 PC 的圆角外框 */
    border: none; border-radius: 0; padding-bottom: 10px;
    border-bottom: 1px solid var(--border);
  }
  .todo-fs-top--hidden { transform: translateY(-110%); opacity: 0; pointer-events: none; }
}

/* ============ 每日勉励卡（用户私有；全屏弹层，自有配色不跟随面板主题） ============
   两种风格：a=极光能量（默认，深色潮流）/ c=手账打气（暖色便签治愈）。
   DOM 仅在用户已填写 motto 时直出；.is-on 控制当天自动展示，设置页可用 __mottoPreview() 手动唤出。
   层级 10300：高于 modal(10000)，低于 #globalLoading(10500)，开场加载遮罩退后自然显现。 */
.motto-overlay {
  display: none; position: fixed; inset: 0; z-index: 10300; overflow: hidden;
  flex-direction: column;
  opacity: 0; transition: opacity .3s ease;
}
.motto-overlay.is-on { display: flex; opacity: 1; }
.motto-overlay.is-closing { opacity: 0; }
.motto-quote { white-space: pre-wrap; word-break: break-word; font-weight: 800; line-height: 1.62; }
.motto-x {
  position: absolute; top: 16px; right: 16px; z-index: 10;
  width: 34px; height: 34px; border-radius: 50%; border: 0; cursor: pointer;
  font-size: 13px; display: flex; align-items: center; justify-content: center;
  transition: transform .15s ease, background .15s ease;
}
.motto-x:hover { transform: rotate(90deg); }

/* —— A 极光能量 —— */
.motto-overlay.is-a { background: #0A0A13; color: #F4F5FF; padding: 30px 28px; }
.motto-a__aurora { position: absolute; inset: -20%; z-index: 0; filter: blur(70px); }
.motto-a__aurora span { position: absolute; border-radius: 50%; mix-blend-mode: screen; }
.motto-a__aurora span:nth-child(1) { width: 52%; aspect-ratio: 1; left: -8%; top: -14%;
  background: radial-gradient(circle, #8B5CF6, transparent 65%); animation: mottoDrift 14s ease-in-out infinite alternate; }
.motto-a__aurora span:nth-child(2) { width: 46%; aspect-ratio: 1; right: -10%; top: 8%;
  background: radial-gradient(circle, #22D3EE, transparent 65%); opacity: .7;
  animation: mottoDrift 18s ease-in-out -6s infinite alternate; }
.motto-a__aurora span:nth-child(3) { width: 56%; aspect-ratio: 1; left: 18%; bottom: -26%;
  background: radial-gradient(circle, #EC4899, transparent 62%); opacity: .55;
  animation: mottoDrift 16s ease-in-out -3s infinite alternate; }
@keyframes mottoDrift { from { transform: translate3d(-3%,-2%,0) scale(1); }
  to { transform: translate3d(4%,5%,0) scale(1.12); } }
.motto-a__veil { position: absolute; inset: 0; z-index: 1; pointer-events: none;
  background: radial-gradient(120% 90% at 50% 0%, transparent 40%, rgba(8,8,16,.55) 100%); }
.motto-overlay.is-a .motto-x { background: rgba(255,255,255,.08); color: rgba(255,255,255,.75); }
.motto-overlay.is-a .motto-x:hover { background: rgba(255,255,255,.18); }
.motto-a__top { position: relative; z-index: 2; display: flex; align-items: center; gap: 11px; }
.motto-a__badge { font-size: 10.5px; font-weight: 800; letter-spacing: .22em; text-indent: .22em;
  border: 1px solid rgba(255,255,255,.25); border-radius: 99px; padding: 4px 11px; color: #CFCBFF; }
.motto-a__date { font-size: 11.5px; color: rgba(255,255,255,.5); font-variant-numeric: tabular-nums; }
.motto-a__mid { position: relative; z-index: 2; flex: 1; display: flex; flex-direction: column; justify-content: center; }
.motto-overlay.is-a .motto-quote { text-shadow: 0 2px 30px rgba(139,92,246,.35); }
.motto-a__cta { position: relative; z-index: 2; align-self: flex-start;
  display: inline-flex; align-items: center; gap: 9px;
  background: #fff; color: #12121C; border: 0; border-radius: 99px;
  font: inherit; font-size: 14px; font-weight: 700; padding: 13px 26px; cursor: pointer;
  box-shadow: 0 10px 30px rgba(139,92,246,.35); transition: transform .15s ease; }
.motto-a__cta:hover { transform: translateY(-2px); }
.motto-a__cta svg { width: 15px; height: 15px; }
.motto-a__again { position: relative; z-index: 2; margin-top: 13px; font-size: 11px; color: rgba(255,255,255,.4); }
.motto-overlay.is-a .motto-quote[data-len="s"] { font-size: 34px; }
.motto-overlay.is-a .motto-quote[data-len="m"] { font-size: 27px; }
.motto-overlay.is-a .motto-quote[data-len="l"] { font-size: 21px; }

/* —— C 手账打气 —— */
.motto-overlay.is-c { background: #F0E7D2; color: #4A4030; padding: 34px 26px;
  align-items: center; justify-content: center; }
.motto-overlay.is-c .motto-x { background: rgba(74,64,48,.08); color: #7C705A; }
.motto-overlay.is-c .motto-x:hover { background: rgba(74,64,48,.18); }
.motto-c__tape { position: absolute; z-index: 6; width: 92px; height: 27px; opacity: .72;
  box-shadow: 0 1px 3px rgba(90,70,30,.18); }
.motto-c__tape.t1 { top: 26px; left: 50%; margin-left: -70px; transform: rotate(-5deg);
  background: repeating-linear-gradient(-45deg, rgba(159,201,232,.9) 0 7px, rgba(140,186,220,.9) 7px 14px); }
.motto-c__tape.t2 { top: 44px; right: 34px; width: 66px; transform: rotate(9deg);
  background: repeating-linear-gradient(-45deg, rgba(242,181,200,.9) 0 7px, rgba(232,158,186,.9) 7px 14px); }
.motto-c__sticker { position: absolute; z-index: 1; }
.motto-c__sticker.s1 { left: 30px; bottom: 120px; width: 26px; color: #E8A24B; transform: rotate(-14deg); }
.motto-c__sticker.s2 { right: 34px; top: 110px; width: 21px; color: #E06B8A; transform: rotate(16deg); }
.motto-c__sticker.s3 { left: 44px; top: 120px; width: 19px; color: #6FA8DC; transform: rotate(10deg); }
.motto-c__note { position: relative; z-index: 5; width: 100%; max-width: 330px;
  background: #FFFDF3; border: 1px solid #EADFC0; border-radius: 8px;
  padding: 30px 24px 24px; transform: rotate(-1.4deg);
  box-shadow: 0 22px 44px rgba(110,84,40,.22), 0 3px 8px rgba(110,84,40,.12);
  background-image: repeating-linear-gradient(transparent 0 33px, rgba(120,100,60,.08) 33px 34px); }
.motto-c__head { display: flex; align-items: center; justify-content: center; gap: 7px;
  font-family: "Yuanti SC", "YouYuan", "幼圆", "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 15px; color: #8A7350; margin-bottom: 12px; }
.motto-c__head svg { width: 20px; height: 20px; color: #E8A24B; }
.motto-overlay.is-c .motto-quote {
  font-family: "Yuanti SC", "YouYuan", "幼圆", "PingFang SC", "Microsoft YaHei", sans-serif;
  line-height: 1.75; color: #453B28; text-align: center; }
.motto-overlay.is-c .motto-quote[data-len="s"] { font-size: 27px; }
.motto-overlay.is-c .motto-quote[data-len="m"] { font-size: 23px; }
.motto-overlay.is-c .motto-quote[data-len="l"] { font-size: 19px; }
.motto-c__wave { display: block; margin: 10px auto 0; width: 110px; color: #E06B8A; }
.motto-c__cta { position: relative; z-index: 5; margin-top: 26px;
  background: #3F3626; color: #FFFDF3; border: 0; border-radius: 99px;
  font-family: "Yuanti SC", "YouYuan", "幼圆", "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 16px; letter-spacing: .06em; padding: 11px 32px; cursor: pointer;
  box-shadow: 0 8px 20px rgba(70,55,30,.28); transition: transform .15s ease; }
.motto-c__cta:hover { transform: translateY(-2px) rotate(-.5deg); }

/* —— 入场动画：.is-on 时各元素错峰浮入 —— */
.motto-overlay.is-on [data-rise] { animation: mottoRise .7s cubic-bezier(.22,.8,.26,1) both; }
@keyframes mottoRise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
.motto-overlay.is-c.is-on .motto-c__note { animation: mottoPop .75s cubic-bezier(.2,1.4,.36,1) .12s both; }
@keyframes mottoPop { from { opacity: 0; transform: rotate(-4deg) scale(.85) translateY(24px); }
  to { opacity: 1; transform: rotate(-1.4deg) scale(1) translateY(0); } }

/* —— 手机端收紧 —— */
@media (max-width: 640px) {
  .motto-overlay.is-a { padding: 24px 22px; }
  .motto-overlay.is-a .motto-quote[data-len="s"] { font-size: 29px; }
  .motto-overlay.is-a .motto-quote[data-len="m"] { font-size: 23px; }
  .motto-overlay.is-a .motto-quote[data-len="l"] { font-size: 18px; }
  .motto-overlay.is-c .motto-quote[data-len="s"] { font-size: 24px; }
  .motto-overlay.is-c .motto-quote[data-len="m"] { font-size: 20px; }
  .motto-overlay.is-c .motto-quote[data-len="l"] { font-size: 17px; }
  .motto-c__note { padding: 26px 20px 20px; }
}
@media (prefers-reduced-motion: reduce) {
  .motto-overlay, .motto-overlay * { animation: none !important; transition: none !important; }
}

/* —— H1 战书令（黑红粗野，针对意志力薄弱的"狠话叫醒"） —— */
.motto-overlay.is-h1 { background: #0A0A0C; color: #F4F2EE; padding: 30px 28px; }
.motto-h1__hazard { position: absolute; left: 0; right: 0; height: 10px; z-index: 5;
  background: repeating-linear-gradient(-45deg, #E11D2E 0 12px, #0A0A0C 12px 24px); }
.motto-h1__hazard.top { top: 0; }
.motto-h1__hazard.bot { bottom: 0; }
.motto-overlay.is-h1 .motto-x { background: rgba(255,255,255,.07); color: rgba(255,255,255,.75); }
.motto-overlay.is-h1 .motto-x:hover { background: rgba(255,255,255,.16); }
.motto-h1__frame { position: relative; z-index: 6; flex: 1; display: flex; flex-direction: column;
  width: 100%; max-width: 620px; margin-block: 10px; margin-inline: auto;
  border: 2px solid rgba(255,255,255,.85); padding: 24px 22px; }
.motto-h1__frame::before { content: ''; position: absolute; inset: 5px;
  border: 1px solid rgba(225,29,46,.55); pointer-events: none; }
.motto-h1__top { display: flex; justify-content: space-between; align-items: flex-start; }
.motto-h1__writ { font-size: 11px; font-weight: 900; letter-spacing: .3em; color: #E11D2E;
  border: 2px solid #E11D2E; padding: 4px 9px; transform: rotate(-3deg); }
.motto-h1__no { font-size: 11px; color: rgba(255,255,255,.45); font-variant-numeric: tabular-nums; letter-spacing: .1em; }
.motto-h1__mid { flex: 1; display: flex; flex-direction: column; justify-content: center; }
.motto-h1__kick { font-size: 12.5px; font-weight: 800; color: rgba(255,255,255,.55);
  letter-spacing: .14em; margin-bottom: 14px; }
.motto-overlay.is-h1 .motto-quote { text-shadow: 0 0 40px rgba(225,29,46,.35); }
.motto-h1__sign { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 18px; }
.motto-h1__stamp { font-size: 12px; font-weight: 900; color: #E11D2E; border: 2.5px solid #E11D2E;
  padding: 6px 10px; letter-spacing: .22em; transform: rotate(6deg); opacity: .92;
  font-family: "Songti SC", "STSong", "SimSun", serif; }
.motto-h1__date { font-size: 11px; color: rgba(255,255,255,.4); font-variant-numeric: tabular-nums; }
.motto-h1__actions { position: relative; z-index: 10; display: flex; flex-direction: column;
  align-items: center; width: 100%; max-width: 620px; margin-inline: auto; }
.motto-h1__btn { display: inline-flex; align-items: center; gap: 9px;
  background: #E11D2E; color: #fff; border: 0; border-radius: 0;
  font: inherit; font-size: 15px; font-weight: 900; letter-spacing: .08em; padding: 14px 30px; cursor: pointer;
  box-shadow: 7px 7px 0 rgba(225,29,46,.25); transition: transform .12s ease, box-shadow .12s ease; }
.motto-h1__btn:hover { transform: translate(-2px,-2px); box-shadow: 10px 10px 0 rgba(225,29,46,.3); }
.motto-h1__tip { margin-top: 12px; font-size: 11px; letter-spacing: .12em; color: rgba(255,255,255,.38); text-align: center; }
.motto-overlay.is-h1 .motto-quote[data-len="s"] { font-size: 37px; }
.motto-overlay.is-h1 .motto-quote[data-len="m"] { font-size: 28px; }
.motto-overlay.is-h1 .motto-quote[data-len="l"] { font-size: 21px; }
.motto-overlay.is-h1.is-on .motto-quote { animation: mottoSlam .55s cubic-bezier(.16,1,.3,1) .25s both; }
@keyframes mottoSlam { 0% { opacity: 0; transform: translateY(26px) scale(.985); }
  60% { transform: translateY(-3px) scale(1.005); } 100% { opacity: 1; transform: none; } }
.motto-overlay.is-h1.is-on .motto-h1__stamp { animation: mottoH1Stamp .4s cubic-bezier(.2,1.8,.4,1) .9s both; }
@keyframes mottoH1Stamp { 0% { opacity: 0; transform: rotate(24deg) scale(2.4); }
  100% { opacity: .92; transform: rotate(6deg) scale(1); } }

/* —— H2 最后通牒（实时倒计时，针对"再等会儿"型拖延） —— */
.motto-overlay.is-h2 { background: #0E0F14; color: #F2F3F8; padding: 30px 28px;
  background-image: radial-gradient(rgba(255,255,255,.045) 1px, transparent 1px); background-size: 20px 20px; }
.motto-h2__glow { position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(80% 50% at 50% 0%, rgba(225,29,46,.2), transparent 70%); }
.motto-overlay.is-h2 .motto-x { background: rgba(255,255,255,.07); color: rgba(255,255,255,.72); }
.motto-overlay.is-h2 .motto-x:hover { background: rgba(255,255,255,.16); }
.motto-h2__inner { position: relative; z-index: 5; width: 100%; max-width: 620px; margin-inline: auto;
  flex: 1; display: flex; flex-direction: column; }
.motto-h2__warn { display: inline-flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 900;
  letter-spacing: .26em; color: #FF6B6B; }
.motto-h2__dot { width: 8px; height: 8px; border-radius: 50%; background: #FF3B3B;
  animation: mottoPulse 1.4s infinite; }
@keyframes mottoPulse { 0% { box-shadow: 0 0 0 0 rgba(255,59,59,.6); }
  70% { box-shadow: 0 0 0 11px rgba(255,59,59,0); } 100% { box-shadow: 0 0 0 0 rgba(255,59,59,0); } }
.motto-h2__clock { margin: 14px 0 4px; }
.motto-h2__clock .lab { font-size: 12px; color: rgba(255,255,255,.45); letter-spacing: .16em; margin-bottom: 2px; }
.motto-h2__time { font-size: 58px; font-weight: 900; line-height: 1.05; font-variant-numeric: tabular-nums;
  letter-spacing: .01em;
  background: linear-gradient(180deg, #FFF 20%, #FF8A6B 100%); -webkit-background-clip: text;
  background-clip: text; color: transparent; }
.motto-h2__dayleft { font-size: 12.5px; color: rgba(255,255,255,.5); font-variant-numeric: tabular-nums; }
.motto-h2__dayleft b { color: #FF9080; font-weight: 900; }
.motto-h2__rule { height: 1px; background: linear-gradient(90deg, rgba(225,29,46,.7), transparent); margin: 16px 0; }
.motto-h2__mid { flex: 1; display: flex; flex-direction: column; justify-content: center; }
.motto-h2__before { font-size: 12px; font-weight: 800; color: rgba(255,255,255,.45);
  letter-spacing: .2em; margin-bottom: 10px; }
.motto-overlay.is-h2 .motto-quote { line-height: 1.55; }
.motto-h2__btn { display: inline-flex; align-items: center; gap: 9px;
  background: linear-gradient(100deg, #E11D2E, #FF5A2D);
  color: #fff; border: 0; border-radius: 12px; font: inherit; font-size: 15px; font-weight: 900;
  letter-spacing: .08em; padding: 15px 30px; cursor: pointer;
  box-shadow: 0 12px 34px rgba(225,29,46,.35);
  transition: transform .15s ease, filter .15s ease; }
.motto-h2__btn:hover { transform: translateY(-2px); filter: brightness(1.1); }
.motto-h2__tip { margin-top: 11px; font-size: 11px; color: rgba(255,255,255,.36); letter-spacing: .08em; }
.motto-overlay.is-h2 .motto-quote[data-len="s"] { font-size: 33px; }
.motto-overlay.is-h2 .motto-quote[data-len="m"] { font-size: 25px; }
.motto-overlay.is-h2 .motto-quote[data-len="l"] { font-size: 20px; }
.motto-overlay.is-h2.is-on .motto-h2__time { animation: mottoClockIn .8s .15s both; }
@keyframes mottoClockIn { from { opacity: 0; filter: blur(6px); } to { opacity: 1; filter: blur(0); } }

@media (max-width: 640px) {
  .motto-overlay.is-h1 { padding: 24px 20px; }
  .motto-overlay.is-h1 .motto-quote[data-len="s"] { font-size: 29px; }
  .motto-overlay.is-h1 .motto-quote[data-len="m"] { font-size: 23px; }
  .motto-overlay.is-h1 .motto-quote[data-len="l"] { font-size: 18px; }
  .motto-overlay.is-h2 { padding: 24px 20px; }
  .motto-overlay.is-h2 .motto-h2__time { font-size: 44px; }
  .motto-overlay.is-h2 .motto-quote[data-len="s"] { font-size: 27px; }
  .motto-overlay.is-h2 .motto-quote[data-len="m"] { font-size: 21px; }
  .motto-overlay.is-h2 .motto-quote[data-len="l"] { font-size: 17px; }
}

/* —— 座右铭行内标记（用户在设置页工具栏插入；解析见 mottoInlineMd） ——
   **粗** ~~删~~ __下划线__ ~波浪~ ++放大++ [f:y]快乐体[/f]；装饰一律 currentColor 适配四种卡片底 */
@font-face {
  font-family: 'MottoKuaiLe';
  src: url('/s/motto-kuaile.woff2') format('woff2');
  font-display: swap;
  /* 站酷快乐体 OFL，已子集到 GB2312 一级 3755 字 + ASCII/常用标点；缺字自动走 fallback 链 */
}
.motto-quote .mi-b { font-weight: 900; }
.motto-quote .mi-s { text-decoration: line-through currentColor; opacity: .6; }
.motto-quote .mi-u { text-decoration: underline currentColor; text-underline-offset: 4px; text-decoration-thickness: 2px; }
.motto-quote .mi-w { text-decoration: underline wavy currentColor; text-underline-offset: 5px; }
.motto-quote .mi-big { font-size: 1.28em; }
.motto-quote .mi-y { font-family: 'MottoKuaiLe', "Yuanti SC", "YouYuan", "幼圆", "PingFang SC", "Microsoft YaHei", sans-serif; font-weight: 400; }

/* —— 设置页：座右铭工具栏 —— */
.motto-tb { display: flex; gap: 6px; flex-wrap: wrap; margin: 2px 0 8px; }
.motto-tb button { border: 1px solid var(--border-strong); background: var(--surface); color: var(--label);
  border-radius: 7px; font: inherit; font-size: 12px; padding: 3px 11px; cursor: pointer;
  transition: border-color .15s, color .15s; }
.motto-tb button:hover { border-color: var(--brand); color: var(--brand-strong); }
.motto-tb button[data-tag="font"] { color: var(--brand-strong); border-color: var(--brand-border); background: var(--brand-tint); }

/* —— 设置页：每日勉励风格选择缩略卡 —— */
.motto-input {
  width: 100%; border: 1px solid var(--border-strong); border-radius: 8px;
  background: var(--surface); color: var(--text); font: inherit; font-size: 14px;
  padding: 9px 11px; resize: vertical;
}
.motto-input:focus { outline: none; border-color: var(--brand); }
.motto-styles { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 6px; }
.motto-style {
  flex: 1; border: 1.5px solid var(--border-strong); border-radius: 10px; overflow: hidden;
  background: var(--surface); color: var(--text); font: inherit; padding: 0; cursor: pointer;
  text-align: left; transition: border-color .15s ease;
}
.motto-style .ms-prev {
  height: 46px; display: flex; align-items: center; justify-content: center;
  font-size: 12.5px; font-weight: 800; letter-spacing: .04em;
}
.motto-style[data-style="a"] .ms-prev { color: #F4F5FF;
  background:
    radial-gradient(circle at 18% 20%, rgba(139,92,246,.85), transparent 60%),
    radial-gradient(circle at 85% 30%, rgba(34,211,238,.55), transparent 60%),
    radial-gradient(circle at 60% 110%, rgba(236,72,153,.6), transparent 62%), #0A0A13;
}
.motto-style[data-style="c"] .ms-prev { color: #4A4030; background: #F0E7D2;
  font-family: "Yuanti SC", "YouYuan", "幼圆", "PingFang SC", "Microsoft YaHei", sans-serif; }
.motto-style[data-style="h1"] .ms-prev { color: #F4F2EE; background: #0A0A0C; position: relative;
  overflow: hidden; font-weight: 900; letter-spacing: .12em; }
.motto-style[data-style="h1"] .ms-prev::before { content: ''; position: absolute; top: 0; left: 0; right: 0;
  height: 5px; background: repeating-linear-gradient(-45deg, #E11D2E 0 6px, #0A0A0C 6px 12px); }
.motto-style[data-style="h2"] .ms-prev { color: #FF8A6B; background: #0E0F14;
  font-weight: 900; font-variant-numeric: tabular-nums; letter-spacing: .04em; gap: 6px; }
.motto-style[data-style="h2"] .ms-prev::before { content: ''; width: 7px; height: 7px; border-radius: 50%;
  background: #FF3B3B; box-shadow: 0 0 6px #FF3B3B; flex-shrink: 0; }
.motto-style .ms-prev i { display: block; width: 58%; height: 26px; border-radius: 5px; background: #FFFDF3;
  box-shadow: 0 3px 8px rgba(110,84,40,.25); transform: rotate(-1.5deg); }
.motto-style .ms-name { display: block; padding: 7px 10px; font-size: 13px; }
.motto-style .ms-name small { display: block; font-size: 11px; color: var(--muted); font-weight: 400; }
.motto-style.on { border-color: var(--brand); box-shadow: 0 0 0 1px var(--brand); }
`;

/**
 * 每日勉励卡（用户私有座右铭）：全屏弹层，四种风格 a/c/h1/h2。
 * user.motto 非空才输出 DOM；是否自动展示由内联脚本按设备(pc/mobile/app)×频率(daily/every/off)
 * 结合 user.mottoFreq/user.mottoSeen/user.mottoToday 与 sessionStorage 决定。
 * 关闭经 POST /api/auth/motto-seen {device} 按服务端时区记该设备已读；设置页可调 window.__mottoPreview() 手动唤出。
 * @param {Object} user - { motto, mottoStyle, mottoFreq, mottoSeen, mottoToday, appShell, tzOffset }
 * @returns {string}
 */
// 座右铭行内标记解析：先整体 HTML 转义再替换为固定 span（插入内容不含任何用户原文拼进标签，防 XSS）。
// **粗** ~~删~~ __下划线__ ~波浪~ ++放大++ [f:y]快乐体[/f]；~~ 删除线必须先于 ~ 波浪处理。
// 每轮只替换一处、多轮收敛，支持标记互相嵌套（如 **++又粗又大++**）。
function mottoInlineMd(text) {
  const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  let h = escHtml(text);
  const rules = [
    [/\*\*([^*\n]+)\*\*/, '<span class="mi-b">$1</span>'],
    [/~~([^~\n]+)~~/, '<span class="mi-s">$1</span>'],
    [/__([^_\n]+)__/, '<span class="mi-u">$1</span>'],
    [/~([^~\n]+)~/, '<span class="mi-w">$1</span>'],
    [/\+\+([^+\n]+)\+\+/, '<span class="mi-big">$1</span>'],
    [/\[f:y\]([\s\S]+?)\[\/f\]/, '<span class="mi-y">$1</span>']
  ];
  let changed = true;
  let guard = 0;
  while (changed && guard < 30) {
    changed = false;
    for (const [re, rep] of rules) {
      const next = h.replace(re, rep);
      if (next !== h) { h = next; changed = true; }
    }
    guard++;
  }
  return h;
}

function renderMottoCard(user) {
  const motto = user && user.motto;
  if (!motto) return '';
  const style = ['a', 'c', 'h1', 'h2'].includes(user.mottoStyle) ? user.mottoStyle : 'a';
  // 字号分档按去除标记符号后的纯文本长度，避免 ** 等控制符把句子顶到大一档
  const plainLen = Array.from(motto
    .replace(/\*\*|~~|__|\+\+|\[f:y\]|\[\/f\]|~/g, '')
    .trim()).length;

  // 按用户时区(tz_offset)直出今日日期，避免前端时区偏差
  const d = new Date(Date.now() + (Number.isFinite(user.tzOffset) ? user.tzOffset : 8) * 3600 * 1000);
  const wk = '日一二三四五六'[d.getUTCDay()];
  const md = String(d.getUTCMonth() + 1).padStart(2, '0') + ' / ' + String(d.getUTCDate()).padStart(2, '0');
  const dot = `${d.getUTCMonth() + 1}.${d.getUTCDate()} 周${wk}`;
  const iso = `${d.getUTCFullYear()}-${md.replace(' / ', '-')}`;

  const len = plainLen <= 14 ? 's' : (plainLen <= 30 ? 'm' : 'l');
  const quote = `<div class="motto-quote" data-len="${len}">${mottoInlineMd(motto)}</div>`;

  const ICON_ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/></svg>';
  const ICON_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7"/></svg>';
  const ICON_WAVE = '<svg class="motto-c__wave" viewBox="0 0 120 10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M2 6c8-4 14 4 22 0s14 4 22 0 14 4 22 0 14 4 22 0 14 4 26 0"/></svg>';
  const ICON_STAR = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c.6 5.2 2.8 7.4 8 8-5.2.6-7.4 2.8-8 8-.6-5.2-2.8-7.4-8-8 5.2-.6 7.4-2.8 8-8z"/></svg>';
  const ICON_HEART = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.9-10-9.3C.4 8.6 2.3 5 5.7 5c2 0 3.4 1.1 4.3 2.6h4C14.9 6.1 16.3 5 18.3 5c3.4 0 5.3 3.6 3.7 6.7C19.5 16.1 12 21 12 21z"/></svg>';
  const ICON_DOT = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/></svg>';

  let inner;
  if (style === 'a') {
    inner = `<div class="motto-a__aurora" aria-hidden="true"><span></span><span></span><span></span></div>
       <div class="motto-a__veil" aria-hidden="true"></div>
       <button type="button" class="motto-x" data-motto-close aria-label="关闭（今日不再显示）">✕</button>
       <div class="motto-a__top" data-rise style="animation-delay:.05s"><span class="motto-a__badge">DAILY</span><span class="motto-a__date">${md} 周${wk}</span></div>
       <div class="motto-a__mid">
         <div data-rise style="animation-delay:.22s">${quote}</div>
       </div>
       <button type="button" class="motto-a__cta" data-rise style="animation-delay:.5s" data-motto-close>开始今天 ${ICON_ARROW}</button>
       <div class="motto-a__again" data-rise style="animation-delay:.64s">今日仅此一次 · 明天再见</div>`;
  } else if (style === 'c') {
    inner = `<button type="button" class="motto-x" data-motto-close aria-label="关闭（今日不再显示）">✕</button>
       <span class="motto-c__tape t1" aria-hidden="true"></span><span class="motto-c__tape t2" aria-hidden="true"></span>
       <span class="motto-c__sticker s1" aria-hidden="true">${ICON_STAR}</span>
       <span class="motto-c__sticker s2" aria-hidden="true">${ICON_HEART}</span>
       <span class="motto-c__sticker s3" aria-hidden="true">${ICON_DOT}</span>
       <div class="motto-c__note">
         <div class="motto-c__head">${ICON_SUN}<span>${dot} · 今日打气</span></div>
         ${quote}
         ${ICON_WAVE}
       </div>
       <button type="button" class="motto-c__cta" data-motto-close data-rise style="animation-delay:.7s">贴进今天！</button>`;
  } else if (style === 'h1') {
    inner = `<div class="motto-h1__hazard top" aria-hidden="true"></div><div class="motto-h1__hazard bot" aria-hidden="true"></div>
       <button type="button" class="motto-x" data-motto-close aria-label="关闭（今日不再显示）">✕</button>
       <div class="motto-h1__frame">
         <div class="motto-h1__top" data-rise style="animation-delay:.05s">
           <span class="motto-h1__writ">战 书</span>
           <span class="motto-h1__no">NO. ${iso}</span>
         </div>
         <div class="motto-h1__mid">
           <div class="motto-h1__kick" data-rise style="animation-delay:.15s">致 又 想 找 借 口 的 你</div>
           ${quote}
         </div>
         <div class="motto-h1__sign" data-rise style="animation-delay:.75s">
           <span class="motto-h1__stamp">今日必办</span>
           <span class="motto-h1__date">${dot}</span>
         </div>
       </div>
       <div class="motto-h1__actions" data-rise style="animation-delay:.6s">
         <button type="button" class="motto-h1__btn" data-motto-close>干，就现在 ${ICON_ARROW}</button>
         <div class="motto-h1__tip">今日只下一道 · 明天此时再战</div>
       </div>`;
  } else {
    inner = `<div class="motto-h2__glow" aria-hidden="true"></div>
       <button type="button" class="motto-x" data-motto-close aria-label="关闭（今日不再显示）">✕</button>
       <div class="motto-h2__inner">
         <div class="motto-h2__warn" data-rise style="animation-delay:.05s"><span class="motto-h2__dot"></span>最 后 通 牒 · 时 间 在 烧</div>
         <div class="motto-h2__clock" data-rise style="animation-delay:.1s">
           <div class="lab">你的今天还剩</div>
           <div class="motto-h2__time" data-clock>--:--:--</div>
           <div class="motto-h2__dayleft">今年还剩 <b data-days>--</b> 天 · 没一天能重来</div>
         </div>
         <div class="motto-h2__rule"></div>
         <div class="motto-h2__mid">
           <div class="motto-h2__before" data-rise style="animation-delay:.4s">在今天结束之前，记住：</div>
           <div data-rise style="animation-delay:.5s">${quote}</div>
         </div>
         <div data-rise style="animation-delay:.7s">
           <button type="button" class="motto-h2__btn" data-motto-close>现在就去做 ${ICON_ARROW}</button>
           <div class="motto-h2__tip">关掉它不难 · 难的是关掉之后真的去做</div>
         </div>
       </div>`;
  }

  // 弹不弹由前端按「设备 × 频率」决定（视口宽度只有客户端知道）：
  //   app 由服务端头权威判定；浏览器按 <=640px 归 mobile（与底部 Tab 同一断点）
  //   daily: 该设备服务端已读日 != 今日，且本会话未关闭过 → 弹；every: 本会话未弹过 → 弹；off: 不弹
  //   会话态用 sessionStorage 挡住同标签/同 App 进程内的后续页面，daily 持久态由后端按设备独立记录
  const jsJson = o => JSON.stringify(o).replace(/</g, '\\u003c');
  const js = `(function(){
  var ov = document.getElementById('mottoOverlay');
  if (!ov) return;
  var cfg = ${jsJson(user.mottoFreq || {})};
  var seen = ${jsJson(user.mottoSeen || {})};
  var today = ${jsJson(user.mottoToday || '')};
  var device = ${user.appShell ? 'true' : 'false'} ? 'app' : (window.innerWidth <= 640 ? 'mobile' : 'pc');
  var freq = cfg[device] || 'daily';
  var due = false;
  if (freq === 'every') due = sessionStorage.getItem('mottoOpen') !== '1';
  else if (freq === 'daily') due = seen[device] !== today && sessionStorage.getItem('mottoDaily') !== today;
  if (due) {
    ov.classList.add('is-on');
    if (freq === 'every') sessionStorage.setItem('mottoOpen', '1');
    else sessionStorage.setItem('mottoDaily', today);
  }
  var closing = false;
  function closeMotto(){
    if (closing) return; closing = true;
    ov.classList.add('is-closing');
    sessionStorage.setItem('mottoDaily', today);
    try {
      fetch('/api/auth/motto-seen', { method:'POST', keepalive:true, credentials:'same-origin',
        headers:{'Content-Type':'application/json'}, body: JSON.stringify({ device: device }) });
    } catch(e) {}
    setTimeout(function(){ ov.classList.remove('is-on','is-closing'); closing = false; }, 300);
  }
  ov.addEventListener('click', function(e){
    if (e.target === ov || e.target.closest('[data-motto-close]')) closeMotto();
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && ov.classList.contains('is-on')) closeMotto();
  });
  window.__mottoPreview = function(){ ov.classList.add('is-on'); };
${style === 'h2' ? `  // H2 最后通牒：按用户时区(tz_offset)实时倒计时到今天 24:00 与今年剩余天数
  var tz = ${Number.isFinite(user.tzOffset) ? user.tzOffset : 8};
  var clockEl = ov.querySelector('[data-clock]');
  var daysEl = ov.querySelector('[data-days]');
  var pad2 = function(n){ return (n < 10 ? '0' : '') + n; };
  function mottoTick(){
    var nowMs = Date.now();
    var sd = new Date(nowMs + tz * 3600000);
    var midnight = Date.UTC(sd.getUTCFullYear(), sd.getUTCMonth(), sd.getUTCDate() + 1) - tz * 3600000;
    var yearEnd = Date.UTC(sd.getUTCFullYear() + 1, 0, 1) - tz * 3600000;
    var left = Math.max(0, midnight - nowMs);
    if (clockEl) clockEl.textContent = pad2(Math.floor(left / 3600000)) + ':'
      + pad2(Math.floor(left % 3600000 / 60000)) + ':' + pad2(Math.floor(left % 60000 / 1000));
    if (daysEl) daysEl.textContent = Math.ceil((yearEnd - nowMs) / 86400000);
  }
  mottoTick();
  setInterval(mottoTick, 1000);` : ''}
})();`;

  // is-on 由内联脚本按设备/频率决定，服务端不预判
  return `<div class="motto-overlay is-${style}" id="mottoOverlay"
    role="dialog" aria-modal="true" aria-label="每日勉励">${inner}</div>
<script>${js.replace(/<\/script>/g, '<\\/script')}</script>`;
}

/**
 * 渲染顶部导航（登录后页面）
 * @param {Object} user - { username, role }
 * @param {string} active - 当前激活页 key
 * @returns {string}
 */
// ============ 外壳导航图标（24x24, stroke: currentColor，风格统一） ============
const SIDE_ICONS = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>',
  todo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  fund: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
  weight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  asset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>',
  monitor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  channels: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  admin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  storage: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
};

/**
 * 渲染应用外壳（登录后页面）：桌面/平板侧边导航 + 手机底部 Tab
 * @param {Object} user - { username, nickname, role, appShell, quickloginModule, tzOffset }
 * @param {string} active - 当前激活页 key（dashboard/todo/fund/weight/asset/monitor/channels/admin/storage/settings）
 * @returns {string}
 */
function renderTopbar(user, active = '') {
  // 原生 App 壳内（X-App-Shell 头 / app_shell cookie）：导航交给底部原生 Tab, 网页外壳不渲染。
  // 保留超管 impersonate 黄条（重要提示），并收紧内容区顶部留白。
  if (user.appShell) {
    // App 壳: 不渲染侧栏/网页底栏(原生 Tab 提供导航), 但待办页仍渲染悬浮新建钮(全屏态由它代理 #tAddFs)
    const appFab = active === 'todo'
      ? `<button type="button" class="m-fab" aria-label="新建任务">${SIDE_ICONS.plus}</button>`
      : '';
    return `<style>.container{margin-top:0 !important;}</style>` + appFab +
      `<script>document.addEventListener('click',function(e){
  var fab=e.target.closest&&e.target.closest('.m-fab');
  if(fab){var id=document.body.classList.contains('todo-fs-on')?'tAddFs':'tAdd';
    var t=document.getElementById(id);if(t)t.click();}
});<\/script>` +
      (user.impersonating ? `<div class="impersonate-banner">
      ⚠️ 你（超管 ${user.admin_username || ''}）正在以 <b>${user.username}</b> 的身份浏览
      <a href="#" id="stopImpersonateBtn">点此退出</a>
    </div>` : '') +
      renderMottoCard(user);
  }

  // 受限免密会话：导航只保留对应模块，隐藏设置入口（与旧顶栏行为一致）
  const restricted = !!user.quickloginModule;
  const sideGroups = [
    { grp: '概览', items: [
      { key: 'dashboard', href: '/dashboard', text: '仪表盘' }
    ]},
    { grp: '生活', items: [
      { key: 'todo', href: '/todo', text: '待办清单' },
      { key: 'fund', href: '/fund', text: '基金追踪' },
      { key: 'weight', href: '/weight', text: '体重曲线' },
      { key: 'asset', href: '/asset', text: '资产报表' }
    ]},
    { grp: '自动化', items: [
      { key: 'monitor', href: '/monitor', text: '定时任务' },
      { key: 'channels', href: '/channels', text: '通知渠道' }
    ]}
  ];
  if (user.role === 'admin') {
    sideGroups.push({ grp: '管理', items: [
      { key: 'admin', href: '/admin', text: '用户管理' },
      { key: 'storage', href: '/storage', text: '附件存储' }
    ]});
  }
  const groups = restricted
    ? [{ grp: '', items: sideGroups.flatMap(g => g.items).filter(l => l.key === user.quickloginModule) }]
    : sideGroups;

  const sideNavHtml = groups.map(g =>
    (g.grp ? `<div class="app-side__grp">${g.grp}</div>` : '') +
    g.items.map(l =>
      `<a href="${l.href}" class="app-side__item ${active === l.key ? 'active' : ''}">${SIDE_ICONS[l.key] || ''}<span class="as-label">${l.text}</span></a>`
    ).join('')
  ).join('');

  // 手机底部 Tab: 4 个生活模块 + 我的; 受限会话只保留对应模块 + 登出入口
  const tabDefs = [
    { key: 'todo', href: '/todo', text: '待办' },
    { key: 'fund', href: '/fund', text: '基金' },
    { key: 'weight', href: '/weight', text: '体重' },
    { key: 'asset', href: '/asset', text: '资产' },
    { key: 'settings', href: '/settings', text: '我的' }
  ];
  // 「我的」Tab 归属：设置页本身 + 仅能从「我的」功能入口到达的页面（仪表盘/定时任务/渠道/用户管理/存储）
  const MY_TAB_PAGES = { settings: 1, dashboard: 1, monitor: 1, channels: 1, admin: 1, storage: 1 };
  const tabOn = k => (k === 'settings' ? !!MY_TAB_PAGES[active] : active === k);
  const tabHtml = restricted
    ? tabDefs.filter(t => t.key === user.quickloginModule)
        .map(t => `<a href="${t.href}" class="${tabOn(t.key) ? 'on' : ''}">${SIDE_ICONS[t.key]}${t.text}</a>`).join('')
      + `<a href="#" data-logout="1" aria-label="登出">${SIDE_ICONS.logout}登出</a>`
    : tabDefs.map(t =>
        `<a href="${t.href}" class="${tabOn(t.key) ? 'on' : ''}">${SIDE_ICONS[t.key]}${t.text}</a>`
      ).join('');

  const displayName = user.nickname || user.username;
  const fabHtml = active === 'todo'
    ? `<button type="button" class="m-fab" aria-label="新建任务">${SIDE_ICONS.plus}</button>`
    : '';

  return `<aside class="app-side">
    <a class="app-side__brand" href="/dashboard">
      <span class="app-side__logo" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg></span>
      <span class="app-side__name"><b>监控追踪</b><small>定时发送</small></span>
    </a>
    <div class="app-side__clock" id="brandClock" aria-live="off"></div>
    <nav class="app-side__nav">${sideNavHtml}</nav>
    <div class="app-side__foot">
      <button type="button" id="themeToggle" class="app-side__item" title="切换主题（浅色 / 暗色 / 护眼）"><span id="themeToggleIcon" style="display:inline-flex;align-items:center;"></span><span class="as-label" id="themeToggleLabel"></span></button>
      ${restricted ? '' : `<a href="/settings" class="app-side__item ${active === 'settings' ? 'active' : ''}">${SIDE_ICONS.settings}<span class="as-label">设置</span></a>`}
      <a href="#" id="logoutBtn" class="app-side__item">${SIDE_ICONS.logout}<span class="as-label">登出</span></a>
      <div class="app-side__me">
        <span class="app-side__avatar">${displayName.slice(0, 1)}</span>
        <span class="app-side__who"><b>${displayName}</b><span class="tag ${user.role}">${user.role === 'admin' ? '超管' : '用户'}</span></span>
      </div>
    </div>
  </aside>
  <nav class="m-tabbar" aria-label="主导航">${tabHtml}</nav>
  ${fabHtml}` + (user.impersonating ? `<div class="impersonate-banner">
    ⚠️ 你（超管 ${user.admin_username || ''}）正在以 <b>${user.username}</b> 的身份浏览
    <a href="#" id="stopImpersonateBtn">点此退出</a>
  </div>` : '') +
  // 时钟按配置时区(app_settings.tz_offset)显示; FAB/移动登出为视觉代理, 委托到页内真实按钮
  `<script>window.__TZ_OFFSET__=${Number.isFinite(user.tzOffset) ? user.tzOffset : 8};
document.addEventListener('click', function(e){
  var fab = e.target.closest && e.target.closest('.m-fab');
  // 全屏态代理全屏顶栏 #tAddFs, 默认态代理卡片头 #tAdd（App 壳同此逻辑）
  if (fab) {
    var id = document.body.classList.contains('todo-fs-on') ? 'tAddFs' : 'tAdd';
    var t = document.getElementById(id); if (t) t.click();
  }
  var lo = e.target.closest && e.target.closest('[data-logout]');
  if (lo) { var b = document.getElementById('logoutBtn'); if (b) b.click(); }
});</script>` + renderMottoCard(user);
}

export { renderPage, renderTopbar, BASE_CSS, FAVICON_SVG };
