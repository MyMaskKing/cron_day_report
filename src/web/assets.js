/**
 * 前端通用 JS 片段（作为字符串注入页面）
 */

// 通用 API 请求与工具函数（所有页面共用）
const COMMON_JS = `
var _loadingCount = 0;
function showLoading(text) {
  _loadingCount++;
  var el = document.getElementById('globalLoading');
  if (el) el.style.display = 'flex';
  var t = document.getElementById('loadingText');
  if (t) t.textContent = text || '加载中…';
}
function hideLoading() {
  _loadingCount = Math.max(0, _loadingCount - 1);
  if (_loadingCount === 0) {
    var el = document.getElementById('globalLoading');
    if (el) el.style.display = 'none';
  }
}
// setLoadingText: 不改变计数, 仅更新提示文字(用于同一请求内多阶段说明)
function setLoadingText(text) {
  var t = document.getElementById('loadingText');
  if (t && _loadingCount > 0) t.textContent = text;
}
async function api(path, opts) {
  opts = opts || {};
  showLoading(opts.loadingText);
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
// 多选勾选面板：点击展开，内含复选框，收起时按钮文字显示已选项
// container 为 .multi-pick 元素；min/max 决定生成选项区间；vals 初始已选数组
function initMultiPick(container, min, max, vals, labelFn) {
  var selected = {};
  (vals || []).forEach(function(v){ selected[v] = true; });
  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'mp-btn';
  var menu = document.createElement('div');
  menu.className = 'mp-menu';
  for (var i = min; i <= max; i++) {
    (function(n){
      var lbl = document.createElement('label');
      lbl.className = 'mp-item';
      var cb = document.createElement('input');
      cb.type = 'checkbox'; cb.value = n; cb.checked = !!selected[n];
      cb.addEventListener('change', function(){
        if (cb.checked) selected[n] = true; else delete selected[n];
        refresh();
      });
      lbl.appendChild(cb);
      var span = document.createElement('span');
      span.textContent = labelFn ? labelFn(n) : String(n);
      lbl.appendChild(span);
      menu.appendChild(lbl);
    })(i);
  }
  function values() {
    return Object.keys(selected).map(function(k){ return parseInt(k,10); }).filter(function(n){ return !isNaN(n); }).sort(function(a,b){ return a-b; });
  }
  function refresh() {
    var vs = values();
    btn.textContent = vs.length ? (labelFn ? vs.map(labelFn).join('、') : vs.join(',')) : '未选择';
  }
  btn.addEventListener('click', function(e){
    e.stopPropagation();
    var open = menu.classList.contains('show');
    document.querySelectorAll('.mp-menu.show').forEach(function(m){ m.classList.remove('show'); });
    if (!open) menu.classList.add('show');
  });
  container.innerHTML = '';
  container.appendChild(btn);
  container.appendChild(menu);
  refresh();
  return { getValues: values, getString: function(){ return values().join(','); } };
}
document.addEventListener('click', function(e){
  if (!e.target.closest('.multi-pick')) {
    document.querySelectorAll('.mp-menu.show').forEach(function(m){ m.classList.remove('show'); });
  }
});

// 动态列表多选面板：同 initMultiPick, 但选项来自 items 数组([{value,label}])而非数字区间
// container 为 .multi-pick 元素；vals 初始已选 value 数组
function initListPick(container, items, vals) {
  var selected = {};
  (vals || []).forEach(function(v){ selected[v] = true; });
  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'mp-btn';
  var menu = document.createElement('div');
  menu.className = 'mp-menu';
  var labelOf = {};
  (items || []).forEach(function(it){
    labelOf[it.value] = it.label;
    var lbl = document.createElement('label');
    lbl.className = 'mp-item';
    var cb = document.createElement('input');
    cb.type = 'checkbox'; cb.value = it.value; cb.checked = !!selected[it.value];
    cb.addEventListener('change', function(){
      if (cb.checked) selected[it.value] = true; else delete selected[it.value];
      refresh();
    });
    lbl.appendChild(cb);
    var span = document.createElement('span');
    span.textContent = it.label;
    lbl.appendChild(span);
    menu.appendChild(lbl);
  });
  function values() {
    return Object.keys(selected).map(function(k){ return parseInt(k,10); }).filter(function(n){ return !isNaN(n); });
  }
  function refresh() {
    var vs = values();
    btn.textContent = vs.length ? vs.map(function(v){ return labelOf[v] || v; }).join('、') : '未选择';
  }
  btn.addEventListener('click', function(e){
    e.stopPropagation();
    var open = menu.classList.contains('show');
    document.querySelectorAll('.mp-menu.show').forEach(function(m){ m.classList.remove('show'); });
    if (!open) menu.classList.add('show');
  });
  container.innerHTML = '';
  container.appendChild(btn);
  container.appendChild(menu);
  refresh();
  return { getValues: values, getString: function(){ return values().join(','); } };
}

// 推送格式选项按渠道类型联动：email 只支持 text/html；wechat/webhook 额外支持 markdown
function fmtOptionsFor(type) {
  var base = [['text','text'],['html','html']];
  if (type === 'wechat' || type === 'webhook') base.push(['markdown','markdown']);
  return base.map(function(o){ return '<option value="'+o[0]+'">'+o[1]+'</option>'; }).join('');
}
// 从渠道下拉当前选中项文本尾部 [type] 解析渠道类型
function channelTypeOf(chSel) {
  var opt = chSel.selectedOptions && chSel.selectedOptions[0];
  var m = opt && opt.textContent.match(/\\[(\\w+)\\]\\s*$/);
  return m ? m[1] : '';
}
// 绑定：渠道变化时重建格式下拉，尽量保留原选中值（新列表不含则回退 text）
function bindFormatByChannel(chSel, fmtSel) {
  function refresh() {
    var prev = fmtSel.value;
    fmtSel.innerHTML = fmtOptionsFor(channelTypeOf(chSel));
    fmtSel.value = Array.prototype.some.call(fmtSel.options, function(o){ return o.value === prev; }) ? prev : 'text';
  }
  chSel.addEventListener('change', refresh);
  return refresh;
}
// 免密页快速登录：点击按钮，按当前页 token 签发正式会话并跳转对应模块
// kind ∈ fund | weight | asset | weight-report | asset-report；token 取路径末段
function bindQuickLogin(kind) {
  var btn = document.getElementById('quickLoginBtn');
  if (!btn) return;
  var tk = location.pathname.split('/').filter(Boolean).pop();
  btn.addEventListener('click', async function(e) {
    e.preventDefault();
    try {
      var r = await api('/api/public/quick-login/' + kind + '/' + tk, { method: 'POST' });
      location.href = r.redirect || '/dashboard';
    } catch (err) { alert(err.message); }
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

// 全局时区设置
async function loadTimezone() {
  try {
    var d = await api('/api/admin/settings/timezone');
    document.getElementById('tzInput').value = d.tz_offset;
  } catch (err) { /* 忽略 */ }
}
var tzSave = document.getElementById('tzSave');
if (tzSave) tzSave.addEventListener('click', async function(){
  var stMsg = document.getElementById('stMsg');
  try {
    var r = await api('/api/admin/settings/timezone', { method: 'PUT', body: { tz_offset: document.getElementById('tzInput').value } });
    showMsg(stMsg, r.message || '已保存', true);
  } catch (err) { showMsg(stMsg, err.message, false); }
});
loadTimezone();

// 全局站点地址设置
async function loadBaseUrl() {
  try {
    var d = await api('/api/admin/settings/base-url');
    document.getElementById('baseUrlInput').value = d.base_url || '';
  } catch (err) { /* 忽略 */ }
}
var baseUrlSave = document.getElementById('baseUrlSave');
if (baseUrlSave) baseUrlSave.addEventListener('click', async function(){
  var stMsg = document.getElementById('stMsg');
  try {
    var r = await api('/api/admin/settings/base-url', { method: 'PUT', body: { base_url: document.getElementById('baseUrlInput').value } });
    document.getElementById('baseUrlInput').value = r.base_url || '';
    showMsg(stMsg, r.message || '已保存', true);
  } catch (err) { showMsg(stMsg, err.message, false); }
});
loadBaseUrl();
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
  document.getElementById('tStandalone').checked = t.standalone === 1 || t.standalone === true;
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
    enabled: document.getElementById('tEnabled').checked,
    standalone: document.getElementById('tStandalone').checked
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

// 监控推送时间配置
var mpHourPick = null;
async function loadMonitorPush() {
  var chs = await api('/api/notify/channels');
  var d = await api('/api/push/monitor');
  mpHourPick = initMultiPick(document.getElementById('mpHour'), 0, 23, d.config.hours || [6], function(n){ return n + '点'; });
  document.getElementById('mpEn').checked = !!d.config.enabled;
}
var mpSave = document.getElementById('mpSave');
if (mpSave) mpSave.addEventListener('click', async function(){
  try {
    await api('/api/push/monitor', { method:'PUT', body:{
      hours: mpHourPick ? mpHourPick.getString() : '6',
      enabled: document.getElementById('mpEn').checked
    }});
    alert('定时配置已保存');
  } catch(e){ alert(e.message); }
});
var mpSend = document.getElementById('mpSend');
if (mpSend) mpSend.addEventListener('click', async function(){
  var btn = this; btn.disabled = true; btn.textContent = '执行中...';
  try { var r = await api('/api/monitor/run', { method:'POST' }); alert(r.message || '执行完成'); }
  catch(e){ alert(e.message); }
  finally { btn.disabled = false; btn.textContent = '立即执行并推送'; }
});

(async function(){
  try { await loadChannels(); await loadTasks(); await loadMonitorPush(); }
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
var chart = null;   // 饼图
var profitChart = null;
window._profitSeries = [];    // 每日总收益全量，供过滤用

function sign(n){ return (n>=0?'+':'') + n; }
function colorOf(n){ return n>=0 ? '#cf1322' : '#389e0d'; }

// ---------- 报表 ----------
async function loadReport() {
  var data = await api('/api/fund/report', { loadingText: '正在拉取基金实时净值…' });
  var t = data.totals;
  document.getElementById('sumCost').textContent = t.cost;
  document.getElementById('sumValue').textContent = t.value;
  var pe = document.getElementById('sumProfit');
  pe.textContent = sign(t.profit); pe.style.color = colorOf(t.profit);
  var re = document.getElementById('sumRate');
  re.textContent = sign(t.rate) + '%'; re.style.color = colorOf(t.rate);

  // 明细表（按创建时间倒序）
  var tb = document.getElementById('fundTbody');
  var items = data.items.slice().sort(function(a,b){
    return (b.created_at||'').localeCompare(a.created_at||'');
  });
  tb.innerHTML = items.map(function(it){
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
  await loadProfitHistory();
}

function applyProfitFilter() {
  var rng = document.getElementById('profitRange').value;
  var labels = [], vals = [];
  var now = new Date(Date.now()+8*3600*1000);
  var cutoff = '';
  if (rng==='7d') { cutoff = new Date(now.getTime()-7*86400000).toISOString().slice(0,10); }
  else if (rng==='month') { cutoff = now.toISOString().slice(0,7); } // YYYY-MM
  else if (rng==='year') { cutoff = now.toISOString().slice(0,4); }  // YYYY

  for (var i=0;i<window._profitSeries.length;i++) {
    var s = window._profitSeries[i];
    if (rng==='7d' && s.date < cutoff) continue;
    if (rng!=='all' && rng!=='7d' && s.date.slice(0,cutoff.length)!==cutoff) continue;
    labels.push(s.date.slice(5)); // MM-DD
    vals.push(s.profit);
  }
  // 空数据：隐藏曲线、显示提示
  var wrap = document.getElementById('profitChartWrap');
  var empty = document.getElementById('profitEmpty');
  if (!labels.length) {
    if (wrap) wrap.style.display = 'none';
    if (empty) empty.style.display = 'block';
  } else {
    if (wrap) wrap.style.display = 'block';
    if (empty) empty.style.display = 'none';
  }
  // 画曲线
  var el = document.getElementById('profitChart');
  if (profitChart) profitChart.destroy();
  if (el && labels.length) profitChart = new Chart(el, {
    type:'line', data:{labels:labels, datasets:[{label:'总收益',data:vals,borderColor:'#667eea',tension:0.3}]},
    options:{ responsive:true, maintainAspectRatio:true, aspectRatio:2.5, plugins:{legend:{display:false}} }
  });
  // 填表（日期倒序）
  var rows = [];
  for (var i=window._profitSeries.length-1;i>=0;i--) {
    var s = window._profitSeries[i];
    if (rng==='7d' && s.date < cutoff) continue;
    if (rng!=='all' && rng!=='7d' && s.date.slice(0,cutoff.length)!==cutoff) continue;
    var dc = s.delta != null ? (s.delta>=0?'#cf1322':'#389e0d') : '#999';
    var dt = s.delta != null ? sign(s.delta) : '—';
    rows.push('<tr><td data-label="日期">'+s.date+'</td><td data-label="总收益" style="color:'+colorOf(s.profit)+'">'+sign(s.profit)+' 元</td><td data-label="较前一天增长" style="color:'+dc+'">'+dt+' 元</td></tr>');
  }
  var tb = document.getElementById('profitTbody');
  tb.innerHTML = rows.join('') || '<tr><td colspan="3" data-label="提示" class="muted">暂无数据</td></tr>';
}

async function loadProfitHistory() {
  var data = await api('/api/fund/profit-history');
  window._profitSeries = data.series || [];
  applyProfitFilter();
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
  var id = f.id || '';
  var html =
    '<label>基金代码（6位数字）</label><input id="fCode" placeholder="如 000001" value="' + esc(f.code||'') + '">' +
    '<div class="row">' +
      '<div><label>持有份额</label><input id="fShares" type="number" step="0.01" placeholder="如 1000" value="' + (f.shares != null ? f.shares : '') + '"></div>' +
      '<div><label>成本净值（买入时单位净值）</label><input id="fCostNav" type="number" step="0.0001" placeholder="如 1.2345" value="' + (f.cost_nav != null ? f.cost_nav : '') + '"></div>' +
    '</div>' +
    '<div style="margin-top:12px;"><button class="btn" id="fSave">保存</button> ' +
    '<button class="btn gray" onclick="closeModal()">取消</button></div>';
  openModal(id ? '修改持仓' : '添加持仓', html);
  document.getElementById('fSave').addEventListener('click', async function(){
    var payload = {
      code: document.getElementById('fCode').value.trim(),
      shares: document.getElementById('fShares').value,
      cost_nav: document.getElementById('fCostNav').value
    };
    try {
      if (id) await api('/api/fund/' + id, { method:'PUT', body: payload });
      else await api('/api/fund', { method:'POST', body: payload });
      closeModal();
      await loadReport();
    } catch(e){ alert(e.message); }
  });
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
document.getElementById('fNew').addEventListener('click', function(){ fundForm({}); });

// ---------- 日报配置（走通用 push API, module=fund）----------
var rcChannelPick = null;
async function loadReportConfig() {
  var chData = await api('/api/notify/channels');
  var items = chData.channels.map(function(c){ return { value: c.id, label: c.name + ' [' + c.type + ']' }; });

  var data = await api('/api/push/fund');
  var cfg = data.config;
  rcChannelPick = initListPick(document.getElementById('rcChannel'), items, cfg.channel_ids || []);
  document.getElementById('rcFormat').value = cfg.format || 'text';
  document.getElementById('rcEnabled').checked = !!cfg.enabled;
  rcHourPick = initMultiPick(document.getElementById('rcHour'), 0, 23, cfg.hours || [15], function(n){ return n + '点'; });
}
var rcHourPick = null;
document.getElementById('rcSave').addEventListener('click', async function(){
  var payload = {
    channel_ids: rcChannelPick ? rcChannelPick.getValues() : [],
    format: document.getElementById('rcFormat').value,
    hours: rcHourPick ? rcHourPick.getString() : '15',
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
  // 绑定筛选（select 在 loadReport 时 DOM 已就绪）
  document.getElementById('profitRange').addEventListener('change', applyProfitFilter);
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
bindQuickLogin('fund');
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
    return '<span class="tag user" style="margin:2px 4px;padding:4px 10px;">' +
      '<a href="#" onclick="selMember(' + m.id + ');return false;" style="color:inherit;text-decoration:none;">' + esc(m.name) + '</a>' +
      ' <a href="#" onclick="mRename(' + m.id + ",'" + esc(m.name).replace(/'/g,'') + "'" + ');return false;" style="margin-left:4px;">改名</a>' +
      ' <a href="#" onclick="mShare(' + m.id + ');return false;" style="margin-left:4px;">链接</a>' +
      ' <a href="#" onclick="mDel(' + m.id + ');return false;" style="color:#cf1322;">×</a></span>';
  }).join('') || '<span class="muted">暂无成员</span>';
}
function selMember(id) {
  var sel = document.getElementById('recMember');
  if (sel) sel.value = id;
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
  // 计算每条记录较同成员上一条(时间更早)的增减：按成员分组升序算差值, 存 id->delta
  var deltaOf = {};
  var byMember = {};
  records.forEach(function(r){ (byMember[r.member_id] = byMember[r.member_id] || []).push(r); });
  Object.keys(byMember).forEach(function(mid){
    var arr = byMember[mid].slice().sort(function(a,b){ return (a.record_date||'').localeCompare(b.record_date||''); });
    for (var i = 1; i < arr.length; i++) deltaOf[arr[i].id] = arr[i].weight - arr[i-1].weight;
  });
  var sorted = records.slice().sort(function(a,b){ return (b.record_date||'').localeCompare(a.record_date||''); });
  tb.innerHTML = sorted.map(function(r){
    return '<tr><td data-label="日期">' + esc(r.record_date) + '</td>' +
      '<td data-label="成员">' + esc(nameOf[r.member_id]||'') + '</td>' +
      '<td data-label="体重">' + toDisplay(r.weight) + ' ' + unitLabel() + '</td>' +
      '<td data-label="较上次">' + deltaCell(deltaOf[r.id]) + '</td>' +
      '<td data-label="操作"><button class="btn sm gray" onclick="recEdit(' + r.id + ',' + r.weight + ",'" + r.record_date + "'" + ')">改</button> ' +
      '<button class="btn sm danger" onclick="recDel(' + r.id + ')">删</button></td></tr>';
  }).join('') || '<tr><td colspan="5" class="muted">暂无记录</td></tr>';
}
// 增减单元格：增重红色加粗↑, 减重绿色↓, 无上一条显示 —
function deltaCell(deltaKg) {
  if (deltaKg == null) return '<span class="muted">—</span>';
  var d = toDisplay(Math.abs(deltaKg));
  if (deltaKg > 0) return '<span style="color:#cf1322;font-weight:700;">↑ +' + d + ' ' + unitLabel() + '</span>';
  if (deltaKg < 0) return '<span style="color:#389e0d;">↓ -' + d + ' ' + unitLabel() + '</span>';
  return '<span class="muted">0</span>';
}

window.mDel = async function(id){
  if (!confirm('删除该成员及其记录?')) return;
  try { await api('/api/weight/members/' + id, { method:'DELETE' }); await loadAll(); } catch(e){ alert(e.message); }
};
window.mRename = function(id, curName){
  openModal('修改成员名',
    '<label>成员名称</label><input id="mReName" value="' + esc(curName) + '">' +
    '<div style="margin-top:12px;"><button class="btn" id="mReConfirm">保存</button> <button class="btn gray" onclick="closeModal()">取消</button></div>');
  document.getElementById('mReConfirm').addEventListener('click', async function(){
    var name = document.getElementById('mReName').value;
    try { await api('/api/weight/members/' + id, { method:'PUT', body:{ name: name } }); closeModal(); await loadAll(); }
    catch(e){ alert(e.message); }
  });
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
var wPushHourPick = null;
var wPushChannelPick = null;
async function loadPush() {
  var chs = await api('/api/notify/channels');
  var items = chs.channels.map(function(c){ return { value: c.id, label: c.name + ' [' + c.type + ']' }; });
  var d = await api('/api/push/weight');
  wPushChannelPick = initListPick(document.getElementById('pushCh'), items, d.config.channel_ids || []);
  document.getElementById('pushFmt').value = d.config.format || 'text';
  wPushHourPick = initMultiPick(document.getElementById('pushHour'), 0, 23, d.config.hours || [10], function(n){ return n + '点'; });
  document.getElementById('pushEn').checked = !!d.config.enabled;
}
var pushSave = document.getElementById('pushSave');
if (pushSave) pushSave.addEventListener('click', async function(){
  try {
    await api('/api/push/weight', { method:'PUT', body:{
      channel_ids: wPushChannelPick ? wPushChannelPick.getValues() : [],
      format: document.getElementById('pushFmt').value,
      hours: wPushHourPick ? wPushHourPick.getString() : '10',
      enabled: document.getElementById('pushEn').checked
    }});
    alert('推送配置已保存');
  } catch(e){ alert(e.message); }
});
var pushSend = document.getElementById('pushSend');
if (pushSend) pushSend.addEventListener('click', async function(){
  var btn = this; btn.disabled = true; btn.textContent = '推送中...';
  try { var r = await api('/api/push/weight/send', { method:'POST' }); alert(r.message || '已推送'); }
  catch(e){ alert(e.message); }
  finally { btn.disabled = false; btn.textContent = '立即推送'; }
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
    if (d.todayWeight != null) {
      // 今日已录入：显示数据、锁定输入、隐藏提交按钮，不允许重复录入
      document.getElementById('weight').value = pDisplay(d.todayWeight);
      document.getElementById('weight').disabled = true;
      var sb = document.querySelector('#wForm button[type=submit]');
      if (sb) sb.style.display = 'none';
      showMsg(msg, '今日已录入：' + pDisplay(d.todayWeight) + ' ' + pLabel() + '，不可重复录入', true);
    }
    document.getElementById('content').style.display = 'block';
    drawMini(d.records);
    renderHist(d.records);
  } catch(e) {
    document.getElementById('content').innerHTML = '<p class="msg err" style="display:block;">' + esc(e.message) + '</p>';
  }
}
// 最近记录列表（升序算相邻增减）：增重红色加粗↑, 减重绿色↓
function renderHist(records) {
  var box = document.getElementById('histBox');
  if (!box) return;
  if (!records || !records.length) { box.innerHTML = ''; return; }
  var asc = records.slice().sort(function(a,b){ return (a.record_date||'').localeCompare(b.record_date||''); });
  var recent = asc.slice(-7);
  var rows = recent.map(function(r, i){
    var cell = '<span style="color:#888;">—</span>';
    if (i > 0) {
      var delta = r.weight - recent[i-1].weight;
      var v = pDisplay(Math.abs(delta));
      if (delta > 0) cell = '<span style="color:#cf1322;font-weight:700;">↑ +' + v + ' ' + pLabel() + '</span>';
      else if (delta < 0) cell = '<span style="color:#389e0d;">↓ -' + v + ' ' + pLabel() + '</span>';
      else cell = '<span style="color:#888;">0</span>';
    }
    return '<tr><td data-label="日期" style="padding:4px 0;text-align:left;">' + esc(r.record_date) + '</td>' +
      '<td data-label="体重" style="padding:4px 0;text-align:right;">' + pDisplay(r.weight) + ' ' + pLabel() + '</td>' +
      '<td data-label="较上次" style="padding:4px 0;text-align:right;">' + cell + '</td></tr>';
  }).reverse().join('');
  box.innerHTML = '<div style="color:#888;font-size:13px;margin-bottom:4px;">最近记录</div>' +
    '<table style="width:100%;border-collapse:collapse;font-size:13px;color:#666;">' +
    '<thead><tr><th style="text-align:left;font-weight:600;">日期</th><th style="text-align:right;font-weight:600;">体重</th><th style="text-align:right;font-weight:600;">较上次</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table>';
}
function drawMini(records) {
  var el = document.getElementById('miniChart');
  if (!el || !records.length) return;
  var recent = records.slice(-7);
  var labels = recent.map(function(r){ return r.record_date; });
  var data = recent.map(function(r){ return pDisplay(r.weight); });
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
bindQuickLogin('weight');
`;

// 体重免密报告查看页 JS（曲线图，无需登录）
const WEIGHT_REPORT_JS = `
${COMMON_JS}
var token = location.pathname.split('/').filter(Boolean).pop();
var COLORS = ['#667eea','#f5222d','#52c41a','#faad14','#13c2c2','#722ed1','#eb2f96','#fa8c16'];
(async function(){
  try {
    var d = await api('/api/public/weight-report/' + token);
    var unit = d.weight_unit || 'jin';
    var uLabel = unit === 'kg' ? '公斤' : '斤';
    var disp = function(kg){ return unit === 'jin' ? Math.round(kg*2*10)/10 : kg; };
    // 默认只显示本月记录（本月无数据则回退全部）
    var curMonth = new Date(Date.now() + 8*3600*1000).toISOString().slice(0,7);
    var recs = d.records.filter(function(r){ return (r.record_date||'').slice(0,7) === curMonth; });
    if (!recs.length) recs = d.records;
    var byMember = {};
    d.members.forEach(function(m){ byMember[m.id] = {}; });
    var dates = {};
    recs.forEach(function(r){ if (byMember[r.member_id]) { byMember[r.member_id][r.record_date] = disp(r.weight); dates[r.record_date] = 1; } });
    var labels = Object.keys(dates).sort();
    var datasets = d.members.map(function(m, i){
      return { label: m.name, data: labels.map(function(dt){ return byMember[m.id][dt] != null ? byMember[m.id][dt] : null; }),
        borderColor: COLORS[i % COLORS.length], spanGaps: true, tension: .3 };
    });
    new Chart(document.getElementById('rptChart'), { type:'line', data:{ labels: labels, datasets: datasets },
      options:{ plugins:{ legend:{ position:'top' } }, scales:{ y:{ title:{ display:true, text:'体重('+uLabel+')' } } } } });
    renderRptHist(d.members, d.records, disp, uLabel);
    document.getElementById('content').style.display = 'block';
  } catch(e){ document.getElementById('content').innerHTML = '<p class="msg err" style="display:block;">' + esc(e.message) + '</p>'; }
})();
// 历史记录表格：按成员分组算相邻增减(升序)，展示倒序；增重红色加粗↑，减重绿色↓
function renderRptHist(members, records, disp, uLabel) {
  var box = document.getElementById('rptHist');
  if (!box) return;
  var nameOf = {}; members.forEach(function(m){ nameOf[m.id] = m.name; });
  var deltaOf = {};
  var byMember = {};
  records.forEach(function(r){ (byMember[r.member_id] = byMember[r.member_id] || []).push(r); });
  Object.keys(byMember).forEach(function(mid){
    var arr = byMember[mid].slice().sort(function(a,b){ return (a.record_date||'').localeCompare(b.record_date||''); });
    for (var i = 1; i < arr.length; i++) deltaOf[arr[i].id] = arr[i].weight - arr[i-1].weight;
  });
  var sorted = records.slice().sort(function(a,b){ return (b.record_date||'').localeCompare(a.record_date||''); });
  var rows = sorted.map(function(r){
    var cell = '<span style="color:#888;">—</span>';
    var delta = deltaOf[r.id];
    if (delta != null) {
      var v = disp(Math.abs(delta));
      if (delta > 0) cell = '<span style="color:#cf1322;font-weight:700;">↑ +' + v + ' ' + uLabel + '</span>';
      else if (delta < 0) cell = '<span style="color:#389e0d;">↓ -' + v + ' ' + uLabel + '</span>';
      else cell = '<span style="color:#888;">0</span>';
    }
    return '<tr><td data-label="日期">' + esc(r.record_date) + '</td>' +
      '<td data-label="成员">' + esc(nameOf[r.member_id]||'') + '</td>' +
      '<td data-label="体重">' + disp(r.weight) + ' ' + uLabel + '</td>' +
      '<td data-label="较上次">' + cell + '</td></tr>';
  }).join('') || '<tr><td colspan="4" class="muted">暂无记录</td></tr>';
  box.innerHTML = '<h3 style="margin:0 0 10px;font-size:16px;">历史记录</h3>' +
    '<table><thead><tr><th>日期</th><th>成员</th><th>体重</th><th>较上次</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table>';
}
bindQuickLogin('weight-report');
`;

// 资产免密报告查看页 JS
const ASSET_REPORT_JS = `
${COMMON_JS}
var token = location.pathname.split('/').filter(Boolean).pop();
(async function(){
  try {
    var d = await api('/api/public/asset-report/' + token);
    var r = d.report;
    // 默认只显示本年月份（本年无数据则回退全部）
    var curYear = new Date(Date.now() + 8*3600*1000).toISOString().slice(0,4);
    var idx = r.months.map(function(m, i){ return { m: m, i: i }; }).filter(function(o){ return (o.m||'').slice(0,4) === curYear; });
    if (!idx.length) idx = r.months.map(function(m, i){ return { m: m, i: i }; });
    var months = idx.map(function(o){ return o.m; });
    var netWorthSeries = idx.map(function(o){ return r.netWorthSeries[o.i]; });
    var savingSeries = idx.map(function(o){ return r.savingSeries[o.i]; });
    new Chart(document.getElementById('netChart'), { type:'line',
      data:{ labels: months, datasets:[{ label:'净资产', data: netWorthSeries, borderColor:'#667eea', tension:.3 }] },
      options:{ plugins:{ legend:{ display:false } }, scales:{ y:{ title:{ display:true, text:'净资产(元)' } } } } });
    new Chart(document.getElementById('consumeChart'), { type:'bar',
      data:{ labels: months, datasets:[{ label:'净存', data: savingSeries,
        backgroundColor: function(c){ return c.raw < 0 ? '#cf1322' : '#389e0d'; } }] },
      options:{ plugins:{ legend:{ display:false } }, scales:{ y:{ title:{ display:true, text:'每月净存(元, 负为减少)' } } } } });
    document.getElementById('content').style.display = 'block';
  } catch(e){ document.getElementById('content').innerHTML = '<p class="msg err" style="display:block;">' + esc(e.message) + '</p>'; }
})();
bindQuickLogin('asset-report');
`;

// 基金持仓分布免密报告页 JS（doughnut 饼图，无需登录）
const FUND_REPORT_JS = `
${COMMON_JS}
var token = location.pathname.split('/').filter(Boolean).pop();
var COLORS = ['#667eea','#f5222d','#52c41a','#faad14','#13c2c2','#722ed1','#eb2f96','#fa8c16','#a0d911','#2f54eb'];
function sign(n){ return (n>=0?'+':'') + n; }
(async function(){
  try {
    var d = await api('/api/public/fund-report/' + token);
    // 饼图（持仓分布）
    var labels = d.items.map(function(i){ return i.name; });
    var data = d.items.map(function(i){ return i.value; });
    var bg = labels.map(function(_, i){ return COLORS[i % COLORS.length]; });
    new Chart(document.getElementById('pieChart'), { type:'doughnut',
      data:{ labels: labels, datasets:[{ data: data, backgroundColor: bg }] },
      options:{ plugins:{ legend:{ position:'bottom' } } } });
    // 每日总收益曲线（近 30 天，联动）
    var series = d.profitSeries || [];
    if (series.length) {
      var pl = series.map(function(s){ return s.date.slice(5); });
      var pv = series.map(function(s){ return s.profit; });
      new Chart(document.getElementById('profitChart'), { type:'line',
        data:{ labels: pl, datasets:[{ label:'总收益', data: pv, borderColor:'#667eea', tension:0.3 }] },
        options:{ responsive:true, maintainAspectRatio:true, aspectRatio:2.5, plugins:{ legend:{ display:false } } } });
      // 明细表（日期倒序）
      document.getElementById('profitBox').style.display = 'block';
      var rows = [];
      for (var i=series.length-1;i>=0;i--) {
        var s = series[i], dc = s.delta != null ? (s.delta>=0?'#cf1322':'#389e0d') : '#999';
        var dt = s.delta != null ? sign(s.delta) : '—';
        var pc = s.profit>=0?'#cf1322':'#389e0d';
        rows.push('<tr><td data-label="日期">'+s.date+'</td><td data-label="总收益" style="color:'+pc+'">'+sign(s.profit)+' 元</td><td data-label="较前一天增长" style="color:'+dc+'">'+dt+' 元</td></tr>');
      }
      document.getElementById('profitTbody').innerHTML = rows.join('');
    }
    document.getElementById('content').style.display = 'block';
  } catch(e){ document.getElementById('content').innerHTML = '<p class="msg err" style="display:block;">' + esc(e.message) + '</p>'; }
})();
bindQuickLogin('fund-report');
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
    savingSeries: idx.map(function(i){ return fullReport.savingSeries[i]; })
  };
  drawCharts(report);
  var mtt = fullReport.monthlyTypeTotals || { types: [], rows: [] };
  renderMonthlyTypeTotals({ types: mtt.types, rows: mtt.rows.filter(function(row){ return inRange(row.month); }) });
  renderMonthTable(wallets, fullRecords.filter(function(r){ return inRange(r.month); }));
}
function renderWallets(list) {
  var tb = document.getElementById('walletTbody');
  var month = (fullReport && fullReport.latestMonth) || '';
  // 该钱包在最新月份的合计（同钱包同月多条累加）
  var sumByWallet = {};
  (fullRecords || []).forEach(function(r){
    if (month && r.month === month) sumByWallet[r.wallet_id] = Math.round(((sumByWallet[r.wallet_id]||0) + (r.balance||0)) * 100) / 100;
  });
  var tag = document.getElementById('walletMonthTag');
  if (tag) tag.textContent = month ? '（本月金额统计：' + month + '）' : '';
  var sorted = list.slice().sort(function(a,b){
    if (a.type !== b.type) return (a.type||'').localeCompare(b.type||'');
    if (a.name !== b.name) return (a.name||'').localeCompare(b.name||'');
    return (b.created_at||'').localeCompare(a.created_at||'');
  });
  tb.innerHTML = sorted.map(function(w){
    var amt = sumByWallet[w.id];
    return '<tr><td data-label="类型">' + TYPE_LABEL[w.type] + (w.type==='credit'?' <span class="tag disabled">负债</span>':'') + '</td>' +
      '<td data-label="名称">' + esc(w.name) + '</td>' +
      '<td data-label="本月金额">' + (amt != null ? amt : '<span class="muted">—</span>') + '</td>' +
      '<td data-label="操作">' +
        '<button class="btn sm" onclick="wRec(' + w.id + ",'" + w.type + "'" + ')">录入本月</button> ' +
        '<button class="btn sm" onclick="wRecOther(' + w.id + ",'" + w.type + "'" + ')">录入其他月</button> ' +
        '<button class="btn sm gray" onclick="wLogs(' + w.id + ')">查看记录</button> ' +
        '<button class="btn sm gray" onclick="wEdit(' + w.id + ')">编辑</button> ' +
        '<button class="btn sm gray" onclick="wShare(' + w.id + ')">录入链接</button> ' +
        '<button class="btn sm danger" onclick="wDel(' + w.id + ')">删除</button>' +
      '</td></tr>';
  }).join('') || '<tr><td colspan="4" class="muted">暂无钱包</td></tr>';
}
function renderSummary(report, goal, year) {
  document.getElementById('sAssets').textContent = report.latest.assets;
  document.getElementById('sDebt').textContent = report.latest.debt;
  document.getElementById('sNet').textContent = report.latest.netWorth;
  document.getElementById('sMonth').textContent = report.latestMonth || '—';
  var gInput = document.getElementById('goalInput');
  if (gInput) gInput.value = (goal && goal.target) ? goal.target : '';
  var gbox = document.getElementById('goalBox');
  if (goal) {
    gbox.innerHTML = '<b>' + year + ' 年度目标：</b>' + goal.target +
      ' 元 · 当前 ' + goal.current + ' · 还差 <b style="color:#cf1322;">' + goal.remaining + '</b>' +
      ' · 进度 ' + goal.progress + '%';
  } else {
    gbox.innerHTML = '<span class="muted">未设置 ' + year + ' 年度目标</span>';
  }
  renderTypeTotal(report.byTypeTotal || []);
}
// 各类型最新月合计（投资类附本金/收益；信用类标注为负债）
function renderTypeTotal(list) {
  var box = document.getElementById('typeTotalBox');
  if (!box) return;
  if (!list.length) { box.innerHTML = ''; return; }
  var cells = list.map(function(t){
    var extra = t.type==='investment' ? '<div class="muted" style="font-size:12px;">本金 '+t.principal+' / 收益 '+t.profit+'</div>' : '';
    var label = (TYPE_LABEL[t.type]||t.type) + (t.type==='credit' ? ' <span class="tag disabled">负债</span>' : '');
    return '<div class="stat" style="min-width:120px;"><div class="num" style="font-size:18px;">'+t.balance+'</div>'+
      '<div class="lbl">'+label+'</div>'+extra+'</div>';
  }).join('');
  var monthTag = (fullReport && fullReport.latestMonth) ? '（最新月 ' + fullReport.latestMonth + '）' : '（最新月）';
  box.innerHTML = '<div class="muted" style="margin-bottom:6px;">各类型合计' + monthTag + '</div><div class="grid-stats">'+cells+'</div>';
}
// 月度各类型合计：表头动态（月份 + 各类型 + 净资产），逐月一行，月份倒序；净资产为负标红
function renderMonthlyTypeTotals(mtt) {
  var head = document.getElementById('mttHead'), body = document.getElementById('mttBody');
  if (!head || !body) return;
  var types = mtt.types || [];
  head.innerHTML = '<tr><th>月份</th>' +
    types.map(function(t){ return '<th>' + (TYPE_LABEL[t]||t) + '</th>'; }).join('') +
    '<th>净资产</th></tr>';
  var rows = (mtt.rows || []).slice().sort(function(a,b){ return b.month < a.month ? -1 : 1; });
  body.innerHTML = rows.map(function(row){
    var tds = types.map(function(t){
      var v = row.totals[t];
      return '<td data-label="' + (TYPE_LABEL[t]||t) + '">' + (v != null ? v : '—') + '</td>';
    }).join('');
    var netColor = row.net < 0 ? ' style="color:#cf1322;font-weight:bold;"' : '';
    return '<tr><td data-label="月份">' + row.month + '</td>' + tds +
      '<td data-label="净资产"' + netColor + '>' + row.net + '</td></tr>';
  }).join('') || '<tr><td colspan="' + (types.length + 2) + '" class="muted">暂无记录</td></tr>';
}
function drawCharts(report) {
  var opts = { plugins:{ legend:{ display:false } } };
  if (nwChart) nwChart.destroy();
  nwChart = new Chart(document.getElementById('netChart'), {
    type:'line', data:{ labels: report.months, datasets:[{ label:'净资产', data: report.netWorthSeries, borderColor:'#667eea', tension:.3 }] },
    options:{ plugins:{ legend:{ display:false } }, scales:{ y:{ title:{ display:true, text:'净资产(元)' } } } } });
  if (csChart) csChart.destroy();
  csChart = new Chart(document.getElementById('consumeChart'), {
    type:'bar', data:{ labels: report.months, datasets:[{ label:'净存', data: report.savingSeries,
      backgroundColor: function(c){ return c.raw < 0 ? '#cf1322' : '#389e0d'; } }] },
    options:{ plugins:{ legend:{ display:false } }, scales:{ y:{ title:{ display:true, text:'每月净存(元, 负为减少)' } } } } });
}
function renderMonthTable(wlist, records) {
  var nameOf = {}, typeOf = {}; wlist.forEach(function(w){ nameOf[w.id] = w.name; typeOf[w.id] = w.type; });
  var tb = document.getElementById('recTbody');
  var sorted = records.slice().sort(function(a,b){
    if (a.month !== b.month) return b.month < a.month ? -1 : 1;
    var ta = typeOf[a.wallet_id]||'', tb2 = typeOf[b.wallet_id]||'';
    if (ta !== tb2) return ta.localeCompare(tb2);
    var na = nameOf[a.wallet_id]||'', nb = nameOf[b.wallet_id]||'';
    if (na !== nb) return na.localeCompare(nb);
    return (b.created_at||'').localeCompare(a.created_at||'');
  });
  tb.innerHTML = sorted.map(function(r){
    return '<tr><td data-label="月份">' + r.month + '</td>' +
      '<td data-label="类型">' + (TYPE_LABEL[typeOf[r.wallet_id]] || '') + '</td>' +
      '<td data-label="钱包">' + esc(nameOf[r.wallet_id]||'') + '</td>' +
      '<td data-label="金额">' + r.balance + (r.principal||r.profit ? ' <span class="muted">(本金'+r.principal+'/收益'+r.profit+')</span>' : '') + '</td>' +
      '<td data-label="更新时间" class="muted">' + esc(r.created_at||'') + '</td>' +
      '<td data-label="操作"><button class="btn sm gray" onclick="recEditRow(' + r.id + ')">修改</button> ' +
        '<button class="btn sm danger" onclick="recDelRow(' + r.id + ')">删除</button></td></tr>';
  }).join('') || '<tr><td colspan="6" class="muted">暂无记录</td></tr>';
}

// 录入/修改某月记录。preset: 预填 { balance | total, profit }
// editId: 传入=修改该条记录(PUT, 月份可编辑)；不传=新增一条(POST)
function openRecModal(id, type, month, preset, editId) {
  var w = wallets.filter(function(x){return x.id===id;})[0];
  preset = preset || {};
  var monthField = editId
    ? '<label>月份</label><input id="fMonth" type="month" value="' + month + '">'
    : '';
  var fields = type === 'investment'
    ? '<label>当前总资产(元)</label><input id="fTotal" type="number" step="0.01" value="' + (preset.total != null ? preset.total : '') + '">' +
      '<label>持有收益(元)</label><input id="fProfit" type="number" step="0.01" value="' + (preset.profit != null ? preset.profit : '') + '">' +
      '<p class="muted" id="principalHint">本金将自动计算 = 总资产 − 收益</p>'
    : '<label>本月余额(元)</label><input id="fBalance" type="number" step="0.01" value="' + (preset.balance != null ? preset.balance : '') + '">';
  openModal((editId ? '修改 · ' : '录入 · ') + w.name + ' (' + month + ')',
    monthField + fields + '<div style="margin-top:12px;"><button class="btn" id="recConfirm">保存</button> <button class="btn gray" onclick="closeModal()">取消</button></div>');
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
    var mm = editId ? document.getElementById('fMonth').value : month;
    if (!mm) { alert('请选择月份'); return; }
    var payload = { month: mm };
    if (type === 'investment') { payload.total = document.getElementById('fTotal').value; payload.profit = document.getElementById('fProfit').value; }
    else payload.balance = document.getElementById('fBalance').value;
    try {
      if (editId) {
        await api('/api/asset/records/' + editId, { method:'PUT', body: payload });
      } else {
        payload.wallet_id = id;
        await api('/api/asset/records', { method:'POST', body: payload });
      }
      closeModal(); await loadAll();
    }
    catch(e){ alert(e.message); }
  });
}
// 查看某钱包最新数据月份的记录明细（同月可能多条；创建时间倒序）
window.wLogs = function(id){
  var w = wallets.filter(function(x){return x.id===id;})[0];
  if (!w) return;
  var month = (fullReport && fullReport.latestMonth) || '';
  var recs = (fullRecords||[]).filter(function(r){ return r.wallet_id===id && r.month===month; })
    .slice().sort(function(a,b){ return (b.created_at||'').localeCompare(a.created_at||''); });
  var rows = recs.map(function(r){
    return '<tr><td data-label="月份">' + r.month + '</td>' +
      '<td data-label="金额">' + r.balance + (r.principal||r.profit ? ' <span class="muted">(本金'+r.principal+'/收益'+r.profit+')</span>' : '') + '</td>' +
      '<td data-label="更新时间" class="muted">' + esc(r.created_at||'') + '</td></tr>';
  }).join('') || '<tr><td colspan="3" class="muted">该月暂无记录</td></tr>';
  openModal('记录 · ' + w.name + (month ? '（' + month + '）' : ''),
    '<table><thead><tr><th>月份</th><th>金额</th><th>更新时间</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    '<div style="margin-top:12px;"><button class="btn gray" onclick="closeModal()">关闭</button></div>');
};
// 录入本月（新增一条）
window.wRec = function(id, type){ openRecModal(id, type, curMonth(), null); };
// 录入其他月：先选月份，再新增一条
window.wRecOther = function(id, type){
  var w = wallets.filter(function(x){return x.id===id;})[0];
  openModal('选择月份 · ' + w.name,
    '<label>月份</label><input id="omMonth" type="month" value="' + curMonth() + '">' +
    '<div style="margin-top:12px;"><button class="btn" id="omNext">下一步</button> <button class="btn gray" onclick="closeModal()">取消</button></div>');
  document.getElementById('omNext').addEventListener('click', function(){
    var mm = document.getElementById('omMonth').value;
    if (!mm) { alert('请选择月份'); return; }
    openRecModal(id, type, mm, null);
  });
};
// 修改某条已有月度记录（按 id, 可改月份）
window.recEditRow = function(recId){
  var rec = fullRecords.filter(function(r){ return r.id===recId; })[0];
  if (!rec) return;
  var w = wallets.filter(function(x){return x.id===rec.wallet_id;})[0];
  if (!w) return;
  var preset = { balance: rec.balance, total: rec.balance, profit: rec.profit };
  openRecModal(rec.wallet_id, w.type, rec.month, preset, recId);
};
// 删除某条月度记录
window.recDelRow = async function(id){
  if (!confirm('删除该月度记录?')) return;
  try { await api('/api/asset/records/' + id, { method:'DELETE' }); await loadAll(); } catch(e){ alert(e.message); }
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
var aPushDayPick = null, aPushHourPick = null, aPushChannelPick = null;
async function loadPush() {
  var chs = await api('/api/notify/channels');
  var items = chs.channels.map(function(c){ return { value: c.id, label: c.name + ' [' + c.type + ']' }; });
  var d = await api('/api/push/asset');
  aPushChannelPick = initListPick(document.getElementById('pushCh'), items, d.config.channel_ids || []);
  document.getElementById('pushFmt').value = d.config.format || 'text';
  aPushDayPick = initMultiPick(document.getElementById('pushDay'), 1, 28, d.config.days || [15], function(n){ return n + '号'; });
  aPushHourPick = initMultiPick(document.getElementById('pushHour'), 0, 23, d.config.hours || [9], function(n){ return n + '点'; });
  document.getElementById('pushEn').checked = !!d.config.enabled;
}
document.getElementById('pushSave').addEventListener('click', async function(){
  try {
    await api('/api/push/asset', { method:'PUT', body:{
      channel_ids: aPushChannelPick ? aPushChannelPick.getValues() : [],
      format: document.getElementById('pushFmt').value,
      days: aPushDayPick ? aPushDayPick.getString() : '15',
      hours: aPushHourPick ? aPushHourPick.getString() : '9',
      enabled: document.getElementById('pushEn').checked
    }});
    alert('推送配置已保存');
  } catch(e){ alert(e.message); }
});
var aPushSend = document.getElementById('pushSend');
if (aPushSend) aPushSend.addEventListener('click', async function(){
  var btn = this; btn.disabled = true; btn.textContent = '推送中...';
  try { var r = await api('/api/push/asset/send', { method:'POST' }); alert(r.message || '已推送'); }
  catch(e){ alert(e.message); }
  finally { btn.disabled = false; btn.textContent = '立即推送'; }
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
      box.innerHTML = '<label>当前总资产(元)</label><input id="fTotal" type="number" step="0.01">' +
        '<label>持有收益(元)</label><input id="fProfit" type="number" step="0.01">' +
        '<p class="muted" id="pHint">本金将自动计算 = 总资产 − 收益</p>';
    } else {
      box.innerHTML = '<label>本月余额(元)</label><input id="fBalance" type="number" step="0.01">';
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
  try {
    await api('/api/public/asset/' + token, { method:'POST', body: payload });
    showMsg(msg, '本月记录已保存！可继续录入下一条', true);
    document.getElementById('aForm').reset();
  }
  catch(err){ showMsg(msg, err.message, false); }
});
loadInfo();
bindQuickLogin('asset');
`;

// ============ 待办树渲染核心（三页共用，内联注入） ============
// 提供 buildTree(rows)->trees、renderTree(container, trees, opts) 纯 DOM 构建。
// opts 回调决定各页能力：{ today, hideDone, onToggle, onEdit, onDel, onAddChild, onShare, readOnly }
// 用 createElement + addEventListener，规避模板串内引号转义。
const TODO_TREE_CORE = `
var PRI_ICON = { 2: '🔴', 1: '🔵', 0: '⚪' };
var PRI_TEXT = { 2: '高', 1: '中', 0: '低' };
function todoBuildTree(rows) {
  var byId = {}, roots = [];
  rows.forEach(function(r){ byId[r.id] = Object.assign({}, r, { children: [] }); });
  Object.keys(byId).forEach(function(k){
    var n = byId[k], pid = n.parent_id;
    if (pid != null && byId[pid]) byId[pid].children.push(n); else roots.push(n);
  });
  // 顶层按截止日期倒序（有日期的越晚越靠前，无日期排最后）；同日期或子任务按 sort_order+id
  roots.sort(function(a, b){
    var ad = a.due_date || '', bd = b.due_date || '';
    if (ad !== bd) {
      if (!ad) return 1;
      if (!bd) return -1;
      return ad < bd ? 1 : -1;
    }
    return (a.sort_order - b.sort_order) || (a.id - b.id);
  });
  function sortRec(list){
    list.forEach(function(n){
      n.children.sort(function(a,b){ return (a.sort_order - b.sort_order) || (a.id - b.id); });
      sortRec(n.children);
    });
  }
  sortRec(roots);
  return roots;
}
// 子树是否含未完成（隐藏已完成时用于判断整枝是否隐藏）
function todoSubtreePending(node){
  if (!node.done) return true;
  return node.children.some(todoSubtreePending);
}
var _todoCollapsed = {}; // id -> true 折叠状态（前端会话内保留）
function renderTodoTree(container, trees, opts) {
  opts = opts || {};
  var today = opts.today || '';
  container.innerHTML = '';
  function walk(node, depth, rootDue) {
    if (opts.hideDone && !todoSubtreePending(node)) return null;
    // 有效截止日期：顶层用自身 due_date，子任务继承顶层（rootDue）
    var effDue = depth === 0 ? node.due_date : rootDue;
    var wrap = document.createElement('div');
    wrap.className = 'todo-node';
    wrap.setAttribute('data-depth', depth);
    wrap.style.setProperty('--depth', depth);

    var row = document.createElement('div');
    row.className = 'todo-row pri-' + (node.priority != null ? node.priority : 1) + (node.done ? ' is-done' : '') + (depth === 0 ? ' is-root' : '');
    row.style.setProperty('--depth', depth);
    var hasChildren = node.children.length > 0;

    // 折叠三角
    var caret = document.createElement('span');
    caret.className = 'todo-caret' + (hasChildren ? '' : ' leaf') + (_todoCollapsed[node.id] ? ' collapsed' : '');
    caret.textContent = '▼';
    row.appendChild(caret);

    // 圆形勾选框
    var check = document.createElement('button');
    check.type = 'button';
    check.className = 'todo-check' + (node.done ? ' done' : '');
    check.title = node.done ? '取消完成' : '标记完成';
    if (opts.onToggle) check.addEventListener('click', function(e){ e.stopPropagation(); opts.onToggle(node, !node.done); });
    row.appendChild(check);

    // 主体：标题 + 元信息
    var main = document.createElement('div');
    main.className = 'todo-main';
    var title = document.createElement('div');
    title.className = 'todo-title';
    title.textContent = node.title;
    if (hasChildren) {
      var cnt = document.createElement('span');
      cnt.className = 'todo-count';
      var total = 0, done = 0;
      (function count(n){ n.children.forEach(function(c){ total++; if (c.done) done++; count(c); }); })(node);
      cnt.textContent = '(' + done + '/' + total + ')';
      title.appendChild(cnt);
    }
    main.appendChild(title);
    var meta = document.createElement('div');
    meta.className = 'todo-meta';
    if (node.category) {
      var cc = document.createElement('span'); cc.className = 'todo-chip cat'; cc.textContent = node.category; meta.appendChild(cc);
    }
    // 日期 chip：已完成也显示；逾期(未完成且过期)标红；子任务展示继承的日期
    if (effDue) {
      var over = !node.done && today && effDue < today;
      var dc = document.createElement('span');
      dc.className = 'todo-chip due' + (over ? ' overdue' : '');
      dc.textContent = (over ? '⚠️ 逾期 ' : '📅 ') + effDue;
      meta.appendChild(dc);
    }
    // 完成时间 chip：已完成且有完成日期时显示
    if (node.done && node.done_at) {
      var doneC = document.createElement('span');
      doneC.className = 'todo-chip done-at';
      doneC.textContent = '✅ 完成于 ' + node.done_at;
      meta.appendChild(doneC);
    }
    if (meta.childNodes.length) main.appendChild(meta);
    if (node.note) {
      var noteEl = document.createElement('div');
      noteEl.className = 'todo-note';
      noteEl.textContent = node.note;
      main.appendChild(noteEl);
    }
    row.appendChild(main);

    // 行内操作
    if (!opts.readOnly) {
      var ops = document.createElement('div');
      ops.className = 'todo-ops';
      if (opts.onAddChild) { var b1 = mkOp('➕', '添加子任务', function(){ opts.onAddChild(node); }); ops.appendChild(b1); }
      if (opts.onEdit)     { var b2 = mkOp('✏️', '编辑', function(){ opts.onEdit(node); }); ops.appendChild(b2); }
      if (opts.onShare && depth === 0) { var b3 = mkOp('🔗', '协作链接', function(){ opts.onShare(node); }); ops.appendChild(b3); }
      if (opts.onDel)      { var b4 = mkOp('🗑️', '删除', function(){ opts.onDel(node); }); ops.appendChild(b4); }
      if (ops.childNodes.length) row.appendChild(ops);
    }
    wrap.appendChild(row);

    var childBox = document.createElement('div');
    childBox.className = 'todo-children' + (_todoCollapsed[node.id] ? ' collapsed' : '');
    node.children.forEach(function(c){ var el = walk(c, depth + 1, effDue); if (el) childBox.appendChild(el); });
    wrap.appendChild(childBox);

    // 点击整行（非勾选框/操作按钮区）即展开/折叠该任务的子任务
    if (hasChildren) {
      row.style.cursor = 'pointer';
      row.addEventListener('click', function(e){
        if (e.target.closest('.todo-check') || e.target.closest('.todo-ops')) return;
        _todoCollapsed[node.id] = !_todoCollapsed[node.id];
        caret.classList.toggle('collapsed');
        childBox.classList.toggle('collapsed');
      });
    }
    return wrap;
  }
  function mkOp(icon, title, fn) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'todo-op'; b.title = title;
    b.textContent = icon;
    b.addEventListener('click', function(e){ e.stopPropagation(); fn(); });
    return b;
  }
  var any = false;
  trees.forEach(function(t){ var el = walk(t, 0, t.due_date); if (el) { container.appendChild(el); any = true; } });
  if (!any) container.innerHTML = '<div class="todo-empty">🎉 暂无待办，点击上方按钮新建</div>';
}
// 任务编辑表单 HTML：标题(多行长文本)/优先级/截止(仅顶层, 新建默认当天)/分类/备注
// isNew=true 新建；isChild=true 为子任务(日期继承主任务, 不显示日期字段)
function todoFormHtml(t, isNew, isChild) {
  t = t || {};
  var defDue = t.due_date || (isNew ? todoTodayStr() : '');
  var dueField = isChild ? '' :
    '<div><label>截止日期</label><input id="tfDue" type="date" value="' + defDue + '"></div>';
  return '<label>标题</label>' +
    '<textarea id="tfTitle" rows="2" placeholder="要做什么？（支持换行）" style="resize:vertical;">' + esc(t.title || '') + '</textarea>' +
    '<div class="row">' +
      '<div><label>优先级</label><select id="tfPri">' +
        '<option value="2"' + (t.priority === 2 ? ' selected' : '') + '>🔴 高</option>' +
        '<option value="1"' + (t.priority == null || t.priority === 1 ? ' selected' : '') + '>🔵 中</option>' +
        '<option value="0"' + (t.priority === 0 ? ' selected' : '') + '>⚪ 低</option>' +
      '</select></div>' +
      dueField +
    '</div>' +
    (isChild ? '<p class="muted" style="margin:-4px 0 10px;font-size:12px;">📅 子任务的截止日期跟随主任务</p>' : '') +
    '<label>分类（可选）</label><input id="tfCat" value="' + esc(t.category || '') + '" placeholder="如 工作 / 家庭">' +
    '<label>备注（可选）</label>' +
    '<textarea id="tfNote" rows="2" placeholder="补充说明…" style="resize:vertical;">' + esc(t.note || '') + '</textarea>';
}
function todoFormRead() {
  var dueEl = document.getElementById('tfDue');
  return {
    title: document.getElementById('tfTitle').value.trim(),
    priority: parseInt(document.getElementById('tfPri').value, 10),
    due_date: dueEl ? (dueEl.value || null) : null,
    category: document.getElementById('tfCat').value.trim() || null,
    note: document.getElementById('tfNote').value.trim() || null
  };
}
function todoTodayStr(){ var d = new Date(Date.now() + 8*3600*1000); return d.toISOString().slice(0,10); }
// 共享：绘制"每日新建/完成"折线图。series = { labels[], created[], done[] }
var _todoChartInst = null;
function drawTodoChart(canvasId, series) {
  var el = document.getElementById(canvasId);
  if (!el || typeof Chart === 'undefined') return;
  if (_todoChartInst) { _todoChartInst.destroy(); _todoChartInst = null; }
  _todoChartInst = new Chart(el, {
    type: 'line',
    data: { labels: series.labels, datasets: [
      { label: '到期', data: series.created, borderColor: '#4a6cf7', backgroundColor: 'rgba(74,108,247,.12)', fill: true, tension: .3 },
      { label: '完成', data: series.done, borderColor: '#52c41a', backgroundColor: 'rgba(82,196,26,.12)', fill: true, tension: .3 }
    ] },
    options: { plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
  });
}
// 共享：区间按钮组绑定，点击回调 fn(range)
function bindTodoRange(fn) {
  var box = document.getElementById('chartRange');
  if (!box) return;
  box.addEventListener('click', function(e){
    var btn = e.target.closest('button[data-range]');
    if (!btn) return;
    box.querySelectorAll('button').forEach(function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
    fn(btn.getAttribute('data-range'));
  });
}
// 完成任务的庆祝特效：撒花 + toast，显示剩余数与按完成度分级的激励词
// remaining=未完成数, total=总数（含子任务）
function todoCelebrate(remaining, total) {
  var pct = total > 0 ? (total - remaining) / total : 0;
  var msg;
  if (total > 0 && remaining === 0) msg = '🎉 全部完成！今天的你太靠谱了！';
  else if (pct >= 0.8) msg = '🔥 就差一点，胜利在望！';
  else if (pct >= 0.5) msg = '💪 已过半，保持这个节奏！';
  else if (pct >= 0.2) msg = '✨ 势头不错，继续加油！';
  else msg = '👍 迈出第一步，积少成多！';
  var tip = remaining > 0 ? ('还剩 ' + remaining + ' 个待办') : '清单已清空 🧹';
  todoConfetti(total > 0 && remaining === 0);
  todoToast(msg, tip);
}
// 撒花：从顶部飘落的彩色碎片；grand=true 时数量更多、持续更久
function todoConfetti(grand) {
  if (typeof Element === 'undefined' || !Element.prototype.animate) return;
  var colors = ['#4a6cf7', '#52c41a', '#faad14', '#f5222d', '#eb2f96', '#13c2c2'];
  var n = grand ? 90 : 40;
  var box = document.createElement('div');
  box.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99999;overflow:hidden;';
  document.body.appendChild(box);
  var vh = window.innerHeight || 800;
  for (var i = 0; i < n; i++) {
    var p = document.createElement('div');
    var size = 6 + Math.floor(Math.random() * 9);
    p.style.cssText = 'position:absolute;top:-24px;left:' + (Math.random() * 100) + 'vw;width:' + size + 'px;height:' + size + 'px;background:' + colors[i % colors.length] + ';border-radius:' + (Math.random() < 0.5 ? '50%' : '2px') + ';';
    box.appendChild(p);
    var xdrift = (Math.random() * 2 - 1) * 180;
    var rot = (Math.random() * 2 - 1) * 720;
    p.animate([
      { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
      { transform: 'translate(' + xdrift + 'px,' + (vh + 80) + 'px) rotate(' + rot + 'deg)', opacity: 0.9 }
    ], { duration: 1600 + Math.random() * 1500, easing: 'cubic-bezier(.2,.6,.4,1)', delay: Math.random() * 260, fill: 'forwards' });
  }
  setTimeout(function(){ box.remove(); }, grand ? 3400 : 2800);
}
// 居中提示条：主文案 + 剩余数，自动淡出
function todoToast(msg, tip) {
  var old = document.getElementById('todoToast');
  if (old) old.remove();
  var t = document.createElement('div');
  t.id = 'todoToast';
  t.style.cssText = 'position:fixed;left:50%;top:20%;transform:translateX(-50%);z-index:100000;pointer-events:none;background:rgba(30,34,45,.92);color:#fff;padding:14px 22px;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.25);text-align:center;max-width:80vw;';
  t.innerHTML = '<div style="font-size:18px;font-weight:700;margin-bottom:4px;">' + esc(msg) + '</div><div style="font-size:13px;opacity:.85;">' + esc(tip) + '</div>';
  document.body.appendChild(t);
  if (Element.prototype.animate) {
    t.animate([
      { opacity: 0, transform: 'translateX(-50%) translateY(-12px) scale(.92)' },
      { opacity: 1, transform: 'translateX(-50%) translateY(0) scale(1)' }
    ], { duration: 240, easing: 'ease-out' });
  }
  setTimeout(function(){
    if (Element.prototype.animate) {
      var a = t.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: 'ease-in', fill: 'forwards' });
      a.onfinish = function(){ t.remove(); };
    } else { t.remove(); }
  }, 1800);
}
`;

// ============ 待办清单页（登录态） ============
const TODO_JS = `
${COMMON_JS}
${TODO_TREE_CORE}
bindLogout();
bindModal();
var _rows = [];
var _stats = { pending:0, overdue:0, done:0, total:0 };
function todayStr(){ var d = new Date(Date.now() + 8*3600*1000); return d.toISOString().slice(0,10); }

async function loadTodos() {
  var data = await api('/api/todo/list');
  _rows = data.todos || [];
  var s = data.stats || { pending:0, overdue:0, done:0, total:0 };
  _stats = s;
  document.getElementById('stPending').textContent = s.pending;
  document.getElementById('stOverdue').textContent = s.overdue;
  document.getElementById('stDone').textContent = s.done;
  document.getElementById('stTotal').textContent = s.total;
  drawTree();
}
function drawTree() {
  var hideDone = document.getElementById('hideDone').checked;
  renderTodoTree(document.getElementById('todoTree'), todoBuildTree(_rows), {
    today: todayStr(), hideDone: hideDone,
    onToggle: async function(node, done){
      try {
        await api('/api/todo/' + node.id + '/done', { method:'PUT', body:{ done: done } });
        await loadTodos(); await loadChart();
        if (done) todoCelebrate(_stats.total - _stats.done, _stats.total);
      }
      catch(e){ alert(e.message); }
    },
    onEdit: function(node){
      var isChild = node.parent_id != null;
      openModal('编辑任务', todoFormHtml(node, false, isChild) +
        '<div style="margin-top:12px;"><button class="btn" id="tfSave">保存</button> <button class="btn gray" onclick="closeModal()">取消</button></div>');
      document.getElementById('tfSave').addEventListener('click', async function(){
        var body = todoFormRead();
        if (!body.title) { alert('请填写标题'); return; }
        try { await api('/api/todo/' + node.id, { method:'PUT', body: body }); closeModal(); await loadTodos(); }
        catch(e){ alert(e.message); }
      });
    },
    onAddChild: function(node){ openAddForm(node.id, '为「' + node.title + '」添加子任务', true); },
    onDel: async function(node){
      if (!confirm('删除「' + node.title + '」及其全部子任务？')) return;
      try { await api('/api/todo/' + node.id, { method:'DELETE' }); await loadTodos(); await loadChart(); }
      catch(e){ alert(e.message); }
    },
    onShare: async function(node){
      try {
        var d = await api('/api/todo/' + node.id + '/share-link');
        openModal('免密协作链接',
          '<p class="muted">此链接长期有效，打开无需登录即可查看、添加、勾选该清单下的任务。</p>' +
          '<input id="tShareUrl" value="' + esc(d.link) + '" readonly style="margin-bottom:8px;">' +
          '<button class="btn" onclick="todoCopy()">复制链接</button>');
      } catch(e){ alert(e.message); }
    }
  });
}
window.todoCopy = function(){ var el=document.getElementById('tShareUrl'); el.select(); try{document.execCommand('copy');alert('已复制');}catch(e){alert('请手动复制');} };
function openAddForm(parentId, title, isChild) {
  openModal(title, todoFormHtml({}, true, !!isChild) +
    '<div style="margin-top:12px;"><button class="btn" id="tfCreate">创建</button> <button class="btn gray" onclick="closeModal()">取消</button></div>');
  document.getElementById('tfCreate').addEventListener('click', async function(){
    var body = todoFormRead();
    if (!body.title) { alert('请填写标题'); return; }
    if (parentId != null) body.parent_id = parentId;
    try { await api('/api/todo', { method:'POST', body: body }); closeModal(); await loadTodos(); await loadChart(); }
    catch(e){ alert(e.message); }
  });
}
document.getElementById('tAdd').addEventListener('click', function(){ openAddForm(null, '新建任务', false); });
document.getElementById('hideDone').addEventListener('change', drawTree);

// 任务趋势图（含子任务）
var _curRange = '7d';
async function loadChart() {
  try {
    var d = await api('/api/todo/chart?range=' + _curRange);
    drawTodoChart('todoChart', d.series);
  } catch(e){ /* 图表失败不阻断页面 */ }
}
bindTodoRange(function(r){ _curRange = r; loadChart(); });

// 推送配置（待办日报）
var tPushHourPick = null, tPushChannelPick = null;
async function loadPush() {
  var chs = await api('/api/notify/channels');
  var items = chs.channels.map(function(c){ return { value: c.id, label: c.name + ' [' + c.type + ']' }; });
  var d = await api('/api/push/todo');
  tPushChannelPick = initListPick(document.getElementById('pushCh'), items, d.config.channel_ids || []);
  document.getElementById('pushFmt').value = d.config.format || 'text';
  tPushHourPick = initMultiPick(document.getElementById('pushHour'), 0, 23, d.config.hours || [9], function(n){ return n + '点'; });
  document.getElementById('pushEn').checked = !!d.config.enabled;
}
document.getElementById('pushSave').addEventListener('click', async function(){
  try {
    await api('/api/push/todo', { method:'PUT', body:{
      channel_ids: tPushChannelPick ? tPushChannelPick.getValues() : [],
      format: document.getElementById('pushFmt').value,
      hours: tPushHourPick ? tPushHourPick.getString() : '9',
      enabled: document.getElementById('pushEn').checked
    }});
    alert('推送配置已保存');
  } catch(e){ alert(e.message); }
});
document.getElementById('pushSend').addEventListener('click', async function(){
  var btn = this; btn.disabled = true; btn.textContent = '推送中...';
  try { var r = await api('/api/push/todo/send', { method:'POST' }); alert(r.message || '已推送'); }
  catch(e){ alert(e.message); }
  finally { btn.disabled = false; btn.textContent = '立即推送'; }
});

(async function(){
  try { await loadTodos(); await loadChart(); await loadPush(); }
  catch(e){ if (String(e.message).indexOf('登录')>=0) location.href='/login'; else alert(e.message); }
})();
`;

// ============ 待办免密协作公开页 ============
const PUBLIC_TODO_JS = `
${COMMON_JS}
${TODO_TREE_CORE}
bindModal();
bindQuickLogin('todo');
var _token = location.pathname.split('/').filter(Boolean).pop();
var _rows = [], _rootId = null, _today = '';

async function loadPublic() {
  var msg = document.getElementById('msg');
  try {
    var d = await api('/api/public/todo/' + _token);
    _rows = d.todos || [];
    _rootId = d.root.id;
    _today = d.today || '';
    document.getElementById('rootTitle').textContent = d.root.title;
    document.getElementById('ownerLine').textContent = d.owner_name ? ('来自 ' + d.owner_name + ' 的共享清单') : '';
    document.getElementById('content').style.display = 'block';
    var trees = visibleTrees();
    renderStats(trees);
    drawTree(trees);
    loadChart();
  } catch(e) { showMsg(msg, e.message || '链接无效', false); }
}
// 可见树：仅截止今天或已逾期的顶层任务（与日报 filterTodayOverdue 口径一致），子任务随顶层
function visibleTrees() {
  return todoBuildTree(_rows).filter(function(t){
    return t.due_date && _today && t.due_date <= _today;
  });
}
// 统计（口径同日报 statsOfReport）：基于可见树，子任务继承顶层截止日期判逾期
function renderStats(trees) {
  var pending = 0, overdue = 0, done = 0;
  function walk(node, rootDue){
    if (node.done) done++;
    else {
      pending++;
      if (rootDue && _today && rootDue < _today) overdue++;
    }
    node.children.forEach(function(c){ walk(c, rootDue); });
  }
  trees.forEach(function(root){ walk(root, root.due_date); });
  document.getElementById('stPending').textContent = pending;
  document.getElementById('stOverdue').textContent = overdue;
  document.getElementById('stDone').textContent = done;
}
async function loadChart() {
  try { var c = await api('/api/public/todo-chart/' + _token + '?range=7d'); drawTodoChart('todoChart', c.series); }
  catch(e){ /* 图表失败不阻断 */ }
}
function drawTree(trees) {
  // 列表仅显示截止今天或已逾期的顶层任务（与日报口径一致），子任务随顶层展示；曲线图不受此过滤影响
  renderTodoTree(document.getElementById('todoTree'), trees, {
    today: _today,
    onToggle: async function(node, done){
      try {
        await api('/api/public/todo/' + _token + '/' + node.id + '/done', { method:'PUT', body:{ done: done } });
        await loadPublic();
        if (done) {
          // 庆祝口径与可见列表一致：统计当天/逾期范围内的任务数
          var total = 0, doneCnt = 0;
          (function count(list){ list.forEach(function(n){ total++; if (n.done) doneCnt++; count(n.children); }); })(visibleTrees());
          todoCelebrate(total - doneCnt, total);
        }
      }
      catch(e){ alert(e.message); }
    },
    onEdit: function(node){
      var isChild = node.id !== _rootId;
      openModal('编辑任务', todoFormHtml(node, false, isChild) +
        '<div style="margin-top:12px;"><button class="btn" id="tfSave">保存</button> <button class="btn gray" onclick="closeModal()">取消</button></div>');
      document.getElementById('tfSave').addEventListener('click', async function(){
        var body = todoFormRead();
        if (!body.title) { alert('请填写标题'); return; }
        try { await api('/api/public/todo/' + _token + '/' + node.id, { method:'PUT', body: body }); closeModal(); await loadPublic(); }
        catch(e){ alert(e.message); }
      });
    },
    onAddChild: function(node){ openAddForm(node.id, '为「' + node.title + '」添加子任务'); }
  });
}
function openAddForm(parentId, title) {
  openModal(title, todoFormHtml({}, true, true) +
    '<div style="margin-top:12px;"><button class="btn" id="tfCreate">添加</button> <button class="btn gray" onclick="closeModal()">取消</button></div>');
  document.getElementById('tfCreate').addEventListener('click', async function(){
    var body = todoFormRead();
    if (!body.title) { alert('请填写标题'); return; }
    if (parentId != null) body.parent_id = parentId;
    try { await api('/api/public/todo/' + _token, { method:'POST', body: body }); closeModal(); await loadPublic(); }
    catch(e){ alert(e.message); }
  });
}
document.getElementById('tAddRoot').addEventListener('click', function(){ openAddForm(_rootId, '添加任务'); });
loadPublic();
`;

// ============ 待办免密报告查看页（只读） ============
const TODO_REPORT_JS = `
${COMMON_JS}
${TODO_TREE_CORE}
bindQuickLogin('todo-report');
var _token = location.pathname.split('/').filter(Boolean).pop();
var _curRange = '7d';
async function loadChart() {
  try { var c = await api('/api/public/todo-chart/' + _token + '?range=' + _curRange); drawTodoChart('todoChart', c.series); }
  catch(e){ /* 图表失败不阻断 */ }
}
(async function(){
  try {
    var d = await api('/api/public/todo-report/' + _token);
    var s = d.stats || { pending:0, overdue:0, done:0 };
    document.getElementById('stPending').textContent = s.pending;
    document.getElementById('stOverdue').textContent = s.overdue;
    document.getElementById('stDone').textContent = s.done;
    document.getElementById('content').style.display = 'block';
    renderTodoTree(document.getElementById('todoTree'), todoBuildTree(d.todos || []), { today: d.today || '', readOnly: true });
    bindTodoRange(function(r){ _curRange = r; loadChart(); });
    await loadChart();
  } catch(e) { document.body.innerHTML = '<div class="todo-empty" style="margin-top:60px;">' + esc(e.message || '链接无效') + '</div>'; }
})();
`;

// ============ 待办免密汇总协作页（跨全部清单，今天+逾期，可写） ============
const TODO_COLLAB_JS = `
${COMMON_JS}
${TODO_TREE_CORE}
bindModal();
bindQuickLogin('todo-report');
var _token = location.pathname.split('/').filter(Boolean).pop();
var _rows = [], _today = '';

async function loadCollab() {
  var msg = document.getElementById('msg');
  try {
    var d = await api('/api/public/todo-report/' + _token);
    _rows = d.todos || [];
    _today = d.today || '';
    if (d.owner_name) document.getElementById('ownerTitle').textContent = d.owner_name + ' 的待办';
    document.getElementById('content').style.display = 'block';
    var trees = visibleTrees();
    renderStats(trees);
    drawTree(trees);
    loadChart();
  } catch(e) { showMsg(msg, e.message || '链接无效', false); }
}
// 可见树：仅截止今天或已逾期的顶层任务（与日报口径一致），子任务随顶层
function visibleTrees() {
  return todoBuildTree(_rows).filter(function(t){
    return t.due_date && _today && t.due_date <= _today;
  });
}
// 统计（口径同日报 statsOfReport）：基于可见树，子任务继承顶层截止日期判逾期
function renderStats(trees) {
  var pending = 0, overdue = 0, done = 0;
  function walk(node, rootDue){
    if (node.done) done++;
    else {
      pending++;
      if (rootDue && _today && rootDue < _today) overdue++;
    }
    node.children.forEach(function(c){ walk(c, rootDue); });
  }
  trees.forEach(function(root){ walk(root, root.due_date); });
  document.getElementById('stPending').textContent = pending;
  document.getElementById('stOverdue').textContent = overdue;
  document.getElementById('stDone').textContent = done;
}
async function loadChart() {
  try { var c = await api('/api/public/todo-chart/' + _token + '?range=7d'); drawTodoChart('todoChart', c.series); }
  catch(e){ /* 图表失败不阻断 */ }
}
function drawTree(trees) {
  renderTodoTree(document.getElementById('todoTree'), trees, {
    today: _today,
    onToggle: async function(node, done){
      try {
        await api('/api/public/todo-all/' + _token + '/' + node.id + '/done', { method:'PUT', body:{ done: done } });
        await loadCollab();
        if (done) {
          var total = 0, doneCnt = 0;
          (function count(list){ list.forEach(function(n){ total++; if (n.done) doneCnt++; count(n.children); }); })(visibleTrees());
          todoCelebrate(total - doneCnt, total);
        }
      }
      catch(e){ alert(e.message); }
    },
    onEdit: function(node){
      var isChild = node.parent_id != null;
      openModal('编辑任务', todoFormHtml(node, false, isChild) +
        '<div style="margin-top:12px;"><button class="btn" id="tfSave">保存</button> <button class="btn gray" onclick="closeModal()">取消</button></div>');
      document.getElementById('tfSave').addEventListener('click', async function(){
        var body = todoFormRead();
        if (!body.title) { alert('请填写标题'); return; }
        try { await api('/api/public/todo-all/' + _token + '/' + node.id, { method:'PUT', body: body }); closeModal(); await loadCollab(); }
        catch(e){ alert(e.message); }
      });
    },
    onAddChild: function(node){ openAddForm(node.id, '为「' + node.title + '」添加子任务', true); }
  });
}
function openAddForm(parentId, title, isChild) {
  openModal(title, todoFormHtml({}, true, !!isChild) +
    '<div style="margin-top:12px;"><button class="btn" id="tfCreate">添加</button> <button class="btn gray" onclick="closeModal()">取消</button></div>');
  document.getElementById('tfCreate').addEventListener('click', async function(){
    var body = todoFormRead();
    if (!body.title) { alert('请填写标题'); return; }
    if (parentId != null) body.parent_id = parentId;
    try { await api('/api/public/todo-all/' + _token, { method:'POST', body: body }); closeModal(); await loadCollab(); }
    catch(e){ alert(e.message); }
  });
}
document.getElementById('tAddRoot').addEventListener('click', function(){ openAddForm(null, '新建任务', false); });
loadCollab();
`;

export {
  COMMON_JS, LOGIN_JS, DASHBOARD_JS, ADMIN_JS, SETUP_JS, MONITOR_JS, FUND_JS,
  PUBLIC_BUY_JS, WEIGHT_JS, PUBLIC_WEIGHT_JS, SETTINGS_JS, ASSET_JS, PUBLIC_ASSET_JS, CHANNELS_JS,
  WEIGHT_REPORT_JS, ASSET_REPORT_JS, FUND_REPORT_JS,
  TODO_JS, PUBLIC_TODO_JS, TODO_REPORT_JS, TODO_COLLAB_JS
};
