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
    <div id="loadingText" style="margin-top:12px;color:#4a6cf7;font-size:14px;"></div>
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
.topbar .user { font-size: 14px; }
.topbar .user a { margin-left: 12px; }
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
.feat-marquee { max-width: 560px; margin: 0 auto 18px; overflow: hidden; -webkit-mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); }
.feat-track { display: inline-flex; gap: 12px; white-space: nowrap; animation: featScroll 28s linear infinite; }
.feat-marquee:hover .feat-track { animation-play-state: paused; }
.feat-chip { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 999px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; font-size: 13px; box-shadow: 0 2px 6px rgba(102,126,234,.25); }
@keyframes featScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@media (prefers-reduced-motion: reduce) { .feat-track { animation: none; } }
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
#globalLoading .spinner { width: 46px; height: 46px; border: 4px solid #d9d9d9; border-top-color: #4a6cf7; border-radius: 50%; animation: spin .8s linear infinite; }
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

/* ============ 移动端适配 (<=640px) ============ */
@media (max-width: 640px) {
  .topbar { flex-direction: column; align-items: flex-start; gap: 8px; padding: 12px 16px; }
  .topbar h1 { font-size: 16px; }
  .topbar .nav { display: flex; flex-wrap: wrap; gap: 6px 0; }
  .topbar .nav a { margin-left: 0; margin-right: 16px; }
  .topbar .user { font-size: 13px; }
  .topbar .user a { margin-left: 8px; }
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
    { key: 'weight', href: '/weight', text: '体重曲线' }
  ];
  if (user.role === 'admin') links.push({ key: 'admin', href: '/admin', text: '用户管理' });

  const navHtml = links.map(l =>
    `<a href="${l.href}" class="${active === l.key ? 'active' : ''}">${l.text}</a>`
  ).join('');

  return `<div class="topbar">
    <h1>🚀 监控与追踪控制台</h1>
    <div class="nav">${navHtml}</div>
    <div class="user">${user.nickname || user.username} <span class="tag ${user.role}">${user.role === 'admin' ? '超管' : '用户'}</span>
      <a href="/settings">设置</a>
      <a href="#" id="logoutBtn">登出</a>
    </div>
  </div>` + (user.impersonating ? `<div class="impersonate-banner">
    ⚠️ 你（超管 ${user.admin_username || ''}）正在以 <b>${user.username}</b> 的身份浏览
    <a href="#" id="stopImpersonateBtn">点此退出</a>
  </div>` : '');
}

export { renderPage, renderTopbar, BASE_CSS };
