/**
 * HTML 页面框架：统一 CSS、导航、页面外壳
 */

/**
 * 渲染完整 HTML 页面
 * @param {Object} opts - { title, body, script }
 * @returns {string}
 */
function renderPage({ title = '控制台', body = '', script = '' }) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>${BASE_CSS}</style>
</head>
<body>
<div id="globalLoading">
  <div style="text-align:center;">
    <div class="spinner"></div>
    <div id="loadingPct" style="display:none;margin-top:12px;color:#4a6cf7;font-size:24px;font-weight:700;line-height:1;"></div>
    <div id="loadingText" style="margin-top:8px;color:#4a6cf7;font-size:14px;"></div>
  </div>
</div>
<div id="modalMask" class="modal-mask">
  <div class="modal-box">
    <div class="modal-head"><span id="modalTitle"></span><span id="modalClose">&times;</span></div>
    <div id="modalBody" class="modal-body"></div>
  </div>
</div>
${body}
<script>${script}</script>
</body>
</html>`;
}

const BASE_CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif; background: #f0f2f5; color: #1f2329; }
a { color: #4a6cf7; text-decoration: none; }
.topbar { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; padding: 14px 24px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 8px rgba(0,0,0,.1); }
.topbar h1 { font-size: 18px; font-weight: 600; }
.topbar .nav a { color: #fff; margin-left: 18px; font-size: 14px; opacity: .9; }
.topbar .nav a:hover, .topbar .nav a.active { opacity: 1; text-decoration: underline; }
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
.impersonate-banner a { color: #cf1322; font-weight: 600; margin-left: 8px; }
.container { max-width: 1000px; margin: 24px auto; padding: 0 16px; }
.card { background: #fff; border-radius: 10px; padding: 20px; margin-bottom: 18px; box-shadow: 0 1px 4px rgba(0,0,0,.06); }
.card h2 { font-size: 16px; margin-bottom: 14px; color: #1f2329; }
.btn { display: inline-block; padding: 8px 16px; border: none; border-radius: 6px; background: #4a6cf7; color: #fff; font-size: 14px; cursor: pointer; transition: .2s; }
.btn:hover { background: #3a5ce4; }
.btn.danger { background: #dc3545; }
.btn.danger:hover { background: #c82333; }
.btn.gray { background: #6c757d; }
.btn.sm { padding: 4px 10px; font-size: 12px; }
input, select, textarea { width: 100%; padding: 9px 12px; border: 1px solid #d9d9d9; border-radius: 6px; font-size: 14px; margin-bottom: 12px; font-family: inherit; }
input:focus, select:focus, textarea:focus { outline: none; border-color: #4a6cf7; }
label { display: block; font-size: 13px; color: #666; margin-bottom: 5px; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #eee; }
th { color: #666; font-weight: 600; background: #fafafa; }
.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
.tag.admin { background: #fff1f0; color: #cf1322; }
.tag.user { background: #e6f7ff; color: #0958d9; }
.tag.active { background: #f6ffed; color: #389e0d; }
.tag.disabled { background: #f5f5f5; color: #999; }
.tag.ok { background: #f6ffed; color: #389e0d; }
.tag.fail { background: #fff1f0; color: #cf1322; }
.login-wrap { max-width: 360px; margin: 80px auto; }
.login-wrap .card { padding: 30px; }
.login-wrap h1 { text-align: center; margin-bottom: 20px; font-size: 22px; color: #4a6cf7; }
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
.lg-panel h2 { font-size: 20px; font-weight: 700; color: #1f2329; margin-bottom: 4px; }
.lg-panel .lg-hint { font-size: 13px; color: #8890b8; margin-bottom: 18px; }
.lg-tabs { display: flex; gap: 8px; margin-bottom: 18px; }
.lg-tabs .btn { flex: 1; }
@media (max-width: 860px) { .lg-fs { justify-content: center; padding: 0 16px; } .lg-brand { display: none; } .lg-field { opacity: .4; } }
@media (prefers-reduced-motion: reduce) { .lg-row { animation: none; } }
.msg { padding: 10px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 14px; display: none; }
.msg.err { background: #fff1f0; color: #cf1322; display: block; }
.msg.ok { background: #f6ffed; color: #389e0d; display: block; }
.row { display: flex; gap: 12px; flex-wrap: wrap; }
.row > * { flex: 1; min-width: 140px; }
.muted { color: #999; font-size: 13px; }
.grid-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 14px; }
.stat { background: #f8f9ff; border-radius: 8px; padding: 16px; text-align: center; }
.stat .num { font-size: 28px; font-weight: 700; color: #4a6cf7; }
.stat .lbl { font-size: 13px; color: #666; margin-top: 4px; }
#globalLoading { display: none; position: fixed; inset: 0; background: rgba(255,255,255,.55); backdrop-filter: blur(1px); z-index: 9999; align-items: center; justify-content: center; }
#globalLoading .spinner { width: 46px; height: 46px; margin: 0 auto; border: 4px solid #d9d9d9; border-top-color: #4a6cf7; border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* 弹窗 modal */
.modal-mask { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 10000; align-items: flex-start; justify-content: center; padding: 40px 16px; overflow-y: auto; }
.modal-mask.show { display: flex; }
.modal-box { background: #fff; border-radius: 10px; width: 100%; max-width: 440px; box-shadow: 0 10px 40px rgba(0,0,0,.2); animation: modalIn .2s ease; }
.modal-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #eee; font-size: 16px; font-weight: 600; }
#modalClose { cursor: pointer; font-size: 24px; line-height: 1; color: #999; }
#modalClose:hover { color: #333; }
.modal-body { padding: 20px; }
@keyframes modalIn { from { transform: translateY(-12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

/* 操作下拉菜单 */
.dropdown { position: relative; display: inline-block; }
.dropdown-menu { display: none; position: absolute; right: 0; top: 100%; background: #fff; border: 1px solid #e6e8f0; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.12); min-width: 120px; z-index: 50; overflow: hidden; }
.dropdown-menu.show { display: block; }
.dropdown-menu button { display: block; width: 100%; text-align: left; padding: 9px 14px; border: none; background: none; font-size: 14px; cursor: pointer; color: #1f2329; }
.dropdown-menu button:hover { background: #f5f7ff; }
.dropdown-menu button.danger { color: #dc3545; }
.multi-pick { position: relative; display: inline-block; width: 100%; }
.mp-btn { width: 100%; text-align: left; padding: 8px 12px; border: 1px solid #d9dbe3; border-radius: 8px; background: #fff; font-size: 14px; cursor: pointer; color: #1f2329; min-height: 38px; }
.mp-menu { display: none; position: absolute; left: 0; top: 100%; margin-top: 4px; background: #fff; border: 1px solid #e6e8f0; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.12); z-index: 60; padding: 6px; max-height: 240px; overflow-y: auto; display: none; }
.mp-menu.show { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px; min-width: 220px; }
.mp-item { display: flex; align-items: center; gap: 4px; padding: 5px 8px; font-size: 13px; cursor: pointer; border-radius: 6px; white-space: nowrap; }
.mp-item:hover { background: #f5f7ff; }
.mp-item input { width: auto; margin: 0; }

/* ============ 待办树（signature） ============ */
/* 层级缩进靠 --depth 变量驱动；每个节点一行，左侧优先级色带 + 圆形勾选框 */
.todo-tree { margin-top: 4px; }
.todo-empty { text-align: center; color: #99a; padding: 40px 12px; font-size: 14px; }
.todo-node { position: relative; }
.todo-row {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 12px; margin: 4px 0;
  background: #fff; border: 1px solid #eef0f5; border-radius: 10px;
  margin-left: calc(var(--depth, 0) * 26px);
  transition: box-shadow .18s, border-color .18s, transform .18s;
}
.todo-row:hover { box-shadow: 0 3px 14px rgba(74,108,247,.10); border-color: #dfe4fb; transform: translateX(1px); }
/* 优先级：标题前一枚小圆点（克制点缀，不占左色带）。红=高 琥珀=中 灰=低 */
.todo-dot { flex-shrink: 0; width: 9px; height: 9px; border-radius: 50%; background: #b4bccb; }
.todo-dot.pri-2 { background: #e5484d; }
.todo-dot.pri-1 { background: #e8a317; }
.todo-dot.pri-0 { background: #b4bccb; }
/* 层级连接线：非顶层节点左侧竖向引导线 */
.todo-node[data-depth]:not([data-depth="0"]) > .todo-row::before {
  content: ''; position: absolute; left: calc(var(--depth, 0) * 26px - 13px); top: -4px; bottom: 50%;
  border-left: 1.5px solid #e3e7f3; border-bottom: 1.5px solid #e3e7f3;
  width: 12px; border-bottom-left-radius: 8px;
}
/* 圆形勾选框 */
.todo-check {
  flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%;
  border: 2px solid #c7ccd6; background: #fff; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  transition: background .18s, border-color .18s; padding: 0;
}
.todo-check:hover { border-color: #4a6cf7; }
.todo-check::after { content: '✓'; color: #fff; font-size: 13px; font-weight: 700; opacity: 0; transform: scale(.4); transition: .18s; }
.todo-check.done { background: linear-gradient(135deg, #52c41a, #34b34a); border-color: #34b34a; }
.todo-check.done::after { opacity: 1; transform: scale(1); }
/* 折叠三角 */
.todo-caret {
  flex-shrink: 0; width: 16px; height: 16px; cursor: pointer; color: #b0b6c8;
  display: inline-flex; align-items: center; justify-content: center; font-size: 11px;
  transition: transform .18s, color .18s; user-select: none;
}
.todo-caret:hover { color: #4a6cf7; }
.todo-caret.collapsed { transform: rotate(-90deg); }
.todo-caret.leaf { visibility: hidden; }
/* 标题与元信息 */
.todo-main { flex: 1; min-width: 0; }
.todo-title { font-size: 14px; color: #1f2329; word-break: break-word; transition: color .2s; }
.todo-row.is-done .todo-title { color: #b0b6c8; text-decoration: line-through; }
.todo-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 3px; }
.todo-chip { font-size: 12px; padding: 1px 8px; border-radius: 999px; line-height: 1.6; }
.todo-chip.cat { background: #eef1ff; color: #4a6cf7; }
.todo-chip.due { background: #f0f5ff; color: #5a6b9a; }
.todo-chip.due.overdue { background: #fff1f0; color: #cf1322; font-weight: 600; }
.todo-chip.done-at { background: #f6ffed; color: #389e0d; }
.todo-chip.repeat { background: #f9f0ff; color: #722ed1; font-weight: 600; }
/* 行内操作按钮：默认淡，hover 行时显现 */
.todo-ops { display: flex; gap: 2px; opacity: .35; transition: opacity .18s; flex-shrink: 0; }
.todo-row:hover .todo-ops { opacity: 1; }
.todo-op { border: none; background: none; cursor: pointer; font-size: 15px; padding: 3px 5px; border-radius: 6px; line-height: 1; }
.todo-op:hover { background: #f0f2f8; }
/* 拖拽手柄：按住即可拖动排序；touch-action:none 抑制移动端触摸滚动争抢 */
.todo-drag { cursor: grab; color: #b0b6c8; font-size: 17px; touch-action: none; }
.todo-drag:active { cursor: grabbing; }
.todo-children.collapsed { display: none; }
/* 顶层任务栏：作为分组头。浅灰底 + 左侧品牌蓝分组条表"这是一组"，与优先级圆点分属不同通道 */
.todo-row.is-root { background: #f7f8fa; border-color: #e9ecf3; border-left: 4px solid #4a6cf7; padding-left: 12px; }
.todo-row.is-root .todo-title { font-weight: 700; font-size: 15px; }
.todo-count { font-size: 12px; color: #8890b8; margin-left: 6px; }
/* 概览统计条 */
.todo-stats { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 4px; }
.todo-stat { flex: 1; min-width: 90px; background: #f8f9ff; border-radius: 10px; padding: 12px 14px; text-align: center; }
.todo-stat .n { font-size: 24px; font-weight: 700; color: #4a6cf7; }
.todo-stat.overdue .n { color: #cf1322; }
.todo-stat.done .n { color: #52c41a; }
.todo-stat .l { font-size: 12px; color: #8890b8; margin-top: 2px; }
/* 标题支持换行长文本；备注次级灰字 */
.todo-title { white-space: pre-wrap; }
.todo-note { font-size: 13px; color: #8890b8; margin-top: 4px; white-space: pre-wrap; line-height: 1.5; }
/* 图表卡片头部 + 区间选择 */
.todo-chart-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.todo-range { display: inline-flex; gap: 4px; flex-wrap: wrap; }
.todo-range button { border: 1px solid #dfe3ee; background: #fff; color: #5a6b9a; font-size: 13px; padding: 5px 12px; border-radius: 999px; cursor: pointer; transition: .15s; }
.todo-range button:hover { border-color: #4a6cf7; color: #4a6cf7; }
.todo-range button.active { background: #4a6cf7; border-color: #4a6cf7; color: #fff; }
/* 筛选 tab：复用 range pill 样式，与列表间留白 */
.todo-filter { margin: 4px 0 12px; }
@media (prefers-reduced-motion: reduce) { .todo-row, .todo-check, .todo-check::after, .todo-caret { transition: none; } }
/* 子任务长按拖拽：拖动中的节点浮起，拖动期间全局禁选中并显示抓取光标 */
.todo-node.dragging { opacity: .92; }
.todo-node.dragging > .todo-row { box-shadow: 0 8px 24px rgba(74,108,247,.28); border-color: #4a6cf7; background: #fff; cursor: grabbing; transform: scale(1.01); }
body.todo-dragging { user-select: none; -webkit-user-select: none; touch-action: none; cursor: grabbing; }
@media (prefers-reduced-motion: reduce) { .todo-node.dragging > .todo-row { transform: none; } }

/* ============ 待办卡片视图 ============ */
/* 卡片网格容器：一列排列，宽屏保持单列（避免顶层任务被切碎） */
.todo-cards { display: flex; flex-direction: column; gap: 12px; margin-top: 4px; }
/* 单张顶层卡片：顶部色带 + 内容区 + 底部操作 */
.todo-card {
  position: relative; background: #fff; border: 1px solid #e9ecf3; border-radius: 12px;
  overflow: hidden; transition: box-shadow .18s, transform .12s, border-color .18s;
  cursor: default;
}
.todo-card.clickable { cursor: pointer; }
.todo-card.clickable:hover { box-shadow: 0 6px 24px rgba(74,108,247,.14); border-color: #dfe4fb; transform: translateY(-1px); }
.todo-card__band { height: 4px; background: #b4bccb; }
.todo-card.pri-2 .todo-card__band { background: #e5484d; }
.todo-card.pri-1 .todo-card__band { background: #e8a317; }
.todo-card.pri-0 .todo-card__band { background: #b4bccb; }
.todo-card.is-done { opacity: .78; background: #fafbff; }
.todo-card__body { padding: 14px 16px 10px; }
.todo-card__head { display: flex; align-items: flex-start; gap: 10px; }
.todo-card__title {
  flex: 1; min-width: 0; font-size: 17px; font-weight: 700; color: #1f2329;
  line-height: 1.45; word-break: break-word;
}
.todo-card.is-done .todo-card__title { color: #b0b6c8; text-decoration: line-through; }
.todo-card__check {
  flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%;
  border: 2px solid #d9d9d9; background: #fff; cursor: pointer; padding: 0;
  display: flex; align-items: center; justify-content: center;
  transition: border-color .18s, background .18s;
}
.todo-card__check:hover { border-color: #4a6cf7; }
.todo-card__check.done { background: linear-gradient(135deg, #52c41a, #34b34a); border-color: #34b34a; }
.todo-card__check::after { content: '✓'; color: #fff; font-size: 14px; font-weight: 700; opacity: 0; transform: scale(.4); transition: .18s; }
.todo-card__check.done::after { opacity: 1; transform: scale(1); }
.todo-card__meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.todo-card__note { margin-top: 6px; font-size: 13px; color: #8890b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.todo-card__foot {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; background: #fafbff; border-top: 1px solid #f0f2f8;
}
.todo-card__ops { display: flex; gap: 2px; }
.todo-card__ops .todo-op { font-size: 16px; padding: 4px 8px; }
.todo-card__enter { color: #4a6cf7; font-size: 13px; font-weight: 600; user-select: none; }
.todo-card__count { background: #eef1ff; color: #4a6cf7; font-weight: 600; }
.todo-card__count.done { background: #f6ffed; color: #389e0d; }

/* ============ 面包屑（子任务详情页顶栏） ============ */
.todo-crumb {
  display: flex; align-items: center; gap: 10px; margin: 4px 0 12px;
  padding: 8px 12px; background: #f7f8fa; border-radius: 8px; border-left: 4px solid #4a6cf7;
}
.todo-crumb__back {
  border: 1px solid #dfe3ee; background: #fff; color: #4a6cf7; cursor: pointer;
  padding: 5px 12px; border-radius: 999px; font-size: 13px;
}
.todo-crumb__back:hover { background: #eef1ff; }
.todo-crumb__title { flex: 1; min-width: 0; font-size: 14px; font-weight: 700; color: #1f2329; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ============ 按钮 busy 状态（点击后立即禁用防重） ============ */
button[data-busy] { opacity: .55; cursor: wait; }
button[data-busy]::after { content: ' …'; }

/* ============ 待办全屏模式（三态循环：default → 卡片全屏 → 完整树全屏） ============ */
/* 全屏容器：默认 display:none, 由 JS 根据 _todoView 决定显隐 */
.todo-fullscreen {
  display: none;
  position: fixed; inset: 0; z-index: 1000;
  background: #f0f2f5;
  flex-direction: row;
}
/* body 加 todo-fs-on 时：隐藏 topbar 与页面所有 .card, 显示全屏容器 */
body.todo-fs-on { overflow: hidden; }
body.todo-fs-on .topbar,
body.todo-fs-on .impersonate-banner { display: none !important; }
body.todo-fs-on .container > .card { display: none !important; }
body.todo-fs-on .todo-fullscreen { display: flex; }

/* 主区域：右侧填满 */
.todo-fs-main {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column;
  padding: 12px 16px 16px;
  overflow-y: auto;
}
/* 主区域顶部一行：抽屉按钮 + 标题 + 视图切换按钮 */
/* transition + 背景色: 为手机端 sticky 时的过渡隐藏做铺垫; PC 无影响 */
.todo-fs-top {
  display: flex; align-items: center; gap: 10px; margin-bottom: 10px;
  padding-bottom: 10px; border-bottom: 1px solid #e9ecf3;
  background: #f0f2f5;
  transition: transform .22s ease, opacity .22s ease;
}
.todo-fs-title { flex: 1; font-size: 16px; font-weight: 700; color: #1f2329; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.todo-fs-hide { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; color: #666; font-weight: normal; cursor: pointer; white-space: nowrap; }
.todo-fs-hide input[type="checkbox"] { width: auto; margin: 0; }

/* ============ 侧边抽屉（分类目录） ============ */
.todo-drawer {
  width: 240px; flex-shrink: 0;
  background: #fff; border-right: 1px solid #e9ecf3;
  display: flex; flex-direction: column;
  transition: transform .22s ease;
}
.todo-drawer__head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 14px 10px; font-size: 14px; font-weight: 700; color: #1f2329;
  border-bottom: 1px solid #f0f2f8;
}
.todo-drawer__close {
  border: none; background: none; cursor: pointer; font-size: 18px; color: #8890b8;
  padding: 2px 6px; border-radius: 6px;
}
.todo-drawer__close:hover { background: #f0f2f8; color: #1f2329; }
.todo-drawer__list { flex: 1; overflow-y: auto; padding: 6px 0; }
.todo-drawer__item {
  display: flex; align-items: center; gap: 8px; padding: 8px 14px;
  cursor: pointer; font-size: 14px; color: #1f2329;
  border-left: 3px solid transparent;
  transition: background .12s, border-color .12s;
}
.todo-drawer__item:hover { background: #f7f8fa; }
.todo-drawer__item.active { background: #eef1ff; border-left-color: #4a6cf7; color: #4a6cf7; font-weight: 600; }
.todo-drawer__label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.todo-drawer__count { color: #8890b8; font-size: 12px; }
.todo-drawer__item.active .todo-drawer__count { color: #4a6cf7; }
.todo-drawer__section { padding: 6px 0; border-bottom: 1px solid #f0f2f8; }
.todo-drawer__section:last-child { border-bottom: none; }
.todo-drawer__section-title { padding: 8px 14px 4px; font-size: 12px; color: #8890b8; font-weight: 600; letter-spacing: .5px; }
.todo-drawer__item--hide { cursor: pointer; }
.todo-drawer__foot { padding: 8px 14px; font-size: 12px; color: #8890b8; border-top: 1px solid #f0f2f8; text-align: center; }
/* 抽屉收起：主区域独占 */
.todo-drawer.closed { display: none; }
/* 抽屉遮罩（仅手机使用） */
.todo-drawer-mask { display: none; }

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
  border: 1px solid #e3e8f0; border-radius: 8px; background: rgba(255,255,255,.92);
  color: #5a6b9a; font-size: 14px; cursor: pointer; opacity: .3; transition: opacity .18s, background .18s;
}
.card:hover .chart-fs-btn { opacity: 1; }
.chart-fs-btn:hover { background: #eef1ff; color: #4a6cf7; }
/* 全屏遮罩层：半透明底 + 居中舞台。横屏(PC/平板)直接放大；竖屏(手机)旋转 90° 铺满 */
.chart-fs-mask { position: fixed; inset: 0; z-index: 9998; background: rgba(0,0,0,.55); overflow: hidden; }
.chart-fs-stage {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  background: #fff; border-radius: 12px; box-shadow: 0 12px 48px rgba(0,0,0,.35);
  padding: 24px; box-sizing: border-box;
}
/* 横屏(PC/宽屏)：大弹窗，取视口九成，不旋转 */
@media (orientation: landscape) {
  .chart-fs-stage { width: 90vw; height: 88vh; }
}
/* 竖屏(手机)：舞台取视口对调后旋转 90°，铺满成横向大图 */
@media (orientation: portrait) {
  .chart-fs-mask { background: #fff; }
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
  border: 1px solid #e3e8f0; border-radius: 50%; background: #fff; color: #5a6b9a;
  font-size: 17px; cursor: pointer; box-shadow: 0 2px 10px rgba(0,0,0,.18);
}
.chart-fs-close:hover { background: #eef1ff; color: #4a6cf7; }
/* 竖屏(手机)：旋转后图的 Y 轴刻度落在物理右上，故关闭钮挪到物理右下角避开 */
@media (orientation: portrait) {
  .chart-fs-close { top: auto; bottom: 14px; right: 14px; }
}
@media (prefers-reduced-motion: reduce) { .chart-fs-btn { transition: none; } }


/* ============ 移动端适配 (<=640px) ============ */
@media (max-width: 640px) {
  .topbar { flex-direction: column; align-items: flex-start; gap: 8px; padding: 12px 16px; }
  .topbar h1 { font-size: 16px; }
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
  table tr { background: #fafbff; border: 1px solid #eee; border-radius: 8px; margin-bottom: 10px; padding: 6px 10px; }
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
  .modal-mask { padding: 20px 10px; }
  /* 待办树：缩进收窄, 操作按钮常显 */
  .todo-row { margin-left: calc(var(--depth, 0) * 16px); gap: 8px; padding: 8px 10px; }
  .todo-node[data-depth]:not([data-depth="0"]) > .todo-row::before { left: calc(var(--depth, 0) * 16px - 9px); width: 8px; }
  .todo-ops { opacity: 1; }
  .todo-stat { min-width: 70px; padding: 10px; }
  /* 卡片视图窄屏收小内边距 */
  .todo-card__body { padding: 12px 14px 8px; }
  .todo-card__title { font-size: 16px; }
  .todo-card__foot { padding: 6px 10px; }
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
  .todo-fs-main { padding: 0 12px 14px; }
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
  const links = [
    { key: 'dashboard', href: '/dashboard', text: '仪表盘' },
    { key: 'monitor', href: '/monitor', text: '定时任务' },
    { key: 'channels', href: '/channels', text: '通知渠道' },
    { key: 'fund', href: '/fund', text: '基金追踪' },
    { key: 'asset', href: '/asset', text: '资产报表' },
    { key: 'weight', href: '/weight', text: '体重曲线' },
    { key: 'todo', href: '/todo', text: '待办' }
  ];
  if (user.role === 'admin') links.push({ key: 'admin', href: '/admin', text: '用户管理' });

  // 受限免密会话：导航只保留对应模块，隐藏设置/登出以外的其他入口
  const restricted = !!user.quickloginModule;
  const shownLinks = restricted ? links.filter(l => l.key === user.quickloginModule) : links;

  const navHtml = shownLinks.map(l =>
    `<a href="${l.href}" class="${active === l.key ? 'active' : ''}">${l.text}</a>`
  ).join('');

  return `<div class="topbar">
    <h1>🚀 监控与追踪控制台</h1>
    <div class="nav">${navHtml}</div>
    <div class="user">${user.nickname || user.username} <span class="tag ${user.role}">${user.role === 'admin' ? '超管' : '用户'}</span>
      ${restricted ? '' : '<a href="/settings" class="act-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>设置</a>'}
      <a href="#" id="logoutBtn" class="act-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>登出</a>
    </div>
  </div>` + (user.impersonating ? `<div class="impersonate-banner">
    ⚠️ 你（超管 ${user.admin_username || ''}）正在以 <b>${user.username}</b> 的身份浏览
    <a href="#" id="stopImpersonateBtn">点此退出</a>
  </div>` : '');
}

export { renderPage, renderTopbar, BASE_CSS };
