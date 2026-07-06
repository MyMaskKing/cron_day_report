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
        '<td data-label="ID">' + u.id + '</td>' +
        '<td data-label="用户名">' + esc(u.username) + '</td>' +
        '<td data-label="角色"><span class="tag ' + u.role + '">' + (u.role === 'admin' ? '超管' : '用户') + '</span></td>' +
        '<td data-label="状态"><span class="tag ' + u.status + '">' + (u.status === 'active' ? '正常' : '禁用') + '</span></td>' +
        '<td data-label="创建时间">' + esc(u.created_at) + '</td>' +
        '<td data-label="操作"><div class="dropdown">' +
          '<button class="btn sm" onclick="toggleDropdown(this)">⋯ 操作</button>' +
          '<div class="dropdown-menu">' +
            '<button onclick="viewUser(' + u.id + ')">查看</button>' +
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
    return '<tr><td data-label="名称">' + esc(c.name) + '</td><td data-label="类型">' + c.type + '</td>' +
      '<td data-label="URL" class="muted" style="word-break:break-all;">' + esc(c.url) + '</td>' +
      '<td data-label="状态">' + (c.enabled ? '<span class="tag ok">启用</span>' : '<span class="tag disabled">停用</span>') + '</td>' +
      '<td data-label="操作"><button class="btn sm gray" onclick="editCh(' + c.id + ')">编辑</button> ' +
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
  renderChHelp();
  document.getElementById('chFormWrap').style.display = 'block';
}

// 各渠道类型的填写示例说明
var CH_HELP = {
  wechat: '<b>📢 企业微信群机器人</b><br>' +
    '• <b>URL</b>：群机器人 Webhook 地址<br>' +
    '&nbsp;&nbsp;<code>https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=你的key</code><br>' +
    '• <b>请求头 JSON</b>、<b>Body 模板</b>：留空（系统自动按微信文本格式发送）',
  webhook: '<b>🔗 通用 Webhook（最灵活，可对接任意接口）</b><br>' +
    '• <b>URL</b>：接收消息的接口地址<br>' +
    '• <b>请求头 JSON</b>（可选）：如需鉴权 <code>{"Authorization":"Bearer xxx"}</code><br>' +
    '• <b>Body 模板</b>（可选）：用 <code>{{content}}</code> 代表报告正文。<br>' +
    '&nbsp;&nbsp;例：<code>{"text":"{{content}}"}</code>；留空则直接发送纯文本报告',
  email: '<b>📧 邮件（通过中转服务转发）</b><br>' +
    '• <b>URL</b>：你的邮件中转服务地址（能接收 JSON 并代发邮件）<br>' +
    '• <b>请求头 JSON</b>：<span style="color:#cf1322;">此处填收件人和主题</span><br>' +
    '&nbsp;&nbsp;<code>{"mailto":"1647470402@qq.com","subject":"定时任务报告"}</code><br>' +
    '• <b>Body 模板</b>：留空<br>' +
    '• 实际发出：<code>{"to":收件人,"subject":主题,"content":报告正文}</code>'
};
function renderChHelp() {
  var type = document.getElementById('chType').value;
  document.getElementById('chHelp').innerHTML = CH_HELP[type] || '';
}
document.getElementById('chType').addEventListener('change', renderChHelp);
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

// ---------- 日报配置 ----------
async function loadReportConfig() {
  var chData = await api('/api/notify/channels');
  var opts = '<option value="">（选择通知渠道）</option>';
  chData.channels.forEach(function(c){ opts += '<option value="' + c.id + '">' + esc(c.name) + ' [' + c.type + ']</option>'; });
  document.getElementById('rcChannel').innerHTML = opts;

  var data = await api('/api/fund/report-config');
  var cfg = data.config;
  document.getElementById('rcChannel').value = cfg.channel_id || '';
  document.getElementById('rcFormat').value = cfg.format || 'text';
  document.getElementById('rcEnabled').checked = !!cfg.enabled;
}
document.getElementById('rcSave').addEventListener('click', async function(){
  var payload = {
    channel_id: document.getElementById('rcChannel').value || null,
    format: document.getElementById('rcFormat').value,
    enabled: document.getElementById('rcEnabled').checked
  };
  try { await api('/api/fund/report-config', { method:'PUT', body: payload }); alert('日报配置已保存'); }
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

export { COMMON_JS, LOGIN_JS, DASHBOARD_JS, ADMIN_JS, SETUP_JS, MONITOR_JS, FUND_JS, PUBLIC_BUY_JS };
