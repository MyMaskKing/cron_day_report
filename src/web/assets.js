/**
 * 前端通用 JS 片段（作为字符串注入页面）
 */

// 通用 API 请求与工具函数（所有页面共用）
const COMMON_JS = `
async function api(path, opts) {
  opts = opts || {};
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin'
  });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) throw new Error(data.message || ('请求失败: ' + res.status));
  return data;
}
function showMsg(el, text, ok) {
  el.className = 'msg ' + (ok ? 'ok' : 'err');
  el.textContent = text;
}
function bindLogout() {
  var btn = document.getElementById('logoutBtn');
  if (btn) btn.addEventListener('click', async function(e) {
    e.preventDefault();
    try { await api('/api/auth/logout', { method: 'POST' }); } catch (err) {}
    location.href = '/login';
  });
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}
`;

// 登录页 JS
const LOGIN_JS = `
${COMMON_JS}
var loginForm = document.getElementById('loginForm');
var regForm = document.getElementById('regForm');
var msg = document.getElementById('msg');
var tabLogin = document.getElementById('tabLogin');
var tabReg = document.getElementById('tabReg');
tabLogin.addEventListener('click', function() {
  tabLogin.className = 'btn'; tabReg.className = 'btn gray';
  loginForm.style.display = 'block'; regForm.style.display = 'none';
});
tabReg.addEventListener('click', function() {
  tabReg.className = 'btn'; tabLogin.className = 'btn gray';
  regForm.style.display = 'block'; loginForm.style.display = 'none';
});
loginForm.addEventListener('submit', async function(e) {
  e.preventDefault();
  try {
    await api('/api/auth/login', { method: 'POST', body: {
      username: document.getElementById('lu').value,
      password: document.getElementById('lp').value
    }});
    location.href = '/dashboard';
  } catch (err) { showMsg(msg, err.message, false); }
});
regForm.addEventListener('submit', async function(e) {
  e.preventDefault();
  try {
    await api('/api/auth/register', { method: 'POST', body: {
      username: document.getElementById('ru').value,
      password: document.getElementById('rp').value
    }});
    showMsg(msg, '注册成功，请登录', true);
    tabLogin.click();
  } catch (err) { showMsg(msg, err.message, false); }
});
`;

// 仪表盘 JS
const DASHBOARD_JS = `
${COMMON_JS}
bindLogout();
(async function() {
  try {
    var me = await api('/api/auth/me');
    document.getElementById('welcome').textContent = '欢迎，' + me.user.username;
  } catch (err) { location.href = '/login'; }
})();
`;

// 初始化超管页 JS
const SETUP_JS = `
${COMMON_JS}
var form = document.getElementById('setupForm');
var msg = document.getElementById('msg');
var tokenField = document.getElementById('tokenField');
(async function() {
  try {
    var st = await api('/api/auth/setup-status');
    if (!st.needSetup) {
      showMsg(msg, '系统已初始化，正在跳转登录...', true);
      setTimeout(function(){ location.href = '/login'; }, 1500);
      form.style.display = 'none';
      return;
    }
    if (st.tokenRequired) tokenField.style.display = 'block';
  } catch (err) { showMsg(msg, err.message, false); }
})();
form.addEventListener('submit', async function(e) {
  e.preventDefault();
  try {
    await api('/api/auth/bootstrap', { method: 'POST', body: {
      username: document.getElementById('su').value,
      password: document.getElementById('sp').value,
      token: document.getElementById('st') ? document.getElementById('st').value : undefined
    }});
    showMsg(msg, '超管创建成功，正在跳转登录...', true);
    setTimeout(function(){ location.href = '/login'; }, 1500);
  } catch (err) { showMsg(msg, err.message, false); }
});
`;

// 超管用户管理 JS
const ADMIN_JS = `
${COMMON_JS}
bindLogout();
var tbody = document.getElementById('userTbody');
var detail = document.getElementById('detail');

async function loadUsers() {
  try {
    var data = await api('/api/admin/users');
    tbody.innerHTML = data.users.map(function(u) {
      return '<tr>' +
        '<td>' + u.id + '</td>' +
        '<td>' + esc(u.username) + '</td>' +
        '<td><span class="tag ' + u.role + '">' + (u.role === 'admin' ? '超管' : '用户') + '</span></td>' +
        '<td><span class="tag ' + u.status + '">' + (u.status === 'active' ? '正常' : '禁用') + '</span></td>' +
        '<td>' + esc(u.created_at) + '</td>' +
        '<td>' +
          '<button class="btn sm" onclick="viewUser(' + u.id + ')">查看</button> ' +
          '<button class="btn sm gray" onclick="toggleRole(' + u.id + ",'" + u.role + "'" + ')">' + (u.role === 'admin' ? '降为用户' : '升为超管') + '</button> ' +
          '<button class="btn sm danger" onclick="toggleStatus(' + u.id + ",'" + u.status + "'" + ')">' + (u.status === 'active' ? '禁用' : '启用') + '</button>' +
        '</td></tr>';
    }).join('');
  } catch (err) { alert(err.message); if (err.message.indexOf('权限') >= 0 || err.message.indexOf('登录') >= 0) location.href = '/login'; }
}
async function viewUser(id) {
  try {
    var d = await api('/api/admin/users/' + id);
    detail.style.display = 'block';
    detail.innerHTML = '<h2>用户 #' + d.user.id + ' · ' + esc(d.user.username) + ' 数据汇总</h2>' +
      '<div class="grid-stats">' +
      '<div class="stat"><div class="num">' + d.summary.monitorCount + '</div><div class="lbl">监控任务</div></div>' +
      '<div class="stat"><div class="num">' + d.summary.channelCount + '</div><div class="lbl">通知渠道</div></div>' +
      '<div class="stat"><div class="num">' + d.summary.fundCount + '</div><div class="lbl">基金持仓</div></div>' +
      '<div class="stat"><div class="num">' + d.summary.memberCount + '</div><div class="lbl">体重成员</div></div>' +
      '</div>';
    detail.scrollIntoView({ behavior: 'smooth' });
  } catch (err) { alert(err.message); }
}
async function toggleRole(id, cur) {
  var role = cur === 'admin' ? 'user' : 'admin';
  if (!confirm('确认修改角色为 ' + role + ' ?')) return;
  try { await api('/api/admin/users/' + id + '/role', { method: 'PUT', body: { role: role } }); loadUsers(); }
  catch (err) { alert(err.message); }
}
async function toggleStatus(id, cur) {
  var status = cur === 'active' ? 'disabled' : 'active';
  if (!confirm('确认修改状态为 ' + status + ' ?')) return;
  try { await api('/api/admin/users/' + id + '/status', { method: 'PUT', body: { status: status } }); loadUsers(); }
  catch (err) { alert(err.message); }
}
window.viewUser = viewUser; window.toggleRole = toggleRole; window.toggleStatus = toggleStatus;
loadUsers();
`;

export { COMMON_JS, LOGIN_JS, DASHBOARD_JS, ADMIN_JS, SETUP_JS };
