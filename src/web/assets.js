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

// 定时任务管理 JS
const MONITOR_JS = `
${COMMON_JS}
bindLogout();
var channels = [];

function channelName(id) {
  if (!id) return '<span class="muted">未设置</span>';
  var c = channels.filter(function(x){ return x.id === id; })[0];
  return c ? esc(c.name) : ('#' + id);
}
function channelOptions(sel) {
  var opts = '<option value="">（不发送通知）</option>';
  channels.forEach(function(c) {
    opts += '<option value="' + c.id + '"' + (c.id === sel ? ' selected' : '') + '>' + esc(c.name) + ' [' + c.type + ']</option>';
  });
  return opts;
}

// ---------- 通知渠道 ----------
async function loadChannels() {
  var data = await api('/api/notify/channels');
  channels = data.channels;
  var tb = document.getElementById('chTbody');
  tb.innerHTML = channels.map(function(c) {
    return '<tr><td>' + esc(c.name) + '</td><td>' + c.type + '</td>' +
      '<td class="muted" style="word-break:break-all;">' + esc(c.url) + '</td>' +
      '<td>' + (c.enabled ? '<span class="tag ok">启用</span>' : '<span class="tag disabled">停用</span>') + '</td>' +
      '<td><button class="btn sm gray" onclick="editCh(' + c.id + ')">编辑</button> ' +
      '<button class="btn sm danger" onclick="delCh(' + c.id + ')">删除</button></td></tr>';
  }).join('') || '<tr><td colspan="5" class="muted">暂无渠道</td></tr>';
}
function chForm(c) {
  c = c || {};
  document.getElementById('chId').value = c.id || '';
  document.getElementById('chName').value = c.name || '';
  document.getElementById('chType').value = c.type || 'wechat';
  document.getElementById('chUrl').value = c.url || '';
  document.getElementById('chMethod').value = c.method || 'POST';
  document.getElementById('chHeaders').value = c.headers_json || '';
  document.getElementById('chBody').value = c.body_template || '';
  document.getElementById('chEnabled').checked = c.enabled !== 0 && c.enabled !== false;
  document.getElementById('chFormWrap').style.display = 'block';
}
window.editCh = function(id){ chForm(channels.filter(function(x){return x.id===id;})[0]); };
window.delCh = async function(id){
  if (!confirm('确认删除该渠道?')) return;
  try { await api('/api/notify/channels/' + id, { method:'DELETE' }); await loadChannels(); await loadTasks(); }
  catch(e){ alert(e.message); }
};
document.getElementById('chSave').addEventListener('click', async function(){
  var id = document.getElementById('chId').value;
  var payload = {
    name: document.getElementById('chName').value,
    type: document.getElementById('chType').value,
    url: document.getElementById('chUrl').value,
    method: document.getElementById('chMethod').value,
    headers_json: document.getElementById('chHeaders').value || null,
    body_template: document.getElementById('chBody').value || null,
    enabled: document.getElementById('chEnabled').checked
  };
  try {
    if (id) await api('/api/notify/channels/' + id, { method:'PUT', body: payload });
    else await api('/api/notify/channels', { method:'POST', body: payload });
    document.getElementById('chFormWrap').style.display = 'none';
    await loadChannels(); await loadTasks();
  } catch(e){ alert(e.message); }
});
document.getElementById('chNew').addEventListener('click', function(){ chForm({}); });
document.getElementById('chCancel').addEventListener('click', function(){ document.getElementById('chFormWrap').style.display='none'; });

// ---------- 监控任务 ----------
async function loadTasks() {
  var data = await api('/api/monitor/tasks');
  var tb = document.getElementById('taskTbody');
  tb.innerHTML = data.tasks.map(function(t) {
    return '<tr><td>' + esc(t.name) + '</td>' +
      '<td class="muted" style="word-break:break-all;">' + esc(t.url) + '</td>' +
      '<td>' + t.return_type + '</td>' +
      '<td>' + channelName(t.channel_id) + '</td>' +
      '<td>' + (t.enabled ? '<span class="tag ok">启用</span>' : '<span class="tag disabled">停用</span>') + '</td>' +
      '<td><button class="btn sm gray" onclick="editTask(' + t.id + ')">编辑</button> ' +
      '<button class="btn sm" onclick="viewLogs(' + t.id + ")," + '"' + esc(t.name).replace(/"/g,'') + '")>日志</button> ' +
      '<button class="btn sm danger" onclick="delTask(' + t.id + ')">删除</button></td></tr>';
  }).join('') || '<tr><td colspan="6" class="muted">暂无任务</td></tr>';
  window._tasks = data.tasks;
}
function taskForm(t) {
  t = t || {};
  document.getElementById('tId').value = t.id || '';
  document.getElementById('tName').value = t.name || '';
  document.getElementById('tUrl').value = t.url || '';
  document.getElementById('tType').value = t.return_type || 'text';
  document.getElementById('tChannel').innerHTML = channelOptions(t.channel_id || '');
  document.getElementById('tEnabled').checked = t.enabled !== 0 && t.enabled !== false;
  document.getElementById('taskFormWrap').style.display = 'block';
}
window.editTask = function(id){ taskForm((window._tasks||[]).filter(function(x){return x.id===id;})[0]); };
window.delTask = async function(id){
  if (!confirm('确认删除该任务?')) return;
  try { await api('/api/monitor/tasks/' + id, { method:'DELETE' }); await loadTasks(); }
  catch(e){ alert(e.message); }
};
window.viewLogs = async function(id, name){
  try {
    var data = await api('/api/monitor/tasks/' + id + '/logs');
    var box = document.getElementById('logBox');
    box.style.display = 'block';
    box.innerHTML = '<h2>执行日志 · ' + esc(name) + '</h2>' +
      '<table><thead><tr><th>时间</th><th>结果</th><th>状态</th><th>耗时</th><th>大小</th></tr></thead><tbody>' +
      (data.logs.map(function(l){
        return '<tr><td class="muted">' + esc(l.created_at) + '</td>' +
          '<td>' + (l.success ? '<span class="tag ok">成功</span>' : '<span class="tag fail">失败</span>') + '</td>' +
          '<td>' + esc(l.status) + ' ' + esc(l.status_text||'') + '</td>' +
          '<td>' + (l.response_time||0) + 'ms</td><td>' + (l.response_size||0) + '</td></tr>';
      }).join('') || '<tr><td colspan="5" class="muted">暂无日志</td></tr>') + '</tbody></table>';
    box.scrollIntoView({ behavior:'smooth' });
  } catch(e){ alert(e.message); }
};
document.getElementById('tSave').addEventListener('click', async function(){
  var id = document.getElementById('tId').value;
  var payload = {
    name: document.getElementById('tName').value,
    url: document.getElementById('tUrl').value,
    return_type: document.getElementById('tType').value,
    channel_id: document.getElementById('tChannel').value || null,
    enabled: document.getElementById('tEnabled').checked
  };
  try {
    if (id) await api('/api/monitor/tasks/' + id, { method:'PUT', body: payload });
    else await api('/api/monitor/tasks', { method:'POST', body: payload });
    document.getElementById('taskFormWrap').style.display = 'none';
    await loadTasks();
  } catch(e){ alert(e.message); }
});
document.getElementById('tNew').addEventListener('click', function(){ taskForm({}); });
document.getElementById('tCancel').addEventListener('click', function(){ document.getElementById('taskFormWrap').style.display='none'; });
document.getElementById('runNow').addEventListener('click', async function(){
  var btn = this; btn.disabled = true; btn.textContent = '执行中...';
  try {
    var r = await api('/api/monitor/run', { method:'POST' });
    alert(r.message + '（任务数: ' + (r.results ? r.results.length : 0) + '）');
    await loadTasks();
  } catch(e){ alert(e.message); }
  finally { btn.disabled = false; btn.textContent = '立即执行全部'; }
});

(async function(){
  try { await loadChannels(); await loadTasks(); }
  catch(e){ if (String(e.message).indexOf('登录')>=0) location.href='/login'; else alert(e.message); }
})();
`;

export { COMMON_JS, LOGIN_JS, DASHBOARD_JS, ADMIN_JS, SETUP_JS, MONITOR_JS };
