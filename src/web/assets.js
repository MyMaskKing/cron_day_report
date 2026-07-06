/**
 * 前端通用 JS 片段（作为字符串注入页面）
 */

// 通用 API 请求与工具函数（所有页面共用）
const COMMON_JS = `
var _loadingCount = 0;
function showLoading() {
  _loadingCount++;
  var el = document.getElementById('globalLoading');
  if (el) el.style.display = 'flex';
}
function hideLoading() {
  _loadingCount = Math.max(0, _loadingCount - 1);
  if (_loadingCount === 0) {
    var el = document.getElementById('globalLoading');
    if (el) el.style.display = 'none';
  }
}
async function api(path, opts) {
  opts = opts || {};
  showLoading();
  try {
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
  } finally {
    hideLoading();
  }
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
  var stopBtn = document.getElementById('stopImpersonateBtn');
  if (stopBtn) stopBtn.addEventListener('click', async function(e) {
    e.preventDefault();
    try { await api('/api/admin/stop-impersonate', { method: 'POST' }); location.href = '/admin'; }
    catch (err) { alert(err.message); }
  });
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}
// 通用弹窗
function openModal(title, bodyHtml) {
  var mask = document.getElementById('modalMask');
  if (!mask) return;
  document.getElementById('modalTitle').textContent = title || '';
  document.getElementById('modalBody').innerHTML = bodyHtml || '';
  mask.classList.add('show');
}
function closeModal() {
  var mask = document.getElementById('modalMask');
  if (mask) mask.classList.remove('show');
}
function bindModal() {
  var mask = document.getElementById('modalMask');
  if (!mask) return;
  var close = document.getElementById('modalClose');
  if (close) close.addEventListener('click', closeModal);
  mask.addEventListener('click', function(e){ if (e.target === mask) closeModal(); });
}
// 下拉菜单：点击切换，点击外部关闭
function toggleDropdown(el) {
  var menu = el.nextElementSibling;
  var isOpen = menu.classList.contains('show');
  document.querySelectorAll('.dropdown-menu.show').forEach(function(m){ m.classList.remove('show'); });
  if (!isOpen) menu.classList.add('show');
}
document.addEventListener('click', function(e){
  if (!e.target.closest('.dropdown')) {
    document.querySelectorAll('.dropdown-menu.show').forEach(function(m){ m.classList.remove('show'); });
  }
});
window.toggleDropdown = toggleDropdown;
// 时间区间：根据预设(month/year)生成 [start,end] YYYY-MM-DD
function rangeByPreset(preset) {
  var d = new Date(Date.now() + 8*3600*1000);
  var y = d.getUTCFullYear(), m = d.getUTCMonth();
  function fmt(dt){ return dt.toISOString().slice(0,10); }
  if (preset === 'year') return [y + '-01-01', y + '-12-31'];
  // month
  var first = new Date(Date.UTC(y, m, 1));
  var last = new Date(Date.UTC(y, m + 1, 0));
  return [fmt(first), fmt(last)];
}
// 月份区间(YYYY-MM)：供资产按月筛选
function monthRangeByPreset(preset) {
  var d = new Date(Date.now() + 8*3600*1000);
  var y = d.getUTCFullYear(), m = ('0'+(d.getUTCMonth()+1)).slice(-2);
  if (preset === 'year') return [y + '-01', y + '-12'];
  return [y + '-' + m, y + '-' + m];
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
      nickname: document.getElementById('rn').value || undefined,
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
    document.getElementById('welcome').textContent = '欢迎，' + (me.user.nickname || me.user.username);
  } catch (err) { location.href = '/login'; }
})();
`;

// 个人设置页 JS
const SETTINGS_JS = `
${COMMON_JS}
bindLogout();
var msg = document.getElementById('msg');
(async function(){
  try {
    var d = await api('/api/auth/profile');
    document.getElementById('pfUsername').value = d.profile.username;
    document.getElementById('pfNick').value = d.profile.nickname;
  } catch(e){ location.href = '/login'; }
})();
document.getElementById('nickForm').addEventListener('submit', async function(e){
  e.preventDefault();
  try {
    await api('/api/auth/profile', { method:'PUT', body:{ nickname: document.getElementById('pfNick').value } });
    showMsg(msg, '昵称已更新，刷新后生效', true);
  } catch(err){ showMsg(msg, err.message, false); }
});
document.getElementById('pwdForm').addEventListener('submit', async function(e){
  e.preventDefault();
  try {
    await api('/api/auth/password', { method:'PUT', body:{
      oldPassword: document.getElementById('pwOld').value,
      newPassword: document.getElementById('pwNew').value
    }});
    showMsg(msg, '密码已修改', true);
    document.getElementById('pwOld').value = ''; document.getElementById('pwNew').value = '';
  } catch(err){ showMsg(msg, err.message, false); }
});
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
bindModal();
var tbody = document.getElementById('userTbody');
var detail = document.getElementById('detail');

async function loadUsers() {
  try {
    var data = await api('/api/admin/users');
    tbody.innerHTML = data.users.map(function(u) {
      return '<tr>' +
        '<td data-label="ID">' + u.id + '</td>' +
        '<td data-label="用户名">' + esc(u.username) + '</td>' +
        '<td data-label="昵称">' + esc(u.nickname || u.username) + '</td>' +
        '<td data-label="角色"><span class="tag ' + u.role + '">' + (u.role === 'admin' ? '超管' : '用户') + '</span></td>' +
        '<td data-label="状态"><span class="tag ' + u.status + '">' + (u.status === 'active' ? '正常' : '禁用') + '</span></td>' +
        '<td data-label="创建时间">' + esc(u.created_at) + '</td>' +
        '<td data-label="操作"><div class="dropdown">' +
          '<button class="btn sm" onclick="toggleDropdown(this)">⋯ 操作</button>' +
          '<div class="dropdown-menu">' +
            '<button onclick="viewUser(' + u.id + ')">查看</button>' +
            '<button onclick="impersonate(' + u.id + ",'" + esc(u.username).replace(/'/g,'') + "'" + ')">切换身份</button>' +
            '<button onclick="editNick(' + u.id + ",'" + esc(u.nickname||u.username).replace(/'/g,'') + "'" + ')">改昵称</button>' +
            '<button onclick="resetPwd(' + u.id + ",'" + esc(u.username).replace(/'/g,'') + "'" + ')">重置密码</button>' +
            '<button onclick="toggleRole(' + u.id + ",'" + u.role + "'" + ')">' + (u.role === 'admin' ? '降为用户' : '升为超管') + '</button>' +
            '<button class="danger" onclick="toggleStatus(' + u.id + ",'" + u.status + "'" + ')">' + (u.status === 'active' ? '禁用' : '启用') + '</button>' +
          '</div>' +
        '</div></td></tr>';
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
async function impersonate(id, name) {
  if (!confirm('确认切换到 ' + name + ' 的身份浏览?')) return;
  try { await api('/api/admin/users/' + id + '/impersonate', { method: 'POST' }); location.href = '/dashboard'; }
  catch (err) { alert(err.message); }
}
function resetPwd(id, name) {
  openModal('重置密码 · ' + name,
    '<p class="muted">留空则重置为默认密码 123456。</p>' +
    '<label>新密码（可选，至少6位）</label><input id="rpPwd" type="text" placeholder="留空=123456">' +
    '<div style="margin-top:12px;"><button class="btn" id="rpConfirm">确认重置</button> ' +
    '<button class="btn gray" onclick="closeModal()">取消</button></div>');
  document.getElementById('rpConfirm').addEventListener('click', async function(){
    var pwd = document.getElementById('rpPwd').value;
    try {
      var r = await api('/api/admin/users/' + id + '/password', { method: 'PUT', body: pwd ? { password: pwd } : {} });
      closeModal(); alert(r.message);
    } catch (err) { alert(err.message); }
  });
}
function editNick(id, cur) {
  openModal('修改昵称',
    '<label>昵称</label><input id="enNick" maxlength="32" value="' + cur + '">' +
    '<div style="margin-top:12px;"><button class="btn" id="enConfirm">保存</button> ' +
    '<button class="btn gray" onclick="closeModal()">取消</button></div>');
  document.getElementById('enConfirm').addEventListener('click', async function(){
    try {
      var r = await api('/api/admin/users/' + id + '/nickname', { method: 'PUT', body: { nickname: document.getElementById('enNick').value } });
      closeModal(); alert(r.message); loadUsers();
    } catch (err) { alert(err.message); }
  });
}
function newUser() {
  openModal('创建用户',
    '<label>用户名（3-32位，登录用）</label><input id="nuName">' +
    '<label>昵称（显示用，可选）</label><input id="nuNick" placeholder="留空则同用户名">' +
    '<label>密码（留空=123456）</label><input id="nuPwd" type="text" placeholder="留空=123456">' +
    '<label>角色</label><select id="nuRole"><option value="user">用户</option><option value="admin">超管</option></select>' +
    '<div style="margin-top:12px;"><button class="btn" id="nuConfirm">创建</button> ' +
    '<button class="btn gray" onclick="closeModal()">取消</button></div>');
  document.getElementById('nuConfirm').addEventListener('click', async function(){
    var payload = {
      username: document.getElementById('nuName').value.trim(),
      nickname: document.getElementById('nuNick').value.trim() || undefined,
      password: document.getElementById('nuPwd').value || undefined,
      role: document.getElementById('nuRole').value
    };
    try { var r = await api('/api/admin/users', { method: 'POST', body: payload }); closeModal(); alert(r.message); loadUsers(); }
    catch (err) { alert(err.message); }
  });
}
window.viewUser = viewUser; window.toggleRole = toggleRole; window.toggleStatus = toggleStatus;
window.impersonate = impersonate; window.resetPwd = resetPwd; window.editNick = editNick;
var newUserBtn = document.getElementById('newUserBtn');
if (newUserBtn) newUserBtn.addEventListener('click', newUser);
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

// ---------- 通知渠道（只读，供任务下拉；管理在 /channels 页）----------
async function loadChannels() {
  var data = await api('/api/notify/channels');
  channels = data.channels;
}

// ---------- 监控任务 ----------
async function loadTasks() {
  var data = await api('/api/monitor/tasks');
  var tb = document.getElementById('taskTbody');
  tb.innerHTML = data.tasks.map(function(t) {
    return '<tr><td data-label="名称">' + esc(t.name) + '</td>' +
      '<td data-label="URL" class="muted" style="word-break:break-all;">' + esc(t.url) + '</td>' +
      '<td data-label="格式">' + t.return_type + '</td>' +
      '<td data-label="渠道">' + channelName(t.channel_id) + '</td>' +
      '<td data-label="状态">' + (t.enabled ? '<span class="tag ok">启用</span>' : '<span class="tag disabled">停用</span>') + '</td>' +
      '<td data-label="操作"><div class="dropdown">' +
        '<button class="btn sm" onclick="toggleDropdown(this)">⋯ 操作</button>' +
        '<div class="dropdown-menu">' +
          '<button onclick="editTask(' + t.id + ')">编辑</button>' +
          '<button onclick="viewLogs(' + t.id + ",'" + esc(t.name).replace(/'/g,'') + "'" + ')">日志</button>' +
          '<button class="danger" onclick="delTask(' + t.id + ')">删除</button>' +
        '</div>' +
      '</div></td></tr>';
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
        return '<tr><td data-label="时间" class="muted">' + esc(l.created_at) + '</td>' +
          '<td data-label="结果">' + (l.success ? '<span class="tag ok">成功</span>' : '<span class="tag fail">失败</span>') + '</td>' +
          '<td data-label="状态">' + esc(l.status) + ' ' + esc(l.status_text||'') + '</td>' +
          '<td data-label="耗时">' + (l.response_time||0) + 'ms</td><td data-label="大小">' + (l.response_size||0) + '</td></tr>';
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

// 通知渠道管理 JS（独立页）
const CHANNELS_JS = `
${COMMON_JS}
bindLogout();
bindModal();
var CH_HELP = {
  wechat: '<b>📢 企业微信群机器人</b><br>• <b>URL</b>：群机器人 Webhook 地址<br>&nbsp;&nbsp;<code>https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=你的key</code><br>• <b>请求头 JSON</b>、<b>Body 模板</b>：留空',
  webhook: '<b>🔗 通用 Webhook</b><br>• <b>URL</b>：接收消息的接口地址<br>• <b>请求头 JSON</b>（可选）：<code>{"Authorization":"Bearer xxx"}</code><br>• <b>Body 模板</b>（可选）：用 <code>{{content}}</code> 代表正文，例 <code>{"text":"{{content}}"}</code>',
  email: '<b>📧 邮件（中转服务转发）</b><br>• <b>URL</b>：邮件中转服务地址<br>• <b>请求头 JSON</b>：<span style="color:#cf1322;">填收件人和主题</span> <code>{"mailto":"x@qq.com","subject":"标题"}</code><br>• <b>Body 模板</b>：留空'
};
async function loadChannels() {
  var data = await api('/api/notify/channels');
  var tb = document.getElementById('chTbody');
  tb.innerHTML = data.channels.map(function(c) {
    return '<tr><td data-label="名称">' + esc(c.name) + '</td><td data-label="类型">' + c.type + '</td>' +
      '<td data-label="URL" class="muted" style="word-break:break-all;">' + esc(c.url) + '</td>' +
      '<td data-label="状态">' + (c.enabled ? '<span class="tag ok">启用</span>' : '<span class="tag disabled">停用</span>') + '</td>' +
      '<td data-label="操作"><button class="btn sm gray" onclick="editCh(' + c.id + ')">编辑</button> ' +
      '<button class="btn sm danger" onclick="delCh(' + c.id + ')">删除</button></td></tr>';
  }).join('') || '<tr><td colspan="5" class="muted">暂无渠道</td></tr>';
  window._channels = data.channels;
}
function chModal(c) {
  c = c || {};
  var help = '<div id="chHelp" style="background:#f8f9ff;border:1px solid #e6e8f0;border-radius:6px;padding:12px;margin-bottom:12px;font-size:13px;line-height:1.7;"></div>';
  openModal(c.id ? '编辑渠道' : '新建渠道',
    '<input type="hidden" id="chId" value="' + (c.id||'') + '">' +
    '<label>渠道名称</label><input id="chName" value="' + esc(c.name||'') + '">' +
    '<div class="row"><div><label>类型</label><select id="chType">' +
      '<option value="wechat">企业微信机器人</option><option value="webhook">通用 Webhook</option><option value="email">邮件(webhook转发)</option>' +
    '</select></div><div><label>请求方法</label><select id="chMethod"><option value="POST">POST</option><option value="PUT">PUT</option><option value="GET">GET</option></select></div></div>' +
    help +
    '<label>URL</label><input id="chUrl" value="' + esc(c.url||'') + '" placeholder="https://...">' +
    '<label>自定义请求头 JSON（可选）</label><textarea id="chHeaders" rows="2">' + esc(c.headers_json||'') + '</textarea>' +
    '<label>Body 模板（可选，含 {{content}}）</label><textarea id="chBody" rows="2">' + esc(c.body_template||'') + '</textarea>' +
    '<label><input type="checkbox" id="chEnabled" style="width:auto;"' + (c.enabled!==0&&c.enabled!==false?' checked':'') + '> 启用</label>' +
    '<div style="margin-top:12px;"><button class="btn" id="chSave">保存</button> <button class="btn gray" onclick="closeModal()">取消</button></div>');
  document.getElementById('chType').value = c.type || 'wechat';
  document.getElementById('chMethod').value = c.method || 'POST';
  var renderHelp = function(){ document.getElementById('chHelp').innerHTML = CH_HELP[document.getElementById('chType').value] || ''; };
  document.getElementById('chType').addEventListener('change', renderHelp); renderHelp();
  document.getElementById('chSave').addEventListener('click', async function(){
    var id = document.getElementById('chId').value;
    var payload = {
      name: document.getElementById('chName').value, type: document.getElementById('chType').value,
      url: document.getElementById('chUrl').value, method: document.getElementById('chMethod').value,
      headers_json: document.getElementById('chHeaders').value || null,
      body_template: document.getElementById('chBody').value || null,
      enabled: document.getElementById('chEnabled').checked
    };
    try {
      if (id) await api('/api/notify/channels/' + id, { method:'PUT', body: payload });
      else await api('/api/notify/channels', { method:'POST', body: payload });
      closeModal(); await loadChannels();
    } catch(e){ alert(e.message); }
  });
}
window.editCh = function(id){ chModal((window._channels||[]).filter(function(x){return x.id===id;})[0]); };
window.delCh = async function(id){
  if (!confirm('确认删除该渠道?')) return;
  try { await api('/api/notify/channels/' + id, { method:'DELETE' }); await loadChannels(); } catch(e){ alert(e.message); }
};
document.getElementById('chNew').addEventListener('click', function(){ chModal({}); });
(async function(){
  try { await loadChannels(); }
  catch(e){ if (String(e.message).indexOf('登录')>=0) location.href='/login'; else alert(e.message); }
})();
`;

// 基金追踪 JS
const FUND_JS = `
${COMMON_JS}
bindLogout();
bindModal();
var chart = null;

function sign(n){ return (n>=0?'+':'') + n; }
function colorOf(n){ return n>=0 ? '#cf1322' : '#389e0d'; }

// ---------- 报表 ----------
async function loadReport() {
  var data = await api('/api/fund/report');
  var t = data.totals;
  document.getElementById('sumCost').textContent = t.cost;
  document.getElementById('sumValue').textContent = t.value;
  var pe = document.getElementById('sumProfit');
  pe.textContent = sign(t.profit); pe.style.color = colorOf(t.profit);
  var re = document.getElementById('sumRate');
  re.textContent = sign(t.rate) + '%'; re.style.color = colorOf(t.rate);

  // 明细表
  var tb = document.getElementById('fundTbody');
  tb.innerHTML = data.items.map(function(it){
    return '<tr><td data-label="基金">' + esc(it.name) + '<br><span class="muted">' + it.code + '</span></td>' +
      '<td data-label="份额">' + it.shares + '</td>' +
      '<td data-label="成本净值">' + it.cost_nav + '</td>' +
      '<td data-label="现价(估)">' + it.current_nav + ' <span style="color:' + colorOf(it.gszzl) + '">(' + sign(it.gszzl) + '%)</span></td>' +
      '<td data-label="本金">' + it.cost + '</td>' +
      '<td data-label="现值">' + it.value + '</td>' +
      '<td data-label="收益" style="color:' + colorOf(it.profit) + '">' + sign(it.profit) + '<br>(' + sign(it.rate) + '%)</td>' +
      '<td data-label="操作"><div class="dropdown">' +
        '<button class="btn sm" onclick="toggleDropdown(this)">⋯ 操作</button>' +
        '<div class="dropdown-menu">' +
          '<button onclick="editFund(' + it.id + ')">编辑</button>' +
          '<button onclick="buyFundUI(' + it.id + ')">加仓</button>' +
          '<button onclick="shareLink(' + it.id + ')">加仓链接</button>' +
          '<button class="danger" onclick="delFund(' + it.id + ')">删除</button>' +
        '</div>' +
      '</div></td></tr>';
  }).join('') || '<tr><td colspan="8" class="muted">暂无持仓</td></tr>';
  window._items = data.items;

  drawChart(data.items);
}

function drawChart(items) {
  var el = document.getElementById('fundChart');
  if (!el) return;
  var labels = items.map(function(i){ return i.name; });
  var values = items.map(function(i){ return i.value; });
  if (chart) chart.destroy();
  if (!items.length) return;
  chart = new Chart(el, {
    type: 'doughnut',
    data: { labels: labels, datasets: [{ data: values,
      backgroundColor: ['#667eea','#764ba2','#f093fb','#4facfe','#43e97b','#fa709a','#fee140','#30cfd0','#a8edea','#ff9a9e'] }] },
    options: { plugins: { legend: { position: 'right' }, title: { display: true, text: '持仓现值分布' } } }
  });
}

// ---------- 持仓增删改 ----------
function fundForm(f) {
  f = f || {};
  document.getElementById('fId').value = f.id || '';
  document.getElementById('fCode').value = f.code || '';
  document.getElementById('fShares').value = f.shares != null ? f.shares : '';
  document.getElementById('fCostNav').value = f.cost_nav != null ? f.cost_nav : '';
  document.getElementById('fundFormWrap').style.display = 'block';
}
window.editFund = function(id){ fundForm((window._items||[]).filter(function(x){return x.id===id;})[0]); };
window.delFund = async function(id){
  if (!confirm('确认删除该持仓?')) return;
  try { await api('/api/fund/' + id, { method:'DELETE' }); await loadReport(); }
  catch(e){ alert(e.message); }
};
window.shareLink = async function(id){
  try {
    var d = await api('/api/fund/' + id + '/share-link');
    openModal('免密加仓链接',
      '<p class="muted">此链接长期有效，任何人打开无需登录即可为该基金补录买入（自动累计份额并重算成本）。请妥善保管。</p>' +
      '<input id="shareUrl" value="' + esc(d.link) + '" readonly style="margin-bottom:8px;">' +
      '<button class="btn" onclick="copyShare()">复制链接</button>');
  } catch(e){ alert(e.message); }
};
window.copyShare = function(){
  var el = document.getElementById('shareUrl');
  el.select();
  try { document.execCommand('copy'); alert('已复制'); } catch(e) { alert('请手动复制'); }
};
// 页面内加仓（弹窗）
window.buyFundUI = function(id){
  var f = (window._items||[]).filter(function(x){return x.id===id;})[0];
  if (!f) return;
  var html =
    '<p class="muted">当前持有 <b>' + f.shares + '</b> 份 · 成本净值 <b>' + f.cost_nav + '</b>。按金额买入，系统自动累计份额并重算成本。</p>' +
    '<input type="hidden" id="buyId" value="' + id + '">' +
    '<label>买入金额(元)</label><input id="buyAmount" type="number" step="0.01" placeholder="如 1000">' +
    '<label>买入净值（默认当前估值，可改）</label><input id="buyNavInput" type="number" step="0.0001" value="' + (f.current_nav||'') + '">' +
    '<div style="margin-top:12px;"><button class="btn" id="buyConfirm">确认加仓</button> ' +
    '<button class="btn gray" onclick="closeModal()">取消</button></div>';
  openModal('加仓 · ' + f.name + ' (' + f.code + ')', html);
  document.getElementById('buyConfirm').addEventListener('click', async function(){
    var payload = {
      amount: document.getElementById('buyAmount').value,
      buyNav: document.getElementById('buyNavInput').value || undefined
    };
    try {
      var r = await api('/api/fund/' + id + '/buy', { method:'POST', body: payload });
      closeModal();
      alert('加仓成功！新增 ' + r.addShares + ' 份，当前共 ' + r.newShares + ' 份，成本净值 ' + r.newCostNav);
      await loadReport();
    } catch(e){ alert(e.message); }
  });
};
document.getElementById('fSave').addEventListener('click', async function(){
  var id = document.getElementById('fId').value;
  var payload = {
    code: document.getElementById('fCode').value.trim(),
    shares: document.getElementById('fShares').value,
    cost_nav: document.getElementById('fCostNav').value
  };
  try {
    if (id) await api('/api/fund/' + id, { method:'PUT', body: payload });
    else await api('/api/fund', { method:'POST', body: payload });
    document.getElementById('fundFormWrap').style.display = 'none';
    await loadReport();
  } catch(e){ alert(e.message); }
});
document.getElementById('fNew').addEventListener('click', function(){ fundForm({}); });
document.getElementById('fCancel').addEventListener('click', function(){ document.getElementById('fundFormWrap').style.display='none'; });

// ---------- 日报配置（走通用 push API, module=fund）----------
async function loadReportConfig() {
  var chData = await api('/api/notify/channels');
  var opts = '<option value="">（选择通知渠道）</option>';
  chData.channels.forEach(function(c){ opts += '<option value="' + c.id + '">' + esc(c.name) + ' [' + c.type + ']</option>'; });
  document.getElementById('rcChannel').innerHTML = opts;

  var data = await api('/api/push/fund');
  var cfg = data.config;
  document.getElementById('rcChannel').value = cfg.channel_id || '';
  document.getElementById('rcFormat').value = cfg.format || 'text';
  document.getElementById('rcEnabled').checked = !!cfg.enabled;
  var hourEl = document.getElementById('rcHour');
  if (hourEl) hourEl.value = cfg.hour != null ? cfg.hour : 15;
}
document.getElementById('rcSave').addEventListener('click', async function(){
  var hourEl = document.getElementById('rcHour');
  var payload = {
    channel_id: document.getElementById('rcChannel').value || null,
    format: document.getElementById('rcFormat').value,
    hour: hourEl ? hourEl.value : 15,
    enabled: document.getElementById('rcEnabled').checked
  };
  try { await api('/api/push/fund', { method:'PUT', body: payload }); alert('日报配置已保存'); }
  catch(e){ alert(e.message); }
});
document.getElementById('rcSend').addEventListener('click', async function(){
  var btn = this; btn.disabled = true; btn.textContent = '发送中...';
  try { var r = await api('/api/fund/report/send', { method:'POST' }); alert(r.message); }
  catch(e){ alert(e.message); }
  finally { btn.disabled = false; btn.textContent = '立即发送日报'; }
});

// ---------- 持仓分析 ----------
var SIGNAL_COLOR = { danger:'#cf1322', warn:'#d46b08', success:'#389e0d', info:'#666' };
document.getElementById('anRun').addEventListener('click', async function(){
  var q = '?stopLoss=' + encodeURIComponent(document.getElementById('anStopLoss').value) +
    '&takeProfit=' + encodeURIComponent(document.getElementById('anTakeProfit').value) +
    '&concentration=' + encodeURIComponent(document.getElementById('anConcentration').value);
  try {
    var d = await api('/api/fund/analysis' + q);
    var box = document.getElementById('anResult');
    if (!d.items || !d.items.length) { box.innerHTML = '<p class="muted">' + esc(d.disclaimer||'暂无持仓') + '</p>'; return; }
    var html = '';
    if (d.summary && d.summary.length) {
      html += '<div style="background:#fffbe6;border:1px solid #ffe58f;border-radius:6px;padding:10px;margin-bottom:12px;">' +
        '<b>组合提示</b><ul style="margin:6px 0 0 18px;">' +
        d.summary.map(function(s){ return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></div>';
    }
    html += d.items.map(function(it){
      var sig = it.signals.map(function(s){
        return '<div style="color:' + (SIGNAL_COLOR[s.level]||'#666') + ';font-size:14px;">• ' + esc(s.text) + '</div>';
      }).join('');
      return '<div style="background:#f8f9fa;border-radius:6px;padding:12px;margin-bottom:10px;">' +
        '<div><b>' + esc(it.name) + ' (' + it.code + ')</b> · 占比 ' + it.weight + '%</div>' +
        sig +
        '<div class="muted" style="font-size:13px;margin-top:6px;">' +
          '止损参考净值: ' + it.targets.stopLossNav + ' · 止盈参考净值: ' + it.targets.takeProfitNav + '</div>' +
        '</div>';
    }).join('');
    html += '<p class="muted" style="font-size:12px;margin-top:8px;">' + esc(d.disclaimer) + '</p>';
    box.innerHTML = html;
  } catch(e){ alert(e.message); }
});

// ---------- 情景测算 ----------
document.getElementById('scRun').addEventListener('click', async function(){
  var payload = {
    code: document.getElementById('scCode').value.trim() || undefined,
    amount: document.getElementById('scAmount').value,
    nav: document.getElementById('scNav').value || undefined,
    takeProfit: document.getElementById('scTakeProfit').value,
    stopLoss: document.getElementById('scStopLoss').value
  };
  try {
    var d = await api('/api/fund/scenario', { method:'POST', body: payload });
    var box = document.getElementById('scResult');
    var rows = d.scenarios.map(function(s){
      return '<tr><td>' + sign(s.changePct) + '%</td>' +
        '<td>' + s.targetNav + '</td>' +
        '<td>' + s.value + '</td>' +
        '<td style="color:' + colorOf(s.profit) + '">' + sign(s.profit) + '</td></tr>';
    }).join('');
    box.innerHTML =
      '<p>投入 <b>' + d.amount + '</b> 元 · 买入净值 <b>' + d.buyNav + '</b> · 可得约 <b>' + d.shares + '</b> 份</p>' +
      '<table><thead><tr><th>假设涨幅</th><th>对应净值</th><th>持仓现值</th><th>盈亏</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div style="margin-top:10px;background:#f8f9ff;border-radius:6px;padding:10px;font-size:14px;">' +
        '🎯 止盈 ' + sign(d.targets.takeProfitPct) + '% → 净值 ' + d.targets.takeProfitNav + '，盈利约 ' + d.targets.takeProfitProfit + ' 元<br>' +
        '🛑 止损 ' + sign(d.targets.stopLossPct) + '% → 净值 ' + d.targets.stopLossNav + '，亏损约 ' + d.targets.stopLossProfit + ' 元' +
      '</div>' +
      '<p class="muted" style="font-size:12px;margin-top:8px;">' + esc(d.disclaimer) + '</p>';
  } catch(e){ alert(e.message); }
});

(async function(){
  try { await loadReport(); await loadReportConfig(); }
  catch(e){ if (String(e.message).indexOf('登录')>=0) location.href='/login'; else alert(e.message); }
})();
`;

// 免密加仓公开页 JS（无需登录，通过 URL 中的 token 操作）
const PUBLIC_BUY_JS = `
${COMMON_JS}
var token = location.pathname.split('/').filter(Boolean).pop();
var msg = document.getElementById('msg');

async function loadInfo() {
  try {
    var d = await api('/api/public/fund/' + token);
    var f = d.fund;
    document.getElementById('fundName').textContent = f.name + ' (' + f.code + ')';
    document.getElementById('curNav').textContent = f.current_nav + ' (' + (f.gszzl>=0?'+':'') + f.gszzl + '%)';
    document.getElementById('curShares').textContent = f.shares;
    document.getElementById('curCost').textContent = f.cost_nav;
    document.getElementById('buyNav').value = f.current_nav || '';
    document.getElementById('content').style.display = 'block';
  } catch(e) {
    document.getElementById('content').innerHTML = '<p class="msg err" style="display:block;">' + esc(e.message) + '</p>';
  }
}
document.getElementById('buyForm').addEventListener('submit', async function(e){
  e.preventDefault();
  var payload = {
    amount: document.getElementById('amount').value,
    buyNav: document.getElementById('buyNav').value || undefined
  };
  try {
    var r = await api('/api/public/fund/' + token + '/buy', { method:'POST', body: payload });
    showMsg(msg, '加仓成功！新增 ' + r.addShares + ' 份，当前共 ' + r.newShares + ' 份，成本净值 ' + r.newCostNav, true);
    await loadInfo();
    document.getElementById('amount').value = '';
  } catch(err) { showMsg(msg, err.message, false); }
});
loadInfo();
`;

// 体重曲线页 JS
const WEIGHT_JS = `
${COMMON_JS}
bindLogout();
bindModal();
var wChart = null, cmpChart = null;
var members = [];
var unit = 'jin';
var COLORS = ['#667eea','#f5222d','#52c41a','#faad14','#13c2c2','#722ed1','#eb2f96','#fa8c16'];

function unitLabel(){ return unit === 'kg' ? '公斤' : '斤'; }
function toDisplay(kg){ return unit === 'jin' ? Math.round(kg * 2 * 10) / 10 : kg; }
function toKg(v){ v = parseFloat(v); return unit === 'jin' ? v / 2 : v; }
function todayStr(){ var d = new Date(Date.now() + 8*3600*1000); return d.toISOString().slice(0,10); }
var allRecords = [];

function applyFilter() {
  var s = document.getElementById('fStart').value;
  var e = document.getElementById('fEnd').value;
  var filtered = allRecords.filter(function(r){
    if (s && r.record_date < s) return false;
    if (e && r.record_date > e) return false;
    return true;
  });
  drawChart(members, filtered);
  renderRecordTable(members, filtered);
}

async function loadAll() {
  var data = await api('/api/weight/chart');
  members = data.members;
  allRecords = data.records;
  unit = data.weight_unit || 'jin';
  var us = document.getElementById('unitSel');
  if (us) us.value = unit;
  renderMembers(data.members);
  renderMemberSelect(data.members);
  updateUnitLabels();
  var dateInput = document.getElementById('recDate');
  if (dateInput && !dateInput.value) dateInput.value = todayStr();
  applyFilter();
}
function updateUnitLabels() {
  var l = document.getElementById('recWeightLabel');
  if (l) l.textContent = '体重(' + unitLabel() + ')';
}
function renderMembers(list) {
  var box = document.getElementById('memberList');
  box.innerHTML = list.map(function(m){
    return '<span class="tag user" style="margin:2px 4px;padding:4px 10px;">' + esc(m.name) +
      ' <a href="#" onclick="mShare(' + m.id + ');return false;" style="margin-left:4px;">链接</a>' +
      ' <a href="#" onclick="mDel(' + m.id + ');return false;" style="color:#cf1322;">×</a></span>';
  }).join('') || '<span class="muted">暂无成员</span>';
}
function renderMemberSelect(list) {
  var sel = document.getElementById('recMember');
  var cur = sel.value;
  sel.innerHTML = list.map(function(m){ return '<option value="' + m.id + '">' + esc(m.name) + '</option>'; }).join('');
  if (cur) sel.value = cur; // 保持选择, 默认第一个(浏览器默认选中首项)
}
function drawChart(mlist, records) {
  var byMember = {};
  mlist.forEach(function(m){ byMember[m.id] = { name: m.name, data: {} }; });
  var dates = {};
  records.forEach(function(r){ if (byMember[r.member_id]) { byMember[r.member_id].data[r.record_date] = toDisplay(r.weight); dates[r.record_date] = 1; } });
  var labels = Object.keys(dates).sort();
  var datasets = mlist.map(function(m, i){
    return { label: m.name, data: labels.map(function(d){ return byMember[m.id].data[d] != null ? byMember[m.id].data[d] : null; }),
      borderColor: COLORS[i % COLORS.length], backgroundColor: COLORS[i % COLORS.length], spanGaps: true, tension: .3 };
  });
  if (wChart) wChart.destroy();
  var el = document.getElementById('weightChart');
  wChart = new Chart(el, { type: 'line', data: { labels: labels, datasets: datasets },
    options: { plugins: { legend: { position: 'top' } }, scales: { y: { title: { display: true, text: '体重(' + unitLabel() + ')' } } } } });
}
function renderRecordTable(mlist, records) {
  var nameOf = {}; mlist.forEach(function(m){ nameOf[m.id] = m.name; });
  var tb = document.getElementById('recTbody');
  var sorted = records.slice().sort(function(a,b){ return b.record_date < a.record_date ? -1 : 1; });
  tb.innerHTML = sorted.map(function(r){
    return '<tr><td data-label="日期">' + esc(r.record_date) + '</td>' +
      '<td data-label="成员">' + esc(nameOf[r.member_id]||'') + '</td>' +
      '<td data-label="体重">' + toDisplay(r.weight) + ' ' + unitLabel() + '</td>' +
      '<td data-label="操作"><button class="btn sm gray" onclick="recEdit(' + r.id + ',' + r.weight + ",'" + r.record_date + "'" + ')">改</button> ' +
      '<button class="btn sm danger" onclick="recDel(' + r.id + ')">删</button></td></tr>';
  }).join('') || '<tr><td colspan="4" class="muted">暂无记录</td></tr>';
}

window.mDel = async function(id){
  if (!confirm('删除该成员及其记录?')) return;
  try { await api('/api/weight/members/' + id, { method:'DELETE' }); await loadAll(); } catch(e){ alert(e.message); }
};
window.mShare = async function(id){
  try {
    var d = await api('/api/weight/members/' + id + '/share-link');
    openModal('免密填写链接',
      '<p class="muted">此链接长期有效，打开无需登录即可填写该成员当天体重。</p>' +
      '<input id="wShareUrl" value="' + esc(d.link) + '" readonly style="margin-bottom:8px;">' +
      '<button class="btn" onclick="wCopy()">复制链接</button>');
  } catch(e){ alert(e.message); }
};
window.wCopy = function(){ var el=document.getElementById('wShareUrl'); el.select(); try{document.execCommand('copy');alert('已复制');}catch(e){alert('请手动复制');} };
window.recEdit = function(id, curKg, curDate){
  openModal('修改记录',
    '<label>日期</label><input id="reD" type="date" value="' + curDate + '">' +
    '<label>体重(' + unitLabel() + ')</label><input id="reW" type="number" step="0.1" value="' + toDisplay(curKg) + '">' +
    '<div style="margin-top:12px;"><button class="btn" id="reConfirm">保存</button> <button class="btn gray" onclick="closeModal()">取消</button></div>');
  document.getElementById('reConfirm').addEventListener('click', async function(){
    try {
      await api('/api/weight/records/' + id, { method:'PUT', body:{
        weight: toKg(document.getElementById('reW').value),
        record_date: document.getElementById('reD').value
      }});
      closeModal(); await loadAll();
    } catch(e){ alert(e.message); }
  });
};
window.recDel = async function(id){
  if (!confirm('删除该记录?')) return;
  try { await api('/api/weight/records/' + id, { method:'DELETE' }); await loadAll(); } catch(e){ alert(e.message); }
};

document.getElementById('mAdd').addEventListener('click', function(){
  openModal('新建成员',
    '<label>成员名称</label><input id="mName">' +
    '<div style="margin-top:12px;"><button class="btn" id="mConfirm">创建</button> <button class="btn gray" onclick="closeModal()">取消</button></div>');
  document.getElementById('mConfirm').addEventListener('click', async function(){
    try { await api('/api/weight/members', { method:'POST', body:{ name: document.getElementById('mName').value } }); closeModal(); await loadAll(); }
    catch(e){ alert(e.message); }
  });
});
document.getElementById('recAdd').addEventListener('click', async function(){
  var w = document.getElementById('recWeight').value;
  if (!w) { alert('请填写体重'); return; }
  var payload = { member_id: document.getElementById('recMember').value, weight: toKg(w),
    record_date: document.getElementById('recDate').value || undefined };
  try { var r = await api('/api/weight/records', { method:'POST', body: payload }); alert(r.message);
    document.getElementById('recWeight').value = ''; await loadAll(); }
  catch(e){ alert(e.message); }
});
// 单位设置
var unitSel = document.getElementById('unitSel');
if (unitSel) unitSel.addEventListener('change', async function(){
  try { await api('/api/weight/unit', { method:'PUT', body:{ weight_unit: this.value } }); await loadAll(); }
  catch(e){ alert(e.message); }
});

// 超管对比
async function initCompare() {
  var wrap = document.getElementById('compareCard');
  if (!wrap) return;
  try {
    var d = await api('/api/admin/users');
    var box = document.getElementById('cmpUsers');
    box.innerHTML = d.users.map(function(u){
      return '<label style="display:inline-block;margin:2px 8px;font-weight:normal;"><input type="checkbox" value="' + u.id + '" style="width:auto;"> ' + esc(u.username) + '</label>';
    }).join('');
    wrap.style.display = 'block';
  } catch(e){ /* 非超管忽略 */ }
}
async function runCompare() {
  var ids = Array.prototype.slice.call(document.querySelectorAll('#cmpUsers input:checked')).map(function(x){ return x.value; });
  if (!ids.length) { alert('请至少选择一个用户'); return; }
  var d = await api('/api/admin/weight/compare?userIds=' + ids.join(','));
  var byKey = {}; var dates = {};
  d.records.forEach(function(r){
    var key = r.owner_id + '-' + r.member_name;
    if (!byKey[key]) byKey[key] = {};
    byKey[key][r.record_date] = toDisplay(r.weight); dates[r.record_date] = 1;
  });
  var labels = Object.keys(dates).sort();
  var keys = Object.keys(byKey);
  var datasets = keys.map(function(k, i){
    return { label: k, data: labels.map(function(dt){ return byKey[k][dt] != null ? byKey[k][dt] : null; }),
      borderColor: COLORS[i % COLORS.length], backgroundColor: COLORS[i % COLORS.length], spanGaps: true, tension: .3 };
  });
  if (cmpChart) cmpChart.destroy();
  cmpChart = new Chart(document.getElementById('compareChart'), { type: 'line', data: { labels: labels, datasets: datasets },
    options: { plugins: { legend: { position: 'top' } } } });
}
var cmpBtn = document.getElementById('cmpRun');
if (cmpBtn) cmpBtn.addEventListener('click', runCompare);

// 时间筛选
function initFilter() {
  var sel = document.getElementById('rangePreset');
  function applyPreset(){
    var r = rangeByPreset(sel.value);
    document.getElementById('fStart').value = r[0];
    document.getElementById('fEnd').value = r[1];
    applyFilter();
  }
  sel.addEventListener('change', applyPreset);
  document.getElementById('fStart').addEventListener('change', applyFilter);
  document.getElementById('fEnd').addEventListener('change', applyFilter);
  applyPreset(); // 默认本月
}

// 推送配置（体重日报）
async function loadPush() {
  var chs = await api('/api/notify/channels');
  var opts = '<option value="">（选择渠道）</option>' + chs.channels.map(function(c){ return '<option value="'+c.id+'">'+esc(c.name)+' ['+c.type+']</option>'; }).join('');
  document.getElementById('pushCh').innerHTML = opts;
  var d = await api('/api/push/weight');
  document.getElementById('pushCh').value = d.config.channel_id || '';
  document.getElementById('pushFmt').value = d.config.format || 'text';
  document.getElementById('pushHour').value = d.config.hour != null ? d.config.hour : 10;
  document.getElementById('pushEn').checked = !!d.config.enabled;
}
var pushSave = document.getElementById('pushSave');
if (pushSave) pushSave.addEventListener('click', async function(){
  try {
    await api('/api/push/weight', { method:'PUT', body:{
      channel_id: document.getElementById('pushCh').value || null,
      format: document.getElementById('pushFmt').value,
      hour: document.getElementById('pushHour').value,
      enabled: document.getElementById('pushEn').checked
    }});
    alert('推送配置已保存');
  } catch(e){ alert(e.message); }
});

(async function(){
  try { await loadAll(); initFilter(); await loadPush(); await initCompare(); }
  catch(e){ if (String(e.message).indexOf('登录')>=0) location.href='/login'; else alert(e.message); }
})();
`;

// 体重免密填写公开页 JS
const PUBLIC_WEIGHT_JS = `
${COMMON_JS}
var token = location.pathname.split('/').filter(Boolean).pop();
var msg = document.getElementById('msg');
var pwChart = null;
var pUnit = 'jin';
function pLabel(){ return pUnit === 'kg' ? '公斤' : '斤'; }
function pDisplay(kg){ return pUnit === 'jin' ? Math.round(kg*2*10)/10 : kg; }
function pKg(v){ v = parseFloat(v); return pUnit === 'jin' ? v/2 : v; }

async function loadInfo() {
  try {
    var d = await api('/api/public/weight/' + token);
    pUnit = d.weight_unit || 'jin';
    document.getElementById('memberName').textContent = d.member.name;
    document.getElementById('streakTitle').textContent = d.title;
    document.getElementById('monthDays').textContent = '本月已打卡 ' + d.monthDays + ' 天';
    document.getElementById('todayDate').value = d.today;
    document.getElementById('weightLabel').textContent = '今日体重(' + pLabel() + ')';
    if (d.todayWeight != null) document.getElementById('weight').value = pDisplay(d.todayWeight);
    document.getElementById('content').style.display = 'block';
    drawMini(d.records);
  } catch(e) {
    document.getElementById('content').innerHTML = '<p class="msg err" style="display:block;">' + esc(e.message) + '</p>';
  }
}
function drawMini(records) {
  var el = document.getElementById('miniChart');
  if (!el || !records.length) return;
  var labels = records.map(function(r){ return r.record_date; });
  var data = records.map(function(r){ return pDisplay(r.weight); });
  if (pwChart) pwChart.destroy();
  pwChart = new Chart(el, { type:'line', data:{ labels: labels, datasets:[{ label:'体重('+pLabel()+')', data: data, borderColor:'#667eea', tension:.3 }] },
    options:{ plugins:{ legend:{ display:false } } } });
}
document.getElementById('wForm').addEventListener('submit', async function(e){
  e.preventDefault();
  try {
    await api('/api/public/weight/' + token, { method:'POST', body:{ weight: pKg(document.getElementById('weight').value) } });
    showMsg(msg, '今日体重已记录！', true);
    await loadInfo();
  } catch(err){ showMsg(msg, err.message, false); }
});
loadInfo();
`;

// 资产报表页 JS
const ASSET_JS = `
${COMMON_JS}
bindLogout();
bindModal();
var wallets = [];
var TYPE_LABEL = { bank:'银行卡', alipay:'支付宝', wechat:'微信', investment:'投资', credit:'信用支付', cash:'现金' };
var nwChart = null, csChart = null;
function curMonth(){ var d=new Date(Date.now()+8*3600*1000); return d.toISOString().slice(0,7); }

var fullReport = null, fullRecords = [];

async function loadAll() {
  var d = await api('/api/asset/report');
  wallets = d.wallets;
  fullReport = d.report;
  fullRecords = d.records;
  renderWallets(d.wallets);
  renderSummary(d.report, d.goal, d.year);
  applyAssetFilter();
}
// 按月区间过滤图表与记录表（汇总卡片始终显示最新月, 不受筛选影响）
function applyAssetFilter() {
  var s = document.getElementById('afStart') ? document.getElementById('afStart').value : '';
  var e = document.getElementById('afEnd') ? document.getElementById('afEnd').value : '';
  var inRange = function(m){ if (s && m < s) return false; if (e && m > e) return false; return true; };
  var months = fullReport.months.filter(inRange);
  var idx = fullReport.months.map(function(m,i){ return inRange(m) ? i : -1; }).filter(function(i){ return i>=0; });
  var report = {
    months: months,
    netWorthSeries: idx.map(function(i){ return fullReport.netWorthSeries[i]; }),
    consumeSeries: idx.map(function(i){ return fullReport.consumeSeries[i]; })
  };
  drawCharts(report);
  renderMonthTable(wallets, fullRecords.filter(function(r){ return inRange(r.month); }));
}
function renderWallets(list) {
  var tb = document.getElementById('walletTbody');
  tb.innerHTML = list.map(function(w){
    return '<tr><td data-label="类型">' + TYPE_LABEL[w.type] + (w.type==='credit'?' <span class="tag disabled">负债</span>':'') + '</td>' +
      '<td data-label="名称">' + esc(w.name) + '</td>' +
      '<td data-label="操作"><div class="dropdown"><button class="btn sm" onclick="toggleDropdown(this)">⋯ 操作</button>' +
      '<div class="dropdown-menu">' +
        '<button onclick="wRec(' + w.id + ",'" + w.type + "'" + ')">录入本月</button>' +
        '<button onclick="wEdit(' + w.id + ')">编辑</button>' +
        '<button onclick="wShare(' + w.id + ')">录入链接</button>' +
        '<button class="danger" onclick="wDel(' + w.id + ')">删除</button>' +
      '</div></div></td></tr>';
  }).join('') || '<tr><td colspan="3" class="muted">暂无钱包</td></tr>';
}
function renderSummary(report, goal, year) {
  document.getElementById('sAssets').textContent = report.latest.assets;
  document.getElementById('sDebt').textContent = report.latest.debt;
  document.getElementById('sNet').textContent = report.latest.netWorth;
  document.getElementById('sMonth').textContent = report.latestMonth || '—';
  var gbox = document.getElementById('goalBox');
  if (goal) {
    gbox.innerHTML = '<b>' + year + ' 年度目标：</b>' + goal.target +
      ' 元 · 当前 ' + goal.current + ' · 还差 <b style="color:#cf1322;">' + goal.remaining + '</b>' +
      ' · 进度 ' + goal.progress + '%';
  } else {
    gbox.innerHTML = '<span class="muted">未设置 ' + year + ' 年度目标</span>';
  }
}
function drawCharts(report) {
  var opts = { plugins:{ legend:{ display:false } } };
  if (nwChart) nwChart.destroy();
  nwChart = new Chart(document.getElementById('netChart'), {
    type:'line', data:{ labels: report.months, datasets:[{ label:'净资产', data: report.netWorthSeries, borderColor:'#667eea', tension:.3 }] },
    options:{ plugins:{ legend:{ display:false } }, scales:{ y:{ title:{ display:true, text:'净资产(元)' } } } } });
  if (csChart) csChart.destroy();
  csChart = new Chart(document.getElementById('consumeChart'), {
    type:'bar', data:{ labels: report.months, datasets:[{ label:'消费', data: report.consumeSeries, backgroundColor:'#faad14' }] },
    options:{ plugins:{ legend:{ display:false } }, scales:{ y:{ title:{ display:true, text:'消费(元, 环比余额减少)' } } } } });
}
function renderMonthTable(wlist, records) {
  var nameOf = {}; wlist.forEach(function(w){ nameOf[w.id] = w.name; });
  var tb = document.getElementById('recTbody');
  var sorted = records.slice().sort(function(a,b){ return b.month < a.month ? -1 : 1; });
  tb.innerHTML = sorted.map(function(r){
    return '<tr><td data-label="月份">' + r.month + '</td>' +
      '<td data-label="钱包">' + esc(nameOf[r.wallet_id]||'') + '</td>' +
      '<td data-label="金额">' + r.balance + (r.principal||r.profit ? ' <span class="muted">(本金'+r.principal+'/收益'+r.profit+')</span>' : '') + '</td></tr>';
  }).join('') || '<tr><td colspan="3" class="muted">暂无记录</td></tr>';
}

// 录入本月
window.wRec = function(id, type){
  var w = wallets.filter(function(x){return x.id===id;})[0];
  var fields = type === 'investment'
    ? '<label>当前总资产(元)</label><input id="fTotal" type="number" step="0.01">' +
      '<label>持有收益(元)</label><input id="fProfit" type="number" step="0.01">' +
      '<p class="muted" id="principalHint">本金将自动计算 = 总资产 − 收益</p>'
    : '<label>本月余额(元)</label><input id="fBalance" type="number" step="0.01">';
  openModal('录入本月 · ' + w.name + ' (' + curMonth() + ')',
    fields + '<div style="margin-top:12px;"><button class="btn" id="recConfirm">保存</button> <button class="btn gray" onclick="closeModal()">取消</button></div>');
  if (type === 'investment') {
    var calc = function(){
      var t = parseFloat(document.getElementById('fTotal').value)||0;
      var p = parseFloat(document.getElementById('fProfit').value)||0;
      document.getElementById('principalHint').textContent = '本金（自动）= ' + Math.round((t-p)*100)/100 + ' 元';
    };
    document.getElementById('fTotal').addEventListener('input', calc);
    document.getElementById('fProfit').addEventListener('input', calc);
  }
  document.getElementById('recConfirm').addEventListener('click', async function(){
    var payload = { wallet_id: id };
    if (type === 'investment') { payload.total = document.getElementById('fTotal').value; payload.profit = document.getElementById('fProfit').value; }
    else payload.balance = document.getElementById('fBalance').value;
    try { await api('/api/asset/records', { method:'POST', body: payload }); closeModal(); await loadAll(); }
    catch(e){ alert(e.message); }
  });
};
window.wEdit = function(id){
  var w = wallets.filter(function(x){return x.id===id;})[0];
  var opts = Object.keys(TYPE_LABEL).map(function(k){ return '<option value="'+k+'"'+(k===w.type?' selected':'')+'>'+TYPE_LABEL[k]+'</option>'; }).join('');
  openModal('编辑钱包',
    '<label>类型</label><select id="eType">' + opts + '</select>' +
    '<label>名称</label><input id="eName" value="' + esc(w.name) + '">' +
    '<div style="margin-top:12px;"><button class="btn" id="eConfirm">保存</button> <button class="btn gray" onclick="closeModal()">取消</button></div>');
  document.getElementById('eConfirm').addEventListener('click', async function(){
    try { await api('/api/asset/wallets/' + id, { method:'PUT', body:{ type: document.getElementById('eType').value, name: document.getElementById('eName').value } }); closeModal(); await loadAll(); }
    catch(e){ alert(e.message); }
  });
};
window.wDel = async function(id){
  if (!confirm('删除该钱包?')) return;
  try { await api('/api/asset/wallets/' + id, { method:'DELETE' }); await loadAll(); } catch(e){ alert(e.message); }
};
window.wShare = async function(id){
  try {
    var d = await api('/api/asset/wallets/' + id + '/share-link');
    openModal('免密录入链接',
      '<p class="muted">此链接长期有效，打开无需登录即可录入该钱包当月金额。</p>' +
      '<input id="aShareUrl" value="' + esc(d.link) + '" readonly style="margin-bottom:8px;">' +
      '<button class="btn" onclick="aCopy()">复制链接</button>');
  } catch(e){ alert(e.message); }
};
window.aCopy = function(){ var el=document.getElementById('aShareUrl'); el.select(); try{document.execCommand('copy');alert('已复制');}catch(e){alert('请手动复制');} };

document.getElementById('walletAdd').addEventListener('click', function(){
  var opts = Object.keys(TYPE_LABEL).map(function(k){ return '<option value="'+k+'">'+TYPE_LABEL[k]+'</option>'; }).join('');
  openModal('新建钱包',
    '<label>类型</label><select id="nType">' + opts + '</select>' +
    '<label>名称（如：AA的招商银行）</label><input id="nName">' +
    '<div style="margin-top:12px;"><button class="btn" id="nConfirm">创建</button> <button class="btn gray" onclick="closeModal()">取消</button></div>');
  document.getElementById('nConfirm').addEventListener('click', async function(){
    try { await api('/api/asset/wallets', { method:'POST', body:{ type: document.getElementById('nType').value, name: document.getElementById('nName').value } }); closeModal(); await loadAll(); }
    catch(e){ alert(e.message); }
  });
});
document.getElementById('goalSave').addEventListener('click', async function(){
  try { await api('/api/asset/goal', { method:'PUT', body:{ target_amount: document.getElementById('goalInput').value } }); await loadAll(); alert('目标已保存'); }
  catch(e){ alert(e.message); }
});

// 时间筛选（按月, 默认本年）
function initAssetFilter() {
  var sel = document.getElementById('afPreset');
  function applyPreset(){
    var r = monthRangeByPreset(sel.value);
    document.getElementById('afStart').value = r[0];
    document.getElementById('afEnd').value = r[1];
    applyAssetFilter();
  }
  sel.addEventListener('change', applyPreset);
  document.getElementById('afStart').addEventListener('change', applyAssetFilter);
  document.getElementById('afEnd').addEventListener('change', applyAssetFilter);
  applyPreset();
}
// 推送配置（资产月报）
async function loadPush() {
  var chs = await api('/api/notify/channels');
  var opts = '<option value="">（选择渠道）</option>' + chs.channels.map(function(c){ return '<option value="'+c.id+'">'+esc(c.name)+' ['+c.type+']</option>'; }).join('');
  document.getElementById('pushCh').innerHTML = opts;
  var d = await api('/api/push/asset');
  document.getElementById('pushCh').value = d.config.channel_id || '';
  document.getElementById('pushFmt').value = d.config.format || 'text';
  document.getElementById('pushDay').value = d.config.day != null ? d.config.day : 15;
  document.getElementById('pushHour').value = d.config.hour != null ? d.config.hour : 9;
  document.getElementById('pushEn').checked = !!d.config.enabled;
}
document.getElementById('pushSave').addEventListener('click', async function(){
  try {
    await api('/api/push/asset', { method:'PUT', body:{
      channel_id: document.getElementById('pushCh').value || null,
      format: document.getElementById('pushFmt').value,
      day: document.getElementById('pushDay').value,
      hour: document.getElementById('pushHour').value,
      enabled: document.getElementById('pushEn').checked
    }});
    alert('推送配置已保存');
  } catch(e){ alert(e.message); }
});

(async function(){
  try { await loadAll(); initAssetFilter(); await loadPush(); }
  catch(e){ if (String(e.message).indexOf('登录')>=0) location.href='/login'; else alert(e.message); }
})();
`;

// 资产免密录入公开页 JS
const PUBLIC_ASSET_JS = `
${COMMON_JS}
var token = location.pathname.split('/').filter(Boolean).pop();
var msg = document.getElementById('msg');
var TYPE_LABEL = { bank:'银行卡', alipay:'支付宝', wechat:'微信', investment:'投资', credit:'信用支付', cash:'现金' };
var wType = '';

async function loadInfo() {
  try {
    var d = await api('/api/public/asset/' + token);
    wType = d.wallet.type;
    document.getElementById('walletName').textContent = d.wallet.name + ' (' + TYPE_LABEL[d.wallet.type] + ')';
    document.getElementById('monthLabel').textContent = d.month + ' 月';
    var box = document.getElementById('fields');
    if (wType === 'investment') {
      box.innerHTML = '<label>当前总资产(元)</label><input id="fTotal" type="number" step="0.01" value="' + (d.current?d.current.balance:'') + '">' +
        '<label>持有收益(元)</label><input id="fProfit" type="number" step="0.01" value="' + (d.current?d.current.profit:'') + '">' +
        '<p class="muted" id="pHint">本金将自动计算 = 总资产 − 收益</p>';
    } else {
      box.innerHTML = '<label>本月余额(元)</label><input id="fBalance" type="number" step="0.01" value="' + (d.current?d.current.balance:'') + '">';
    }
    document.getElementById('content').style.display = 'block';
  } catch(e) {
    document.getElementById('content').innerHTML = '<p class="msg err" style="display:block;">' + esc(e.message) + '</p>';
  }
}
document.getElementById('aForm').addEventListener('submit', async function(e){
  e.preventDefault();
  var payload = {};
  if (wType === 'investment') { payload.total = document.getElementById('fTotal').value; payload.profit = document.getElementById('fProfit').value; }
  else payload.balance = document.getElementById('fBalance').value;
  try { await api('/api/public/asset/' + token, { method:'POST', body: payload }); showMsg(msg, '本月记录已保存！', true); }
  catch(err){ showMsg(msg, err.message, false); }
});
loadInfo();
`;

export {
  COMMON_JS, LOGIN_JS, DASHBOARD_JS, ADMIN_JS, SETUP_JS, MONITOR_JS, FUND_JS,
  PUBLIC_BUY_JS, WEIGHT_JS, PUBLIC_WEIGHT_JS, SETTINGS_JS, ASSET_JS, PUBLIC_ASSET_JS, CHANNELS_JS
};
