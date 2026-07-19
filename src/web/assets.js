/**
 * 前端通用 JS 片段（作为字符串注入页面）
 */

// 通用 API 请求与工具函数（所有页面共用）
const COMMON_JS = `
// ============ 统一 SVG 图标(24x24, stroke: currentColor, 与 topbar 风格一致) ============
// 移动端 emoji 在浅底色行上易被吞噬(尤其 ✏️/🔗/🗑️), 全部换成矢量描边图标; 颜色由 .todo-op 决定
var ICONS = {
  plus:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  edit:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>',
  drag:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg>',
  cards: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:4px;"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  tree:  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:4px;"><path d="M12 2v6"/><path d="M12 8l-4 4v4"/><path d="M12 8l4 4v4"/><circle cx="12" cy="2" r="1"/><circle cx="8" cy="16" r="2"/><circle cx="16" cy="16" r="2"/><circle cx="12" cy="20" r="2"/></svg>',
  close_x: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  fs_expand: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>',
  // 日期日历: 用于 due chip / drawer section title / form 子任务提示
  calendar: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  // 重复: 环形箭头, 用于 repeat chip / form 提示
  repeat: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px;"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
  // 逾期警告 (三角+感叹号): 用于 overdue chip
  warn: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  // 完成对勾 (圆圈+勾): 用于 done-at chip
  check_circle: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  // 完成 (纯对勾): 用于按钮 label
  check: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><polyline points="20 6 9 17 4 12"/></svg>',
  // 撤销/回退箭头
  undo: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><path d="M9 14L4 9l5-5"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>'
};
var _loadingCount = 0;
function showLoading(text) {
  _loadingCount++;
  var el = document.getElementById('globalLoading');
  if (el) el.style.display = 'flex';
  setLoadingText(text || '加载中…');
  setLoadingProgress(10);
  // 首次显示才上锁; 后续 showLoading 只累计计数, 由 hideLoading 归零时解锁一次
  if (_loadingCount === 1) lockBodyScroll();
}
function hideLoading() {
  _loadingCount = Math.max(0, _loadingCount - 1);
  if (_loadingCount === 0) {
    // 计数归零立即解锁, 不等 setTimeout 收起 UI —— 用户已可交互
    unlockBodyScroll();
    // 立即隐藏, 不再 setTimeout 180ms 停留在 100. 之前保留 180ms 是想让用户看到"100"完成态,
    // 但配合 setLoadingProgress 逐步爬升(20ms/1%), 从 35→100 要 1.3s, 且期间定时器一直触发 DOM 写,
    // 在慢速手机(微信/iOS 内核)会阻塞后续 location.href 导航, 表现为"loading 完了没跳转, 再点提示已操作过"
    var el = document.getElementById('globalLoading');
    if (el) el.style.display = 'none';
    resetLoadingProgress();
  }
}
// setLoadingText: 不改变计数, 仅更新提示文字(用于同一请求内多阶段说明)
function setLoadingText(text) {
  var t = document.getElementById('loadingText');
  if (t && _loadingCount > 0) t.textContent = text;
}
// 平滑进度：显示 #loadingPct，用定时器让当前值逐 1% 爬升至 target(0-100)，到 100 稍停后自动收起
var _pctVal = 0, _pctTarget = 0, _pctTimer = null;
function _pctRender() {
  var el = document.getElementById('loadingPct');
  if (el) { el.style.display = 'block'; el.textContent = _pctVal + '%'; }
}
function setLoadingProgress(target) {
  var t = Math.max(_pctTarget, Math.min(100, target || 0));
  _pctTarget = t;
  // 100% 直接跳到位, 不再逐步爬升 —— 请求已结束, 让 loading 立即消失, 避免用户在"数字还在爬"的假象里
  // 等 1-3 秒(旧逻辑 20ms/1%, 40→100 约 1.2s), 甚至以为"点了没反应"
  if (t >= 100) {
    if (_pctTimer) { clearInterval(_pctTimer); _pctTimer = null; }
    _pctVal = 100;
    _pctRender();
    return;
  }
  _pctRender();
  if (_pctTimer) return;
  _pctTimer = setInterval(function(){
    if (_pctVal < _pctTarget) { _pctVal++; _pctRender(); }
    else { clearInterval(_pctTimer); _pctTimer = null; }
  }, 20);
}
function resetLoadingProgress() {
  if (_pctTimer) { clearInterval(_pctTimer); _pctTimer = null; }
  _pctVal = 0; _pctTarget = 0;
  var el = document.getElementById('loadingPct');
  if (el) { el.style.display = 'none'; el.textContent = ''; }
}
function loadingTextOf(path, opts) {
  if (opts.loadingText) return opts.loadingText;
  var method = (opts.method || 'GET').toUpperCase();
  if (method === 'GET') return '正在加载数据…';
  if (method === 'POST') return '正在提交数据…';
  if (method === 'PUT') return '正在保存数据…';
  if (method === 'DELETE') return '正在删除数据…';
  return '正在处理请求…';
}
async function api(path, opts) {
  opts = opts || {};
  // ===== 请求指纹缓存: 三级防重, 覆盖 fetch 报错后手动重试导致的重复提交 =====
  //   in-flight: 相同 (method+path+body) 复用 Promise
  //   成功后 15s: 命中直接返回上次 data(避免"手抖点两次立即产生两条记录")
  //   失败后 3s : 命中抛提示错误, 让用户看清"刚才那次刚失败了"再决定重试
  //   GET 不参与缓存: 查询无副作用, 缓存反而妨碍 UI 手动刷新
  var method = (opts.method || 'GET').toUpperCase();
  var bodyKey = opts.body ? JSON.stringify(opts.body) : '';
  var key = method + ' ' + path + ' ' + bodyKey;
  var cacheable = method !== 'GET';
  if (!window._apiInflight) window._apiInflight = {};
  if (!window._apiCache) window._apiCache = {};
  if (window._apiInflight[key]) return window._apiInflight[key];
  if (cacheable) {
    var cached = window._apiCache[key];
    var now = Date.now();
    if (cached) {
      if (cached.err && now - cached.at < 3000) {
        var leftE = Math.max(1, Math.ceil((3000 - (now - cached.at)) / 1000));
        throw new Error('刚才这次请求已失败: ' + cached.err + '。请等待 ' + leftE + ' 秒后重试, 或刷新页面确认是否已生效。');
      }
      if (cached.data && now - cached.at < 15000) {
        var leftO = Math.max(1, Math.ceil((15000 - (now - cached.at)) / 1000));
        // 直接抛出提示, 阻断"表面上重复提交"的写操作; UI 层已有 alertModal 承接
        throw new Error('这次请求刚已提交过 (' + leftO + ' 秒前)。请刷新页面确认结果, 无需重复提交。');
      }
    }
  }
  var p = (async function(){
    showLoading(loadingTextOf(path, opts));
    try {
      setLoadingProgress(35);
      var res = await fetch(path, {
        method: method,
        headers: opts.body ? { 'Content-Type': 'application/json' } : {},
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        credentials: 'same-origin'
      });
      var data = {};
      try { data = await res.json(); } catch (e) {}
      if (!res.ok) throw new Error(data.message || ('请求失败: ' + res.status));
      setLoadingProgress(100);
      if (cacheable) window._apiCache[key] = { at: Date.now(), data: data };
      return data;
    } catch (err) {
      if (cacheable) window._apiCache[key] = { at: Date.now(), err: (err && err.message) || String(err) };
      throw err;
    } finally {
      hideLoading();
      // in-flight 释放: 保证 UI 侧下次可正常发起(缓存拦截由 _apiCache 负责)
      setTimeout(function(){ if (window._apiInflight) delete window._apiInflight[key]; }, 100);
    }
  })();
  window._apiInflight[key] = p;
  return p;
}
function showMsg(el, text, ok) {
  el.className = 'msg ' + (ok ? 'ok' : 'err');
  el.textContent = text;
}
function bindLogout() {
  bindClickBusy(document.getElementById('logoutBtn'), async function(e){
    if (e && e.preventDefault) e.preventDefault();
    try { await api('/api/auth/logout', { method: 'POST' }); } catch (err) {}
    location.href = '/login';
  });
  bindClickBusy(document.getElementById('stopImpersonateBtn'), async function(e){
    if (e && e.preventDefault) e.preventDefault();
    await api('/api/admin/stop-impersonate', { method: 'POST' });
    location.href = '/admin';
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
  var wasOpen = mask.classList.contains('show');
  document.getElementById('modalTitle').textContent = title || '';
  document.getElementById('modalBody').innerHTML = bodyHtml || '';
  mask.classList.add('show');
  // 已打开时(如 confirmModal 内部再次 openModal)不重复上锁, 避免引用计数与 close 不匹配
  if (!wasOpen) lockBodyScroll();
  // 弹窗内 textarea 支持 data-autogrow：随内容高度自动撑开
  var box = document.getElementById('modalBody');
  var tas = box ? box.querySelectorAll('textarea[data-autogrow]') : [];
  Array.prototype.forEach.call(tas, function(ta){ autoGrowTextarea(ta); });
  // 待办表单: 重复下拉 → 联动"每 N 单位"数字框显隐与单位文案
  if (box && box.querySelector && box.querySelector('#tfRecur')) todoBindRecurUI();
}
function closeModal() {
  var mask = document.getElementById('modalMask');
  if (!mask) return;
  var wasOpen = mask.classList.contains('show');
  mask.classList.remove('show');
  if (wasOpen) unlockBodyScroll();
}
// 全局滚动锁: 弹窗(modal + mp-menu)打开时锁, 关闭时恢复.
// 用引用计数, 因为可能同时打开多个层(如 modal 里再开 confirmModal)
// iOS Safari 单纯 overflow:hidden 仍能滑动, 需 body.no-scroll (position:fixed) 兼容
var _bodyScrollLockCount = 0;
var _bodyScrollY = 0;
function lockBodyScroll() {
  if (_bodyScrollLockCount === 0) {
    _bodyScrollY = window.scrollY || window.pageYOffset || 0;
    document.body.style.top = -_bodyScrollY + 'px';
    document.body.classList.add('no-scroll');
  }
  _bodyScrollLockCount++;
}
function unlockBodyScroll() {
  if (_bodyScrollLockCount > 0) _bodyScrollLockCount--;
  if (_bodyScrollLockCount === 0) {
    document.body.classList.remove('no-scroll');
    document.body.style.top = '';
    window.scrollTo(0, _bodyScrollY);
  }
}
function bindModal() {
  var mask = document.getElementById('modalMask');
  if (!mask) return;
  var close = document.getElementById('modalClose');
  if (close) close.addEventListener('click', closeModal);
  mask.addEventListener('click', function(e){ if (e.target === mask) closeModal(); });
}
function confirmModal(title, message, onConfirm) {
  openModal(title || '确认操作',
    '<p style="line-height:1.6;word-break:break-all;">' + esc(message) + '</p>' +
    '<div style="text-align:right;margin-top:18px;"><button type="button" class="btn gray" onclick="closeModal()">取消</button> <button type="button" class="btn danger" id="cmConfirm">确认</button></div>');
  // 用 bindClickBusy 统一防重: 三层防护 (btn.disabled + _busy + data-busy CSS)
  // handler 内先关弹窗再执行 onConfirm, 与原语义一致; 期间用户看到全局 loading 遮罩
  bindClickBusy(document.getElementById('cmConfirm'), async function(){
    closeModal();
    await onConfirm();
  });
}
// 结果弹窗：独立遮罩，仅「确定」按钮或 ESC 可关闭，点击空白不关闭。ok 控制标题图标/色
function alertModal(message, opts) {
  opts = opts || {};
  var title = opts.title || (opts.ok === false ? '操作失败' : '操作成功');
  var icon = opts.ok === false ? '❌' : '✅';
  var mask = document.createElement('div');
  mask.className = 'modal-mask show';
  mask.style.zIndex = '10001';
  mask.innerHTML = '<div class="modal-box">' +
    '<div class="modal-head"><span>' + icon + ' ' + esc(title) + '</span></div>' +
    '<div class="modal-body">' +
      '<p style="line-height:1.6;word-break:break-all;">' + esc(message) + '</p>' +
      '<div style="text-align:right;margin-top:18px;"><button class="btn amOk">确定</button></div>' +
    '</div></div>';
  var locked = false;
  function shut(){ mask.remove(); document.removeEventListener('keydown', onKey, true); if (locked) { locked = false; unlockBodyScroll(); } }
  function onKey(e){ if (e.key === 'Escape') shut(); }
  mask.querySelector('.amOk').addEventListener('click', shut);
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(mask);
  lockBodyScroll(); locked = true;
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
  // 底部"完成"按钮: 只在窄屏 CSS 显示, 让用户明确关闭. 桌面下 .mp-done { display:none } 隐藏
  var doneBtn = document.createElement('button');
  doneBtn.type = 'button'; doneBtn.className = 'mp-done'; doneBtn.textContent = '完成';
  doneBtn.addEventListener('click', function(e){ e.stopPropagation(); closeMenu(); });
  menu.appendChild(doneBtn);
  // 关闭时: 若菜单被移到 body(窄屏模式), 归位回 container, 避免下次初始化引用错乱
  function closeMenu(){
    var wasShown = menu.classList.contains('show');
    menu.classList.remove('show');
    if (menu.parentNode !== container) container.appendChild(menu);
    if (wasShown && menu._locked) { menu._locked = false; unlockBodyScroll(); }
  }
  btn.addEventListener('click', function(e){
    e.stopPropagation();
    var open = menu.classList.contains('show');
    // 关闭所有其他菜单, 并各自归位 (含滚动锁释放)
    document.querySelectorAll('.mp-menu.show').forEach(function(m){
      m.classList.remove('show');
      if (m._returnTo && m.parentNode !== m._returnTo) m._returnTo.appendChild(m);
      if (m._locked) { m._locked = false; unlockBodyScroll(); }
    });
    if (!open) {
      // 窄屏关键: .card 上的 z-index/backdrop-filter 都会创建独立堆叠上下文,
      // 内部 .mp-menu 无论 z-index 多高都被封印在 card 层. 唯一出路是把节点移到 body 末尾.
      var isMobile = window.matchMedia && window.matchMedia('(max-width:640px)').matches;
      if (isMobile) {
        menu._returnTo = container;
        if (menu.parentNode !== document.body) document.body.appendChild(menu);
        menu._locked = true; lockBodyScroll();
      } else {
        if (menu.parentNode !== container) container.appendChild(menu);
      }
      menu.classList.add('show');
    }
  });
  container.innerHTML = '';
  container.appendChild(btn);
  container.appendChild(menu);
  refresh();
  return { getValues: values, getString: function(){ return values().join(','); } };
}
document.addEventListener('click', function(e){
  // 点击面板外任意区域关闭菜单. 注意窄屏时菜单被移到 body, 所以对 target 判断是"不在 .multi-pick 内且不在 .mp-menu 内".
  if (!e.target.closest('.multi-pick') && !e.target.closest('.mp-menu')) {
    document.querySelectorAll('.mp-menu.show').forEach(function(m){
      m.classList.remove('show');
      if (m._returnTo && m.parentNode !== m._returnTo) m._returnTo.appendChild(m);
      if (m._locked) { m._locked = false; unlockBodyScroll(); }
    });
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
  // mp-menu-list: 窄屏改为单列 + 允许换行, 避免长渠道名撑爆容器出现横向滚动
  menu.className = 'mp-menu mp-menu-list';
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
  // 见 initMultiPick 同名注释
  var doneBtn = document.createElement('button');
  doneBtn.type = 'button'; doneBtn.className = 'mp-done'; doneBtn.textContent = '完成';
  doneBtn.addEventListener('click', function(e){ e.stopPropagation(); closeMenu(); });
  menu.appendChild(doneBtn);
  function closeMenu(){
    var wasShown = menu.classList.contains('show');
    menu.classList.remove('show');
    if (menu.parentNode !== container) container.appendChild(menu);
    if (wasShown && menu._locked) { menu._locked = false; unlockBodyScroll(); }
  }
  btn.addEventListener('click', function(e){
    e.stopPropagation();
    var open = menu.classList.contains('show');
    document.querySelectorAll('.mp-menu.show').forEach(function(m){
      m.classList.remove('show');
      if (m._returnTo && m.parentNode !== m._returnTo) m._returnTo.appendChild(m);
      if (m._locked) { m._locked = false; unlockBodyScroll(); }
    });
    if (!open) {
      var isMobile = window.matchMedia && window.matchMedia('(max-width:640px)').matches;
      if (isMobile) {
        menu._returnTo = container;
        if (menu.parentNode !== document.body) document.body.appendChild(menu);
        menu._locked = true; lockBodyScroll();
      } else {
        if (menu.parentNode !== container) container.appendChild(menu);
      }
      menu.classList.add('show');
    }
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
  var tk = location.pathname.split('/').filter(Boolean).pop();
  bindClickBusy(document.getElementById('quickLoginBtn'), async function(e){
    if (e && e.preventDefault) e.preventDefault();
    var r = await api('/api/public/quick-login/' + kind + '/' + tk, { method: 'POST' });
    location.href = r.redirect || '/dashboard';
  });
}
// 图表横屏全屏查看：给页面每个图表 canvas 加「⛶」按钮，点击把 canvas 移入旋转 90° 的全屏层
// 依赖 Chart.js v4 的 ResizeObserver：canvas 移入新尺寸容器后自动重绘，无需操作图表实例
// (注意: initChartFullscreen 定义在本片段中段, 见下方同名函数)
// ============ 日期人性化 label(与后端 services/todo.service.js 逻辑一致) ============
// 今天/昨天/明天 → 中文; 本周内(ISO 周, 周一为首) → 本周一~本周日; 否则 MM/DD
var _CN_WEEKDAY = ['周日','周一','周二','周三','周四','周五','周六'];
function todoDateLabel(dueDate, today) {
  if (!dueDate || dueDate.length < 10) return '';
  if (!today || today.length < 10) return dueDate.slice(5,7) + '/' + dueDate.slice(8,10);
  var dMs = Date.UTC(+dueDate.slice(0,4), +dueDate.slice(5,7)-1, +dueDate.slice(8,10));
  var tMs = Date.UTC(+today.slice(0,4), +today.slice(5,7)-1, +today.slice(8,10));
  var diff = Math.round((dMs - tMs) / 86400000);
  if (diff === 0) return '今天';
  if (diff === -1) return '昨天';
  if (diff === 1) return '明天';
  var tDow = new Date(tMs).getUTCDay();
  var monOff = (tDow + 6) % 7;
  var monMs = tMs - monOff * 86400000;
  var sunMs = monMs + 6 * 86400000;
  if (dMs >= monMs && dMs <= sunMs) return '本' + _CN_WEEKDAY[new Date(dMs).getUTCDay()];
  return dueDate.slice(5,7) + '/' + dueDate.slice(8,10);
}

// ============ 全局左滑返回手势 ============
// 触发条件: 任意位置起手, 水平右滑 > 60 且垂直位移 < 0.5×水平位移
// 优先级依次关闭: 抽屉 → 图表全屏 → modal → 待办详情 → 待办全屏 → history.back / 回 dashboard
// 排除: input/select/textarea/button/a/.mp-menu/.todo-drag/横向可滚动区域 内部起手, 避免误伤原生手势
// 兼容性: touchstart/touchmove/touchend 覆盖手机(含微信 X5 / WKWebView, 那里 pointer events 不稳);
//         pointerdown/move/up 覆盖桌面; 双路径同一状态机, 有 fired 标志防重触发
function initGlobalSwipeBack() {
  if (window._swipeBackReady) return;
  window._swipeBackReady = 1;
  var startX = 0, startY = 0, tracking = false, fired = false;
  var THRESHOLD_X = 60, MAX_Y_RATIO = 0.5;
  function insideHorizScroll(el) {
    for (var p = el; p && p !== document.body; p = p.parentElement) {
      if (!p.getBoundingClientRect) break;
      // 命中横向滚动容器时放行, 避免劫持内容内滑动
      try {
        var style = getComputedStyle(p);
        if ((style.overflowX === 'auto' || style.overflowX === 'scroll') && p.scrollWidth > p.clientWidth) return true;
      } catch (e) { /* ignore */ }
    }
    return false;
  }
  // 起手判定: 起点合法则开始跟踪
  function onStart(x, y, target) {
    tracking = false; fired = false;
    if (!target) return;
    var tag = (target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    if (target.closest && (target.closest('button') || target.closest('a'))) return;
    if (target.closest && (target.closest('.todo-drag') || target.closest('.mp-menu') || target.closest('input[type=range]'))) return;
    if (insideHorizScroll(target)) return;
    tracking = true;
    startX = x; startY = y;
  }
  // 移动判定: 达到阈值即触发, 只触发一次(fired); 反向/大幅垂直则中止
  function onMove(x, y) {
    if (!tracking || fired) return;
    var dx = x - startX;
    var dy = Math.abs(y - startY);
    if (dx > THRESHOLD_X && dy < dx * MAX_Y_RATIO) {
      fired = true; tracking = false;
      handleSwipeBack();
    } else if (dx < -8 || dy > 30) {
      tracking = false;
    }
  }
  // pointer events (桌面兜底)
  document.addEventListener('pointerdown', function(e){
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // touch/pen 由 touch 分支处理, 避免同一次触摸重复触发
    if (e.pointerType === 'touch' || e.pointerType === 'pen') return;
    onStart(e.clientX, e.clientY, e.target);
  }, { passive: true });
  document.addEventListener('pointermove', function(e){
    if (e.pointerType === 'touch' || e.pointerType === 'pen') return;
    onMove(e.clientX, e.clientY);
  }, { passive: true });
  document.addEventListener('pointerup', function(e){
    if (e.pointerType === 'touch' || e.pointerType === 'pen') return;
    tracking = false;
  }, { passive: true });
  // touch events (手机主路径, 包括微信内置浏览器)
  document.addEventListener('touchstart', function(e){
    if (!e.touches || e.touches.length !== 1) { tracking = false; return; }
    var t = e.touches[0];
    onStart(t.clientX, t.clientY, e.target);
  }, { passive: true });
  document.addEventListener('touchmove', function(e){
    if (!e.touches || e.touches.length !== 1) { tracking = false; return; }
    var t = e.touches[0];
    onMove(t.clientX, t.clientY);
  }, { passive: true });
  document.addEventListener('touchend', function(){ tracking = false; }, { passive: true });
  document.addEventListener('touchcancel', function(){ tracking = false; }, { passive: true });
  function handleSwipeBack() {
    // 1. 待办抽屉打开 → 关抽屉
    var drawer = document.getElementById('todoDrawer');
    if (drawer && drawer.classList.contains('open')) {
      try { window._todoDrawerOpen = false; } catch(e){}
      try { localStorage.setItem('todoDrawer', '0'); } catch(e){}
      drawer.classList.remove('open'); drawer.classList.add('closed');
      var m = document.getElementById('todoDrawerMask');
      if (m) m.classList.remove('show');
      return;
    }
    // 2. 图表全屏遮罩
    var chartMask = document.querySelector('.chart-fs-mask');
    if (chartMask) {
      var closeBtn = chartMask.querySelector('.chart-fs-close');
      if (closeBtn) closeBtn.click();
      return;
    }
    // 3. modal 遮罩
    var modal = document.getElementById('modalMask');
    if (modal && modal.classList.contains('show')) { closeModal(); return; }
    // 4. 待办详情面包屑(先于全屏关闭: 详情本身仍处于全屏容器中, 若先退出全屏会跳过返回卡片列表这一步)
    //    判据用面包屑 DOM 可见性, 比 offsetParent 更稳(卡片视图与全屏视图都可能出现详情)
    var crumb = document.getElementById('todoCrumb');
    if (crumb && crumb.style.display !== 'none' && crumb.style.display !== '') {
      var back = crumb.querySelector('.todo-crumb__back');
      if (back) { back.click(); return; }
    }
    // 5. 待办全屏
    if (document.body.classList.contains('todo-fs-on')) {
      var exitBtn = document.getElementById('exitFullscreen');
      if (exitBtn) { exitBtn.click(); return; }
    }
    // 6. 兜底: history.back / 回 dashboard
    var canBack = false;
    try {
      if (document.referrer) {
        var u = new URL(document.referrer);
        if (u.origin === location.origin) canBack = true;
      }
    } catch(e){}
    if (canBack && history.length > 1) { history.back(); return; }
    // 登录页不做兜底跳转
    if (location.pathname === '/login' || location.pathname === '/setup') return;
    location.href = '/dashboard';
  }
}

// 页面加载后自动为所有图表加横屏按钮（canvas 为静态元素，DOM 就绪即存在）
function initChartFullscreen() {
  var canvases = document.querySelectorAll('canvas');
  Array.prototype.forEach.call(canvases, function(cv){
    if (cv.getAttribute('data-fs-ready')) return;
    cv.setAttribute('data-fs-ready', '1');
    // 用一层紧贴图表的相对定位容器包住 canvas，按钮定位其内右上角（避免落到整张卡片右上撞标题）
    var wrap = document.createElement('div');
    wrap.className = 'chart-fs-wrap';
    cv.parentNode.insertBefore(wrap, cv);
    wrap.appendChild(cv);
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'chart-fs-btn'; btn.title = '放大查看'; btn.innerHTML = ICONS.fs_expand;
    btn.addEventListener('click', function(e){ e.stopPropagation(); openChartFullscreen(cv); });
    wrap.appendChild(btn);
  });
}
function openChartFullscreen(cv) {
  // 关键：不碰原图表实例，避免污染其尺寸/比例。全屏时用原图配置新建一个临时实例，关闭时销毁
  var src = (typeof Chart !== 'undefined' && Chart.getChart) ? Chart.getChart(cv) : null;
  if (!src) return;
  var mask = document.createElement('div');
  mask.className = 'chart-fs-mask';
  var stage = document.createElement('div');
  stage.className = 'chart-fs-stage';
  var fsCanvas = document.createElement('canvas');
  stage.appendChild(fsCanvas);
  var close = document.createElement('button');
  close.type = 'button'; close.className = 'chart-fs-close'; close.title = '关闭'; close.innerHTML = ICONS.close_x;;
  var fsChart = null;
  var locked = false;
  function shut(){
    if (fsChart) fsChart.destroy();
    mask.remove();
    document.removeEventListener('keydown', onKey, true);
    if (locked) { locked = false; unlockBodyScroll(); }
  }
  function onKey(e){ if (e.key === 'Escape') shut(); }
  close.addEventListener('click', shut);
  mask.addEventListener('click', function(e){ if (e.target === mask) shut(); });
  document.addEventListener('keydown', onKey, true);
  mask.appendChild(stage);
  mask.appendChild(close);
  document.body.appendChild(mask);
  lockBodyScroll(); locked = true;
  // 用原图的 type/data + options 副本新建；data 深拷贝，避免两实例共享引用导致图例 toggle 互相污染
  var opts = Object.assign({}, src.config.options, { responsive: true, maintainAspectRatio: false });
  var dataCopy;
  try { dataCopy = JSON.parse(JSON.stringify(src.config.data)); } catch(e) { dataCopy = src.config.data; }
  fsChart = new Chart(fsCanvas, { type: src.config.type, data: dataCopy, options: opts });
}
// textarea 自动增高：输入内容超过最小高度时按 scrollHeight 撑开
// 用于长标题/备注编辑，避免固定 2 行导致内容被隐藏
function autoGrowTextarea(el) {
  if (!el || el.__agBound) return;
  el.__agBound = 1;
  var min = 44;
  function fit() {
    el.style.height = min + 'px';
    el.style.height = Math.max(min, el.scrollHeight) + 'px';
  }
  el.style.overflowY = 'hidden';
  el.style.minHeight = min + 'px';
  el.addEventListener('input', fit);
  // 初次调用：编辑已有内容时也能一开始就撑开
  setTimeout(fit, 0);
}
// 按钮点击立即禁用防重：handler 是 async 函数, 完成/失败均恢复; 失败时用 alertModal 提示
// btn 允许传 null（可选按钮不存在时静默跳过）
// 三层防护: (1) btn.disabled 拦截 dom click (2) _busy 标志二次拦截 (3) 视觉上文字变"处理中…"给用户明确反馈
function bindClickBusy(btn, handler) {
  if (!btn) return;
  btn.addEventListener('click', async function(e) {
    if (btn.disabled || btn._busy) return;
    btn._busy = true;
    btn.disabled = true;
    btn.setAttribute('data-busy', '1');
    // 保存原文本, busy 期间改成"处理中…" (仅当按钮内是纯文本, 含 svg/img 的复合按钮跳过替换)
    var originalText = null;
    if (btn.childElementCount === 0 && btn.textContent && btn.textContent.trim()) {
      originalText = btn.textContent;
      btn.textContent = '处理中…';
    }
    try { await handler.call(btn, e); }
    catch (err) { alertModal((err && err.message) || String(err), { ok: false }); }
    finally {
      btn._busy = false;
      btn.disabled = false;
      btn.removeAttribute('data-busy');
      if (originalText != null) btn.textContent = originalText;
    }
  });
}
// 页面加载后自动为所有图表加横屏按钮（canvas 为静态元素，DOM 就绪即存在）
// 同步启用全局左滑返回手势(pointer events, 移动端/桌面通用, 从左缘 24px 起手)
function _initGlobalUX() { initChartFullscreen(); initGlobalSwipeBack(); }
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initGlobalUX);
} else {
  _initGlobalUX();
}

// ========= 数字/金额格式化 =========
// fmtMoney(v)         => 千分位, 保留原有小数位, 如 100000.12 => "100,000.12"; 100000 => "100,000"
// fmtMoney(v, {frac:2})=> 强制 2 位小数, 100000 => "100,000.00"
// 非数字 / null / '' / NaN => 原样返回或空串
// 全局挂在 window, 供各页 script (COMMON_JS 内的独立函数) 直接用
function fmtMoney(v, opts) {
  opts = opts || {};
  if (v === null || v === undefined || v === '') return '';
  var n = typeof v === 'number' ? v : parseFloat(v);
  if (!isFinite(n)) return v;
  var frac;
  if (opts.frac !== undefined) frac = opts.frac;
  else {
    // 根据源值判断小数位: 整数 0 位, 有小数最多 4 位
    var s = String(v);
    var dot = s.indexOf('.');
    frac = dot >= 0 ? Math.min(4, s.length - dot - 1) : 0;
  }
  var fixed = n.toFixed(frac);
  var parts = fixed.split('.');
  parts[0] = parts[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
  return parts.join('.');
}
// 兼容 sign(): 保留 + 号但用千分位;
// 用法: sign(t.profit) => 千分位; sign(t.profit, true) => 带千分位但不强制显示 +（用于百分比场景）
function fmtSign(n, hidePlus) {
  var num = typeof n === 'number' ? n : parseFloat(n);
  if (!isFinite(num)) return String(n);
  var s = fmtMoney(num);
  return (num >= 0 && !hidePlus) ? '+' + s : s;
}
window.fmtMoney = fmtMoney;
window.fmtSign = fmtSign;
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
bindModal();
var msg = document.getElementById('msg');
(async function(){
  try {
    var d = await api('/api/auth/profile');
    document.getElementById('pfUsername').value = d.profile.username;
    document.getElementById('pfNick').value = d.profile.nickname;
    var ql = document.getElementById('qlRestrict');
    if (ql) ql.checked = d.profile.restrict_quicklogin != 0;
  } catch(e){ location.href = '/login'; }
})();
// 免密登录限制开关：切换即保存
var qlEl = document.getElementById('qlRestrict');
if (qlEl) qlEl.addEventListener('change', async function(){
  try {
    await api('/api/auth/quicklogin-restrict', { method:'PUT', body:{ enabled: qlEl.checked } });
    showMsg(msg, '免密登录设置已保存', true);
  } catch(err){ showMsg(msg, err.message, false); qlEl.checked = !qlEl.checked; }
});
// 模块级重置免密链接
window.resetShare = async function(module){
  var names = { fund:'基金', weight:'体重', asset:'资产', todo:'待办' };
  confirmModal('重置免密链接', '确认重置「' + (names[module]||module) + '」的全部免密链接？旧链接将立即失效。', async function(){
    try {
      var r = await api('/api/share/reset/' + module, { method:'POST' });
      showMsg(msg, r.message, true);
    } catch(err){ showMsg(msg, err.message, false); }
  });
};
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

// D1 存储的 datetime('now') 是 UTC 'YYYY-MM-DD HH:mm:ss'
// 沿用项目其他前端处理惯例 +8 小时展示北京时间; 空值显示破折号
function fmtUTC2CN(s) {
  if (!s) return '<span class="muted">—</span>';
  var t = Date.parse(String(s).replace(' ', 'T') + 'Z');
  if (isNaN(t)) return esc(s);
  var d = new Date(t + 8*3600*1000);
  var pad = function(n){ return n < 10 ? '0'+n : ''+n; };
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth()+1) + '-' + pad(d.getUTCDate()) +
    ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
}

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
        '<td data-label="创建时间">' + fmtUTC2CN(u.created_at) + '</td>' +
        '<td data-label="最后登录">' + fmtUTC2CN(u.last_login_at) + '</td>' +
        '<td data-label="最后免密">' + fmtUTC2CN(u.last_public_at) + '</td>' +
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
  } catch (err) { alertModal(err.message, {ok:false}); if (err.message.indexOf('权限') >= 0 || err.message.indexOf('登录') >= 0) location.href = '/login'; }
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
      '</div>' +
      '<h2 style="font-size:15px;margin-top:16px;">重置免密链接</h2>' +
      '<p class="muted" style="font-size:12px;">重置后该用户对应模块的全部旧免密链接立即失效。</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;">' +
        '<button class="btn sm gray" onclick="adminResetShare(' + d.user.id + ",'fund'" + ')">基金</button>' +
        '<button class="btn sm gray" onclick="adminResetShare(' + d.user.id + ",'weight'" + ')">体重</button>' +
        '<button class="btn sm gray" onclick="adminResetShare(' + d.user.id + ",'asset'" + ')">资产</button>' +
        '<button class="btn sm gray" onclick="adminResetShare(' + d.user.id + ",'todo'" + ')">待办</button>' +
      '</div>';
    detail.scrollIntoView({ behavior: 'smooth' });
  } catch (err) { alertModal(err.message, {ok:false}); }
}
window.adminResetShare = async function(userId, module){
  var names = { fund:'基金', weight:'体重', asset:'资产', todo:'待办' };
  confirmModal('重置免密链接', '确认重置该用户「' + (names[module]||module) + '」的全部免密链接？旧链接将立即失效。', async function(){
    try {
      var r = await api('/api/admin/share/reset/' + module + '/' + userId, { method:'POST' });
      alertModal(r.message);
    } catch(err){ alertModal(err.message, {ok:false}); }
  });
};
async function toggleRole(id, cur) {
  var role = cur === 'admin' ? 'user' : 'admin';
  confirmModal('修改角色', '确认修改角色为 ' + role + ' ?', async function(){
    try { await api('/api/admin/users/' + id + '/role', { method: 'PUT', body: { role: role } }); loadUsers(); }
    catch (err) { alertModal(err.message, {ok:false}); }
  });
}
async function toggleStatus(id, cur) {
  var status = cur === 'active' ? 'disabled' : 'active';
  confirmModal('修改状态', '确认修改状态为 ' + status + ' ?', async function(){
    try { await api('/api/admin/users/' + id + '/status', { method: 'PUT', body: { status: status } }); loadUsers(); }
    catch (err) { alertModal(err.message, {ok:false}); }
  });
}
async function impersonate(id, name) {
  confirmModal('切换身份', '确认切换到 ' + name + ' 的身份浏览?', async function(){
    try { await api('/api/admin/users/' + id + '/impersonate', { method: 'POST' }); location.href = '/dashboard'; }
    catch (err) { alertModal(err.message, {ok:false}); }
  });
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
      closeModal(); alertModal(r.message);
    } catch (err) { alertModal(err.message, {ok:false}); }
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
      closeModal(); alertModal(r.message); loadUsers();
    } catch (err) { alertModal(err.message, {ok:false}); }
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
    try { var r = await api('/api/admin/users', { method: 'POST', body: payload }); closeModal(); alertModal(r.message); loadUsers(); }
    catch (err) { alertModal(err.message, {ok:false}); }
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

// ============ 推送日志管理 ============
var plState = { limit: 50, offset: 0, total: 0 };
var MODULE_LABEL = { fund:'基金', weight:'体重', asset:'资产', todo:'待办', monitor:'监控' };
var TRIGGER_LABEL = { cron:'定时', manual:'手动' };

// datetime-local 输入值 'YYYY-MM-DDTHH:mm' 视为北京时间(与页面其他时间显示统一), 转 UTC 'YYYY-MM-DD HH:mm:ss'
function plLocalToUtc(v) {
  if (!v) return '';
  var m = String(v).match(/^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2})$/);
  if (!m) return '';
  var t = Date.UTC(+m[1], +m[2]-1, +m[3], +m[4], +m[5]) - 8*3600*1000;
  var d = new Date(t);
  var pad = function(n){ return n<10?'0'+n:''+n; };
  return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)+'-'+pad(d.getUTCDate())+
    ' '+pad(d.getUTCHours())+':'+pad(d.getUTCMinutes())+':'+pad(d.getUTCSeconds());
}

async function loadPushLogs() {
  var q = new URLSearchParams();
  var m = document.getElementById('plModule').value;
  var uid = document.getElementById('plUserId').value.trim();
  var suc = document.getElementById('plSuccess').value;
  if (m) q.set('module', m);
  if (uid) q.set('user_id', uid);
  if (suc !== '') q.set('success', suc);
  q.set('limit', plState.limit);
  q.set('offset', plState.offset);
  try {
    var d = await api('/api/admin/push-log?' + q.toString());
    plState.total = d.total || 0;
    var body = document.getElementById('plTbody');
    body.innerHTML = (d.rows || []).map(function(r){
      var errCell = r.success ? '<span class="muted">—</span>' : ('<span style="color:#B42318;">' + esc(r.error || '') + '</span>');
      return '<tr>' +
        '<td data-label="时间">' + fmtUTC2CN(r.created_at) + '</td>' +
        '<td data-label="用户">' + esc(r.username || ('#' + r.user_id)) + '</td>' +
        '<td data-label="模块">' + (MODULE_LABEL[r.module] || r.module) + '</td>' +
        '<td data-label="渠道">' + esc(r.channel_name || ('#' + (r.channel_id || '-'))) + (r.channel_type ? ' <span class="muted">('+esc(r.channel_type)+')</span>' : '') + '</td>' +
        '<td data-label="格式">' + esc(r.format || '') + '</td>' +
        '<td data-label="触发">' + (TRIGGER_LABEL[r.trigger_by] || r.trigger_by) + '</td>' +
        '<td data-label="状态">' + (r.success ? '<span class="tag ok">成功</span>' : '<span class="tag fail">失败</span>') + '</td>' +
        '<td data-label="错误信息">' + errCell + '</td>' +
      '</tr>';
    }).join('');
    var from = plState.total === 0 ? 0 : (plState.offset + 1);
    var to = Math.min(plState.total, plState.offset + plState.limit);
    document.getElementById('plPage').textContent = from + '~' + to + ' / 共 ' + plState.total;
  } catch (err) { alertModal(err.message, {ok:false}); }
}

var plModuleEl = document.getElementById('plModule');
var plUserIdEl = document.getElementById('plUserId');
var plSuccessEl = document.getElementById('plSuccess');
if (plModuleEl) plModuleEl.addEventListener('change', function(){ plState.offset = 0; loadPushLogs(); });
if (plUserIdEl) plUserIdEl.addEventListener('change', function(){ plState.offset = 0; loadPushLogs(); });
if (plSuccessEl) plSuccessEl.addEventListener('change', function(){ plState.offset = 0; loadPushLogs(); });
var plRefreshBtn = document.getElementById('plRefresh');
if (plRefreshBtn) plRefreshBtn.addEventListener('click', function(){ loadPushLogs(); });
var plPrevBtn = document.getElementById('plPrev');
if (plPrevBtn) plPrevBtn.addEventListener('click', function(){
  if (plState.offset === 0) return;
  plState.offset = Math.max(0, plState.offset - plState.limit);
  loadPushLogs();
});
var plNextBtn = document.getElementById('plNext');
if (plNextBtn) plNextBtn.addEventListener('click', function(){
  if (plState.offset + plState.limit >= plState.total) return;
  plState.offset += plState.limit;
  loadPushLogs();
});

// 区间删除: 前端先查条数 → 弹窗二次确认 → 真删
var plDelBtn = document.getElementById('plDelRange');
if (plDelBtn) bindClickBusy(plDelBtn, async function(){
  var fromStr = plLocalToUtc(document.getElementById('plFrom').value);
  var toStr = plLocalToUtc(document.getElementById('plTo').value);
  if (!fromStr && !toStr) { alertModal('起始与结束时间至少填一个', {ok:false}); return; }
  if (fromStr && toStr && fromStr > toStr) { alertModal('起始时间不能晚于结束时间', {ok:false}); return; }
  var q = new URLSearchParams();
  if (fromStr) q.set('from', fromStr);
  if (toStr)   q.set('to', toStr);
  var cnt;
  try {
    var d = await api('/api/admin/push-log/count?' + q.toString());
    cnt = d.count || 0;
  } catch (err) { alertModal(err.message, {ok:false}); return; }
  if (cnt === 0) { alertModal('该区间内没有可删除的日志', {ok:false}); return; }
  var rangeText = '';
  if (fromStr) rangeText += '从 ' + (document.getElementById('plFrom').value || '').replace('T',' ');
  if (fromStr && toStr) rangeText += ' 到 ';
  if (toStr)   rangeText += (document.getElementById('plTo').value || '').replace('T',' ');
  confirmModal('确认删除推送日志',
    rangeText + ' 区间内共 ' + cnt + ' 条日志将被永久删除, 无法恢复。是否继续?',
    async function(){
      try {
        var r = await api('/api/admin/push-log/delete-range', { method: 'POST', body: { from: fromStr || null, to: toStr || null } });
        alertModal(r.message);
        plState.offset = 0;
        loadPushLogs();
      } catch (err) { alertModal(err.message, {ok:false}); }
    }
  );
});

loadPushLogs();
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
  confirmModal('删除任务', '确认删除该任务?', async function(){
    try { await api('/api/monitor/tasks/' + id, { method:'DELETE' }); await loadTasks(); }
    catch(e){ alertModal(e.message, {ok:false}); }
  });
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
  } catch(e){ alertModal(e.message, {ok:false}); }
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
  } catch(e){ alertModal(e.message, {ok:false}); }
});
document.getElementById('tNew').addEventListener('click', function(){ taskForm({}); });
document.getElementById('tCancel').addEventListener('click', function(){ document.getElementById('taskFormWrap').style.display='none'; });
document.getElementById('runNow').addEventListener('click', async function(){
  var btn = this; btn.disabled = true; btn.textContent = '执行中...';
  try {
    setLoadingProgress(90);
    var r = await api('/api/monitor/run', { method:'POST', loadingText: '正在执行全部监控任务…' });
    alertModal(r.message + '（任务数: ' + (r.results ? r.results.length : 0) + '）');
    await loadTasks();
  } catch(e){ alertModal(e.message, { ok:false }); }
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
    alertModal('定时配置已保存');
  } catch(e){ alertModal(e.message, {ok:false}); }
});
var mpSend = document.getElementById('mpSend');
if (mpSend) mpSend.addEventListener('click', async function(){
  var btn = this; btn.disabled = true; btn.textContent = '执行中...';
  try { setLoadingProgress(90); var r = await api('/api/monitor/run', { method:'POST', loadingText: '正在执行并推送监控任务…' }); alertModal(r.message || '执行完成'); }
  catch(e){ alertModal(e.message, { ok:false }); }
  finally { btn.disabled = false; btn.textContent = '立即执行并推送'; }
});

(async function(){
  try { await loadChannels(); await loadTasks(); await loadMonitorPush(); }
  catch(e){ if (String(e.message).indexOf('登录')>=0) location.href='/login'; else alertModal(e.message, {ok:false}); }
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
    } catch(e){ alertModal(e.message, {ok:false}); }
  });
}
window.editCh = function(id){ chModal((window._channels||[]).filter(function(x){return x.id===id;})[0]); };
window.delCh = async function(id){
  confirmModal('删除渠道', '确认删除该渠道?', async function(){
    try { await api('/api/notify/channels/' + id, { method:'DELETE' }); await loadChannels(); } catch(e){ alertModal(e.message, {ok:false}); }
  });
};
document.getElementById('chNew').addEventListener('click', function(){ chModal({}); });
(async function(){
  try { await loadChannels(); }
  catch(e){ if (String(e.message).indexOf('登录')>=0) location.href='/login'; else alertModal(e.message, {ok:false}); }
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
// 初始化加载进度：_initTotal>0 时按步数把进度目标推到累计百分比(平滑爬升)，复用调用(如加仓后)时 _initTotal=0 不动进度
var _initTotal = 0, _initStep = 0;
function stepText(t){
  if (_initTotal) setLoadingProgress(Math.round((++_initStep) / _initTotal * 100));
  return t;
}

function sign(n){ return fmtSign(n); }
function colorOf(n){ return n>=0 ? '#cf1322' : '#389e0d'; }

// ---------- 报表 ----------
async function loadReport() {
  var data = await api('/api/fund/report', { loadingText: stepText('正在拉取基金实时净值与收益汇总…') });
  // 防御性兜底: 微信 X5 内偶发 fetch 到非 JSON 响应时 data 会是 {}, totals/items 缺失导致 "cannot read properties of undefined (reading 'cost')"
  var t = data.totals || { cost: 0, value: 0, profit: 0, rate: 0 };
  var items = data.items || [];
  document.getElementById('sumCost').textContent = fmtMoney(t.cost, {frac:2});
  document.getElementById('sumValue').textContent = fmtMoney(t.value, {frac:2});
  var pe = document.getElementById('sumProfit');
  pe.textContent = sign(t.profit); pe.style.color = colorOf(t.profit);
  var re = document.getElementById('sumRate');
  re.textContent = sign(t.rate) + '%'; re.style.color = colorOf(t.rate);

  // 明细表（按创建时间倒序）
  var tb = document.getElementById('fundTbody');
  items = items.slice().sort(function(a,b){
    return (b.created_at||'').localeCompare(a.created_at||'');
  });
  tb.innerHTML = items.map(function(it){
    return '<tr><td data-label="基金">' + esc(it.name) + '<br><span class="muted">' + it.code + '</span></td>' +
      '<td data-label="份额">' + fmtMoney(it.shares) + '</td>' +
      '<td data-label="成本净值">' + it.cost_nav + '</td>' +
      '<td data-label="现价(估)">' + it.current_nav + ' <span style="color:' + colorOf(it.gszzl) + '">(' + sign(it.gszzl) + '%)</span></td>' +
      '<td data-label="本金">' + fmtMoney(it.cost, {frac:2}) + '</td>' +
      '<td data-label="现值">' + fmtMoney(it.value, {frac:2}) + '</td>' +
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
  window._items = items;

  drawChart(data.items);
  await loadProfitHistory();
}

function applyProfitFilter() {
  var rng = document.getElementById('profitRange').value;
  var labels = [], vals = [];
  var now = new Date(Date.now()+8*3600*1000);
  var cutoff = '';
  // 近 7 天 = 含今日往前 6 天, 共 7 天 (与 todo 的 todoRangeWindow 保持一致)
  //   原 (now - 7天) 会把 today-7 也放行, 实际渲染 8 天; 应用 6*86400000
  if (rng==='7d') { cutoff = new Date(now.getTime()-6*86400000).toISOString().slice(0,10); }
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
  var data = await api('/api/fund/profit-history', { loadingText: stepText('正在加载每日收益曲线…') });
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
    } catch(e){ alertModal(e.message, {ok:false}); }
  });
}
window.editFund = function(id){ fundForm((window._items||[]).filter(function(x){return x.id===id;})[0]); };
window.delFund = async function(id){
  confirmModal('删除持仓', '确认删除该持仓?', async function(){
    try { await api('/api/fund/' + id, { method:'DELETE' }); await loadReport(); }
    catch(e){ alertModal(e.message, {ok:false}); }
  });
};
window.shareLink = async function(id, reset){
  async function openShare(doReset) {
    var d = await api('/api/fund/' + id + '/share-link' + (doReset ? '?reset=1' : ''));
    openModal('免密加仓链接',
      '<p class="muted">此链接长期有效，任何人打开无需登录即可为该基金补录买入（自动累计份额并重算成本）。请妥善保管。</p>' +
      '<input id="shareUrl" value="' + esc(d.link) + '" readonly style="margin-bottom:8px;">' +
      '<button class="btn" onclick="copyShare()">复制链接</button> ' +
      '<button class="btn gray" onclick="shareLink(' + id + ', true)">重置链接</button>' +
      (doReset ? '<p class="msg ok" style="margin-top:8px;">链接已重置，旧链接已失效</p>' : ''));
  }
  if (reset) return confirmModal('重置链接', '重置后，旧链接将立即失效，已分享出去的旧链接将无法再使用。确认重置？', function(){ return openShare(true); });
  try { await openShare(false); } catch(e){ alertModal(e.message, {ok:false}); }
};
window.copyShare = function(){
  var el = document.getElementById('shareUrl');
  el.select();
  try { document.execCommand('copy'); alertModal('已复制'); } catch(e) { alertModal('请手动复制', {ok:false}); }
};
// 页面内加仓（弹窗）
window.buyFundUI = function(id){
  var f = (window._items||[]).filter(function(x){return x.id===id;})[0];
  if (!f) return;
  var html =
    '<p class="muted">当前持有 <b>' + fmtMoney(f.shares) + '</b> 份 · 成本净值 <b>' + f.cost_nav + '</b>。按金额买入，系统自动累计份额并重算成本。</p>' +
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
      alertModal('加仓成功！新增 ' + r.addShares + ' 份，当前共 ' + r.newShares + ' 份，成本净值 ' + r.newCostNav);
      await loadReport();
    } catch(e){ alertModal(e.message, {ok:false}); }
  });
};
document.getElementById('fNew').addEventListener('click', function(){ fundForm({}); });

// ---------- 日报配置（走通用 push API, module=fund）----------
var rcChannelPick = null;
async function loadReportConfig() {
  var chData = await api('/api/notify/channels', { loadingText: stepText('正在加载通知渠道…') });
  var items = chData.channels.map(function(c){ return { value: c.id, label: c.name + ' [' + c.type + ']' }; });

  var data = await api('/api/push/fund', { loadingText: stepText('正在加载日报推送配置…') });
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
  try { await api('/api/push/fund', { method:'PUT', body: payload }); alertModal('日报配置已保存'); }
  catch(e){ alertModal(e.message, {ok:false}); }
});
document.getElementById('rcSend').addEventListener('click', async function(){
  var btn = this; btn.disabled = true; btn.textContent = '发送中...';
  try { setLoadingProgress(90); var r = await api('/api/fund/report/send', { method:'POST', loadingText: '正在发送基金日报…' }); alertModal(r.message || '已推送'); }
  catch(e){ alertModal(e.message, { ok:false }); }
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
  } catch(e){ alertModal(e.message, {ok:false}); }
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
        '<td>' + fmtMoney(s.value, {frac:2}) + '</td>' +
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
  } catch(e){ alertModal(e.message, {ok:false}); }
});

(async function(){
  _initTotal = 4; _initStep = 0;   // loadReport(净值汇总+收益曲线) + loadReportConfig(渠道+推送配置)
  showLoading('加载中…');   // 外层占位：保持计数>0，使 4 个串行请求间进度不被归零重置
  try { await loadReport(); await loadReportConfig(); }
  catch(e){ if (String(e.message).indexOf('登录')>=0) location.href='/login'; else alertModal(e.message, {ok:false}); }
  finally { _initTotal = 0; hideLoading(); }
  // 绑定筛选（select 在 loadReport 时 DOM 已就绪）
  document.getElementById('profitRange').addEventListener('change', applyProfitFilter);
})();
`;

// 免密加仓公开页 JS（无需登录，通过 URL 中的 token 操作）
const PUBLIC_BUY_JS = `
${COMMON_JS}
var token = location.pathname.split('/').filter(Boolean).pop();
var msg = document.getElementById('msg');
var profitChartInst = null;

function drawProfitChart(series) {
  var box = document.getElementById('chartBox');
  var canvas = document.getElementById('profitChart');
  var tbody = document.getElementById('profitTbody');
  if (!box || !canvas || !tbody) return;
  if (!series || !series.length) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  var labels = series.map(function(s){ return s.date.slice(5); });
  var data = series.map(function(s){ return s.profit; });
  if (profitChartInst) profitChartInst.destroy();
  profitChartInst = new Chart(canvas, {
    type:'line',
    data:{ labels: labels, datasets:[{ label:'持仓收益(元)', data: data, borderColor:'#4a6cf7', backgroundColor:'rgba(74,108,247,.12)', fill:true, tension:.3 }] },
    options:{ plugins:{ legend:{ display:false } }, scales:{ y:{ title:{ display:true, text:'收益(元)' } } } }
  });
  // 明细表：日期倒序，含较前一天差额
  var sign = function(n){ return (n>=0?'+':'') + n; };
  var rows = [];
  for (var i = series.length - 1; i >= 0; i--) {
    var s = series[i];
    var delta = i > 0 ? Math.round((s.profit - series[i-1].profit) * 100) / 100 : null;
    var pc = s.profit >= 0 ? '#cf1322' : '#389e0d';
    var dc = delta != null ? (delta >= 0 ? '#cf1322' : '#389e0d') : '#999';
    var dt = delta != null ? sign(delta) + ' 元' : '—';
    rows.push('<tr><td data-label="日期">' + s.date + '</td>' +
      '<td data-label="持仓收益" style="color:' + pc + '">' + sign(s.profit) + ' 元</td>' +
      '<td data-label="较前一天" style="color:' + dc + '">' + dt + '</td></tr>');
  }
  tbody.innerHTML = rows.join('');
}

async function loadInfo() {
  try {
    setLoadingProgress(90);   // 单请求：推进度条爬升，营造实时加载进度感
    var d = await api('/api/public/fund/' + token, { loadingText: '正在加载基金信息与近30天收益曲线…' });
    var f = d.fund;
    document.getElementById('fundName').textContent = f.name + ' (' + f.code + ')';
    document.getElementById('curNav').textContent = f.current_nav + ' (' + (f.gszzl>=0?'+':'') + f.gszzl + '%)';
    document.getElementById('curShares').textContent = fmtMoney(f.shares);
    document.getElementById('curCost').textContent = f.cost_nav;
    document.getElementById('buyNav').value = f.current_nav || '';
    document.getElementById('content').style.display = 'block';
    drawProfitChart(d.profitSeries);
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
    var sharedTag = m.shared ? ' <span class="tag" style="background:#F5EBFE;color:#A855F7;padding:0 6px;border-radius:8px;font-size:11px;">共享</span>' : '';
    var delTitle = m.shared ? '移除共享' : '删除';
    return '<span class="tag user" style="margin:2px 4px;padding:4px 10px;">' +
      '<a href="#" onclick="selMember(' + m.id + ');return false;" style="color:inherit;text-decoration:none;">' + esc(m.name) + '</a>' + sharedTag +
      ' <a href="#" onclick="mRename(' + m.id + ",'" + esc(m.name).replace(/'/g,'') + "'" + ');return false;" style="margin-left:4px;">改名</a>' +
      ' <a href="#" onclick="mShare(' + m.id + ');return false;" style="margin-left:4px;">链接</a>' +
      ' <a href="#" title="' + delTitle + '" onclick="mDel(' + m.id + ');return false;" style="color:#cf1322;">×</a></span>';
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
  confirmModal('删除成员', '删除该成员及其记录?', async function(){
    try { await api('/api/weight/members/' + id, { method:'DELETE' }); await loadAll(); } catch(e){ alertModal(e.message, {ok:false}); }
  });
};
window.mRename = function(id, curName){
  openModal('修改成员名',
    '<label>成员名称</label><input id="mReName" value="' + esc(curName) + '">' +
    '<div style="margin-top:12px;"><button class="btn" id="mReConfirm">保存</button> <button class="btn gray" onclick="closeModal()">取消</button></div>');
  document.getElementById('mReConfirm').addEventListener('click', async function(){
    var name = document.getElementById('mReName').value;
    try { await api('/api/weight/members/' + id, { method:'PUT', body:{ name: name } }); closeModal(); await loadAll(); }
    catch(e){ alertModal(e.message, {ok:false}); }
  });
};
window.mShare = async function(id, reset){
  async function openShare(doReset) {
    var d = await api('/api/weight/members/' + id + '/share-link' + (doReset ? '?reset=1' : ''));
    openModal('免密填写链接',
      '<p class="muted">此链接长期有效，打开无需登录即可填写该成员当天体重。</p>' +
      '<input id="wShareUrl" value="' + esc(d.link) + '" readonly style="margin-bottom:8px;">' +
      '<button class="btn" onclick="wCopy()">复制链接</button> ' +
      '<button class="btn gray" onclick="mShare(' + id + ', true)">重置链接</button>' +
      (doReset ? '<p class="msg ok" style="margin-top:8px;">链接已重置，旧链接已失效</p>' : ''));
  }
  if (reset) return confirmModal('重置链接', '重置后，旧链接将立即失效，已分享出去的旧链接将无法再使用。确认重置？', function(){ return openShare(true); });
  try { await openShare(false); } catch(e){ alertModal(e.message, {ok:false}); }
};
window.wCopy = function(){ var el=document.getElementById('wShareUrl'); el.select(); try{document.execCommand('copy');alertModal('已复制');}catch(e){alertModal('请手动复制', {ok:false});} };
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
    } catch(e){ alertModal(e.message, {ok:false}); }
  });
};
window.recDel = async function(id){
  confirmModal('删除记录', '删除该记录?', async function(){
    try { await api('/api/weight/records/' + id, { method:'DELETE' }); await loadAll(); } catch(e){ alertModal(e.message, {ok:false}); }
  });
};

document.getElementById('mAdd').addEventListener('click', function(){
  openModal('新建成员',
    '<label>成员名称</label><input id="mName">' +
    '<div style="margin-top:12px;"><button class="btn" id="mConfirm">创建</button> <button class="btn gray" onclick="closeModal()">取消</button></div>');
  document.getElementById('mConfirm').addEventListener('click', async function(){
    try { await api('/api/weight/members', { method:'POST', body:{ name: document.getElementById('mName').value } }); closeModal(); await loadAll(); }
    catch(e){ alertModal(e.message, {ok:false}); }
  });
});
document.getElementById('recAdd').addEventListener('click', async function(){
  var w = document.getElementById('recWeight').value;
  if (!w) { alertModal('请填写体重', {ok:false}); return; }
  var payload = { member_id: document.getElementById('recMember').value, weight: toKg(w),
    record_date: document.getElementById('recDate').value || undefined };
  try { var r = await api('/api/weight/records', { method:'POST', body: payload }); alertModal(r.message);
    document.getElementById('recWeight').value = ''; await loadAll(); }
  catch(e){ alertModal(e.message, {ok:false}); }
});
// 单位设置
var unitSel = document.getElementById('unitSel');
if (unitSel) unitSel.addEventListener('change', async function(){
  try { await api('/api/weight/unit', { method:'PUT', body:{ weight_unit: this.value } }); await loadAll(); }
  catch(e){ alertModal(e.message, {ok:false}); }
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
// 超管：引用其他账号的成员到自己名下
async function initShare() {
  var wrap = document.getElementById('shareCard');
  if (!wrap) return;
  try {
    var d = await api('/api/admin/weight/all-members');
    var sel = document.getElementById('shareMemberSel');
    // 排除已在我名下的成员（自己拥有的 + 已引用的）
    var ownedIds = {};
    members.forEach(function(m){ ownedIds[m.id] = 1; });
    var opts = d.members.filter(function(m){ return !ownedIds[m.id]; }).map(function(m){
      return '<option value="' + m.id + '">' + esc(m.name) + ' · ' + esc(m.owner_nick || m.owner_name) + '</option>';
    }).join('');
    sel.innerHTML = opts || '<option value="">暂无可引用的成员</option>';
    wrap.style.display = 'block';
  } catch(e){ /* 非超管忽略 */ }
}
async function runShare() {
  var sel = document.getElementById('shareMemberSel');
  var mid = sel && sel.value ? parseInt(sel.value, 10) : NaN;
  if (isNaN(mid)) { alertModal('请选择要引用的成员', {ok:false}); return; }
  try {
    var r = await api('/api/admin/weight/share', { method:'POST', body:{ member_id: mid } });
    alertModal(r.message); await loadAll(); await initShare();
  } catch(e){ alertModal(e.message, {ok:false}); }
}
async function runCompare() {
  var ids = Array.prototype.slice.call(document.querySelectorAll('#cmpUsers input:checked')).map(function(x){ return x.value; });
  if (!ids.length) { alertModal('请至少选择一个用户', {ok:false}); return; }
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
var shareBtn = document.getElementById('shareRun');
if (shareBtn) shareBtn.addEventListener('click', runShare);

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
    alertModal('推送配置已保存');
  } catch(e){ alertModal(e.message, {ok:false}); }
});
var pushSend = document.getElementById('pushSend');
if (pushSend) pushSend.addEventListener('click', async function(){
  var btn = this; btn.disabled = true; btn.textContent = '推送中...';
  try { setLoadingProgress(90); var r = await api('/api/push/weight/send', { method:'POST', loadingText: '正在发送体重日报…' }); alertModal(r.message || '已推送'); }
  catch(e){ alertModal(e.message, { ok:false }); }
  finally { btn.disabled = false; btn.textContent = '立即推送'; }
});

(async function(){
  try { await loadAll(); initFilter(); await loadPush(); await initCompare(); await initShare(); }
  catch(e){ if (String(e.message).indexOf('登录')>=0) location.href='/login'; else alertModal(e.message, {ok:false}); }
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

// 真实连续打卡天数：从今天(或最近打卡日)起往回数，日期连续则累加，断签即止
function calcStreak(records, today){
  if (!records || !records.length) return 0;
  var set = {};
  records.forEach(function(r){ if (r.record_date) set[r.record_date] = 1; });
  // 未打卡时从昨天起算，避免今日未打卡就显示 0 打断连续感
  var cur = set[today] ? today : _shiftDay(today, -1);
  var n = 0;
  while (set[cur]) { n++; cur = _shiftDay(cur, -1); }
  return n;
}
function _shiftDay(ymd, delta){
  var d = new Date(ymd + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0,10);
}
// 火苗强度：天数越多火越旺
function renderStreak(streak){
  var el = document.getElementById('streakLine');
  if (!el) return;
  if (streak <= 0) { el.style.display = 'none'; return; }
  var flames = streak >= 100 ? '🔥🔥🔥' : streak >= 30 ? '🔥🔥' : '🔥';
  el.style.display = 'block';
  el.innerHTML = '<span class="wk-flame">' + flames + '</span> 连续打卡 ' + streak + ' 天';
}
// 里程碑庆祝：命中 7/30/100 天弹成功弹窗
function milestoneCheer(streak){
  var map = { 7: '坚持满一周啦，习惯正在养成！🎉', 30: '连续打卡满 30 天，太自律了！🏆', 100: '连续 100 天！了不起的毅力！👑' };
  if (map[streak]) alertModal(map[streak], { title: '连续打卡 ' + streak + ' 天' });
}
// 本月打卡日历热力图：打过卡的日子绿色，justDay 为刚打卡的日子加点亮动画
function renderCalendar(records, today, justDay){
  var box = document.getElementById('calBox');
  if (!box) return;
  var month = today.slice(0,7);
  var done = {};
  records.forEach(function(r){ if ((r.record_date||'').slice(0,7) === month) done[r.record_date] = 1; });
  var y = parseInt(month.slice(0,4),10), mo = parseInt(month.slice(5,7),10);
  var first = new Date(Date.UTC(y, mo-1, 1));
  var startWd = first.getUTCDay(); // 0=周日
  var daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  var heads = ['日','一','二','三','四','五','六'];
  var html = '<div style="color:#888;font-size:13px;margin-bottom:6px;">' + mo + ' 月打卡</div><div class="wk-cal-grid">';
  heads.forEach(function(h){ html += '<div class="wk-cal-head">' + h + '</div>'; });
  for (var i=0;i<startWd;i++) html += '<div></div>';
  for (var d=1;d<=daysInMonth;d++){
    var ymd = month + '-' + (d<10?'0':'') + d;
    var cls = 'wk-cal-cell';
    if (done[ymd]) cls += ' wk-cal-done';
    if (ymd === today) cls += ' wk-cal-today';
    if (justDay && ymd === justDay) cls += ' wk-cal-pop';
    html += '<div class="' + cls + '">' + d + '</div>';
  }
  html += '</div>';
  box.innerHTML = html;
}
// 数字滚动：把今日体重从 0 滚到实际值
function animateWeight(elId, target){
  var el = document.getElementById(elId);
  if (!el) return;
  var dur = 700, start = null, from = 0;
  function step(ts){
    if (start === null) start = ts;
    var p = Math.min(1, (ts - start) / dur);
    var val = (from + (target - from) * p);
    el.value = (Math.round(val*10)/10);
    if (p < 1) requestAnimationFrame(step);
    else el.value = target;
  }
  requestAnimationFrame(step);
}
// 情绪反馈：对比昨日，减重😄 增重💪 持平😐
function renderMood(records, today){
  var box = document.getElementById('moodBox');
  if (!box) return;
  var asc = records.slice().sort(function(a,b){ return (a.record_date||'').localeCompare(b.record_date||''); });
  if (asc.length < 2) { box.textContent = ''; return; }
  var last = asc[asc.length-1], prev = asc[asc.length-2];
  if (last.record_date !== today) { box.textContent = ''; return; }
  var delta = last.weight - prev.weight;
  var v = pDisplay(Math.abs(delta));
  if (delta < 0) { box.style.color = '#389e0d'; box.textContent = '😄 较上次 -' + v + ' ' + pLabel() + '，继续加油！'; }
  else if (delta > 0) { box.style.color = '#d46b08'; box.textContent = '💪 较上次 +' + v + ' ' + pLabel() + '，明天会更好！'; }
  else { box.style.color = '#888'; box.textContent = '😐 与上次持平，稳住！'; }
}
// 五彩纸屑：从页面顶部中间喷洒，短暂飘落后自动清除
function confetti(){
  var cvs = document.createElement('canvas');
  cvs.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:10002;';
  cvs.width = window.innerWidth; cvs.height = window.innerHeight;
  document.body.appendChild(cvs);
  var ctx = cvs.getContext('2d');
  var colors = ['#f5222d','#faad14','#52c41a','#4a6cf7','#eb2f96','#13c2c2'];
  var parts = [];
  for (var i=0;i<120;i++){
    parts.push({ x: cvs.width/2, y: cvs.height*0.28,
      vx:(Math.random()-0.5)*10, vy:(Math.random()*-8-3),
      c: colors[i % colors.length], s: 4+Math.random()*5, r: Math.random()*Math.PI, vr:(Math.random()-0.5)*0.3 });
  }
  var frames = 0;
  function tick(){
    ctx.clearRect(0,0,cvs.width,cvs.height);
    parts.forEach(function(p){
      p.vy += 0.28; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.fillRect(-p.s/2,-p.s/2,p.s,p.s*0.6); ctx.restore();
    });
    frames++;
    if (frames < 130) requestAnimationFrame(tick);
    else cvs.remove();
  }
  requestAnimationFrame(tick);
}

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
    renderStreak(calcStreak(d.records, d.today));
    renderCalendar(d.records, d.today);
    renderMood(d.records, d.today);
    drawMini(d.records);
    renderHist(d.records);
    return d;
  } catch(e) {
    document.getElementById('content').innerHTML = '<p class="msg err" style="display:block;">' + esc(e.message) + '</p>';
    return null;
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
    var shown = parseFloat(document.getElementById('weight').value); // 提交前的显示值(当前单位)，用于数字滚动
    await api('/api/public/weight/' + token, { method:'POST', body:{ weight: pKg(shown) } });
    showMsg(msg, '今日体重已记录！', true);
    var d = await loadInfo();
    confetti();
    if (d) {
      var streak = calcStreak(d.records, d.today);
      renderCalendar(d.records, d.today, d.today); // 今日格点亮动画
      if (!isNaN(shown)) animateWeight('weight', shown);
      milestoneCheer(streak);
    }
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
    '<div class="scroll-box"><table><thead><tr><th>日期</th><th>成员</th><th>体重</th><th>较上次</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table></div>';
}
bindQuickLogin('weight-report');
`;

// 资产免密报告查看页 JS
const ASSET_REPORT_JS = `
${COMMON_JS}
var token = location.pathname.split('/').filter(Boolean).pop();
var TYPE_LABEL = { bank:'银行卡', alipay:'支付宝', wechat:'微信', investment:'投资', credit:'信用支付', cash:'现金' };
(async function(){
  try {
    var d = await api('/api/public/asset-report/' + token);
    var r = d.report;
    // 最近 12 个月（months 已升序，取末尾 12 项）
    var allMonths = r.months || [];
    var recent = allMonths.slice(-12);
    var recentSet = {}; recent.forEach(function(m){ recentSet[m] = 1; });
    var idxMap = {}; allMonths.forEach(function(m, i){ idxMap[m] = i; });
    var months = recent;
    var netWorthSeries = recent.map(function(m){ return r.netWorthSeries[idxMap[m]]; });
    var savingSeries = recent.map(function(m){ return r.savingSeries[idxMap[m]]; });
    // 当月各类型合计（后端 byTypeTotal 已为最新月）
    renderTypeTotal(r.byTypeTotal || [], r.latestMonth);
    // 月度记录明细（仅最近 12 个月，对齐登录页明细：月份/类型/钱包/金额/更新时间）
    renderMonthDetail(d.wallets || [], d.records || [], recentSet);
    // 净资产趋势
    new Chart(document.getElementById('netChart'), { type:'line',
      data:{ labels: months, datasets:[{ label:'净资产', data: netWorthSeries, borderColor:'#667eea', tension:.3 }] },
      options:{ plugins:{ legend:{ display:false } }, scales:{ y:{ title:{ display:true, text:'净资产(元)' } } } } });
    // 每月净存
    new Chart(document.getElementById('consumeChart'), { type:'bar',
      data:{ labels: months, datasets:[{ label:'净存', data: savingSeries,
        backgroundColor: function(c){ return c.raw < 0 ? '#cf1322' : '#389e0d'; } }] },
      options:{ plugins:{ legend:{ display:false } }, scales:{ y:{ title:{ display:true, text:'每月净存(元, 负为减少)' } } } } });
    document.getElementById('content').style.display = 'block';
  } catch(e){ document.getElementById('content').innerHTML = '<p class="msg err" style="display:block;">' + esc(e.message) + '</p>'; }
})();
function renderTypeTotal(list, latestMonth) {
  var box = document.getElementById('typeTotalBox');
  if (!box) return;
  if (!list.length) { box.innerHTML = '<p class="muted">暂无记录</p>'; return; }
  var cells = list.map(function(t){
    var extra = t.type==='investment' ? '<div class="muted" style="font-size:12px;">本金 '+t.principal+' / 收益 '+t.profit+'</div>' : '';
    var label = (TYPE_LABEL[t.type]||t.type) + (t.type==='credit' ? ' <span class="tag debt"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:2px;"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>负债</span>' : '');
    return '<div class="stat" style="min-width:120px;"><div class="num" style="font-size:18px;">'+ fmtMoney(t.balance, {frac:2}) +'</div><div class="lbl">'+label+'</div>'+extra+'</div>';
  }).join('');
  var tag = latestMonth ? '（' + latestMonth + '）' : '';
  box.innerHTML = '<div class="muted" style="margin-bottom:6px;">各类型余额合计' + tag + '</div><div class="grid-stats">'+cells+'</div>';
}
function renderMonthDetail(wlist, records, recentSet) {
  var body = document.getElementById('mttBody');
  if (!body) return;
  var nameOf = {}, typeOf = {};
  wlist.forEach(function(w){ nameOf[w.id] = w.name; typeOf[w.id] = w.type; });
  // 仅最近 12 个月；排序：月份倒序 → 类型 → 钱包名 → 录入时间倒序（对齐登录页 renderMonthTable）
  var sorted = records.filter(function(r){ return recentSet[r.month]; }).sort(function(a,b){
    if (a.month !== b.month) return b.month < a.month ? -1 : 1;
    var ta = typeOf[a.wallet_id]||'', tb2 = typeOf[b.wallet_id]||'';
    if (ta !== tb2) return ta.localeCompare(tb2);
    var na = nameOf[a.wallet_id]||'', nb = nameOf[b.wallet_id]||'';
    if (na !== nb) return na.localeCompare(nb);
    return (b.created_at||'').localeCompare(a.created_at||'');
  });
  body.innerHTML = sorted.map(function(r){
    return '<tr><td data-label="月份">' + r.month + '</td>' +
      '<td data-label="类型">' + (TYPE_LABEL[typeOf[r.wallet_id]] || '') + '</td>' +
      '<td data-label="钱包">' + esc(nameOf[r.wallet_id]||'') + '</td>' +
      '<td data-label="金额">' + fmtMoney(r.balance, {frac:2}) + (r.principal||r.profit ? ' <span class="muted">(本金'+ fmtMoney(r.principal, {frac:2}) +'/收益'+ fmtMoney(r.profit, {frac:2}) +')</span>' : '') + '</td>' +
      '<td data-label="更新时间" class="muted">' + esc(r.created_at||'') + '</td></tr>';
  }).join('') || '<tr><td colspan="5" class="muted">暂无记录</td></tr>';
}
bindQuickLogin('asset-report');
`;

// 基金持仓分布免密报告页 JS（doughnut 饼图，无需登录）
const FUND_REPORT_JS = `
${COMMON_JS}
var token = location.pathname.split('/').filter(Boolean).pop();
var COLORS = ['#667eea','#f5222d','#52c41a','#faad14','#13c2c2','#722ed1','#eb2f96','#fa8c16','#a0d911','#2f54eb'];
function sign(n){ return fmtSign(n); }
(async function(){
  try {
    setLoadingProgress(90);   // 单请求：推进度条爬升，营造实时加载进度感
    var d = await api('/api/public/fund-report/' + token, { loadingText: '正在加载持仓分布与收益数据…' });
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
    return '<tr><td data-label="类型">' + TYPE_LABEL[w.type] + (w.type==='credit'?' <span class="tag debt"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:2px;"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>负债</span>':'') + '</td>' +
      '<td data-label="名称">' + esc(w.name) + '</td>' +
      '<td data-label="本月金额">' + (amt != null ? fmtMoney(amt, {frac:2}) : '<span class="muted">—</span>') + '</td>' +
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
  document.getElementById('sAssets').textContent = fmtMoney(report.latest.assets, {frac:2});
  document.getElementById('sDebt').textContent = fmtMoney(report.latest.debt, {frac:2});
  document.getElementById('sNet').textContent = fmtMoney(report.latest.netWorth, {frac:2});
  document.getElementById('sMonth').textContent = report.latestMonth || '—';
  var gInput = document.getElementById('goalInput');
  if (gInput) gInput.value = (goal && goal.target) ? goal.target : '';
  var gbox = document.getElementById('goalBox');
  if (goal) {
    gbox.innerHTML = '<b>' + year + ' 年度目标：</b>' + fmtMoney(goal.target, {frac:2}) +
      ' 元 · 当前 ' + fmtMoney(goal.current, {frac:2}) + ' · 还差 <b style="color:#cf1322;">' + fmtMoney(goal.remaining, {frac:2}) + '</b>' +
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
    var label = (TYPE_LABEL[t.type]||t.type) + (t.type==='credit' ? ' <span class="tag debt"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:2px;"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>负债</span>' : '');
    return '<div class="stat" style="min-width:120px;"><div class="num" style="font-size:18px;">'+ fmtMoney(t.balance, {frac:2}) +'</div>'+
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
      return '<td data-label="' + (TYPE_LABEL[t]||t) + '">' + (v != null ? fmtMoney(v, {frac:2}) : '—') + '</td>';
    }).join('');
    var netColor = row.net < 0 ? ' style="color:#cf1322;font-weight:bold;"' : '';
    return '<tr><td data-label="月份">' + row.month + '</td>' + tds +
      '<td data-label="净资产"' + netColor + '>' + fmtMoney(row.net, {frac:2}) + '</td></tr>';
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
      '<td data-label="金额">' + fmtMoney(r.balance, {frac:2}) + (r.principal||r.profit ? ' <span class="muted">(本金'+ fmtMoney(r.principal, {frac:2}) +'/收益'+ fmtMoney(r.profit, {frac:2}) +')</span>' : '') + '</td>' +
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
    if (!mm) { alertModal('请选择月份', {ok:false}); return; }
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
    catch(e){ alertModal(e.message, {ok:false}); }
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
      '<td data-label="金额">' + fmtMoney(r.balance, {frac:2}) + (r.principal||r.profit ? ' <span class="muted">(本金'+ fmtMoney(r.principal, {frac:2}) +'/收益'+ fmtMoney(r.profit, {frac:2}) +')</span>' : '') + '</td>' +
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
    if (!mm) { alertModal('请选择月份', {ok:false}); return; }
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
  confirmModal('删除月度记录', '删除该月度记录?', async function(){
    try { await api('/api/asset/records/' + id, { method:'DELETE' }); await loadAll(); } catch(e){ alertModal(e.message, {ok:false}); }
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
    catch(e){ alertModal(e.message, {ok:false}); }
  });
};
window.wDel = async function(id){
  confirmModal('删除钱包', '删除该钱包?', async function(){
    try { await api('/api/asset/wallets/' + id, { method:'DELETE' }); await loadAll(); } catch(e){ alertModal(e.message, {ok:false}); }
  });
};
window.wShare = async function(id, reset){
  async function openShare(doReset) {
    var d = await api('/api/asset/wallets/' + id + '/share-link' + (doReset ? '?reset=1' : ''));
    openModal('免密录入链接',
      '<p class="muted">此链接长期有效，打开无需登录即可录入该钱包当月金额。</p>' +
      '<input id="aShareUrl" value="' + esc(d.link) + '" readonly style="margin-bottom:8px;">' +
      '<button class="btn" onclick="aCopy()">复制链接</button> ' +
      '<button class="btn gray" onclick="wShare(' + id + ', true)">重置链接</button>' +
      (doReset ? '<p class="msg ok" style="margin-top:8px;">链接已重置，旧链接已失效</p>' : ''));
  }
  if (reset) return confirmModal('重置链接', '重置后，旧链接将立即失效，已分享出去的旧链接将无法再使用。确认重置？', function(){ return openShare(true); });
  try { await openShare(false); } catch(e){ alertModal(e.message, {ok:false}); }
};
window.aCopy = function(){ var el=document.getElementById('aShareUrl'); el.select(); try{document.execCommand('copy');alertModal('已复制');}catch(e){alertModal('请手动复制', {ok:false});} };

document.getElementById('walletAdd').addEventListener('click', function(){
  var opts = Object.keys(TYPE_LABEL).map(function(k){ return '<option value="'+k+'">'+TYPE_LABEL[k]+'</option>'; }).join('');
  openModal('新建钱包',
    '<label>类型</label><select id="nType">' + opts + '</select>' +
    '<label>名称（如：AA的招商银行）</label><input id="nName">' +
    '<div style="margin-top:12px;"><button class="btn" id="nConfirm">创建</button> <button class="btn gray" onclick="closeModal()">取消</button></div>');
  document.getElementById('nConfirm').addEventListener('click', async function(){
    try { await api('/api/asset/wallets', { method:'POST', body:{ type: document.getElementById('nType').value, name: document.getElementById('nName').value } }); closeModal(); await loadAll(); }
    catch(e){ alertModal(e.message, {ok:false}); }
  });
});
document.getElementById('goalSave').addEventListener('click', async function(){
  try { await api('/api/asset/goal', { method:'PUT', body:{ target_amount: document.getElementById('goalInput').value } }); await loadAll(); alertModal('目标已保存'); }
  catch(e){ alertModal(e.message, {ok:false}); }
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
    alertModal('推送配置已保存');
  } catch(e){ alertModal(e.message, {ok:false}); }
});
var aPushSend = document.getElementById('pushSend');
if (aPushSend) aPushSend.addEventListener('click', async function(){
  var btn = this; btn.disabled = true; btn.textContent = '推送中...';
  try { setLoadingProgress(90); var r = await api('/api/push/asset/send', { method:'POST', loadingText: '正在发送资产月报…' }); alertModal(r.message || '已推送'); }
  catch(e){ alertModal(e.message, { ok:false }); }
  finally { btn.disabled = false; btn.textContent = '立即推送'; }
});

(async function(){
  try { await loadAll(); initAssetFilter(); await loadPush(); }
  catch(e){ if (String(e.message).indexOf('登录')>=0) location.href='/login'; else alertModal(e.message, {ok:false}); }
})();
`;

// 资产免密录入公开页 JS
const PUBLIC_ASSET_JS = `
${COMMON_JS}
var token = location.pathname.split('/').filter(Boolean).pop();
var msg = document.getElementById('msg');
var TYPE_LABEL = { bank:'银行卡', alipay:'支付宝', wechat:'微信', investment:'投资', credit:'信用支付', cash:'现金' };
var wType = '';
var walletChartInst = null;

function drawWalletChart(series, year) {
  var box = document.getElementById('chartBox');
  if (!series || !series.length) { box.style.display = 'none'; return; }
  document.getElementById('chartYear').textContent = year;
  box.style.display = 'block';
  var labels = series.map(function(s){ return s.month.slice(5) + '月'; });
  var data = series.map(function(s){ return s.balance; });
  if (walletChartInst) walletChartInst.destroy();
  walletChartInst = new Chart(document.getElementById('walletChart'), {
    type:'line',
    data:{ labels: labels, datasets:[{ label:'余额(元)', data: data, borderColor:'#4a6cf7', backgroundColor:'rgba(74,108,247,.12)', fill:true, tension:.3 }] },
    options:{ plugins:{ legend:{ display:false } }, scales:{ y:{ title:{ display:true, text:'余额(元)' } } } }
  });
}

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
    drawWalletChart(d.series, d.year);
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
    await loadInfo();  // 刷新当年曲线
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
// 视图三态循环: default(带页面 chrome 的默认页) → card(全屏卡片) → tree(全屏完整树) → default
// localStorage 记忆; 老用户历史值 'card'/'tree' 直接沿用为对应全屏态
var _todoView = 'default';
try { var _v = localStorage.getItem('todoView'); if (_v === 'default' || _v === 'card' || _v === 'tree') _todoView = _v; } catch(e){}
// ESC 键退全屏用: 保存 applyTodoView 每次传入的最新 getRowsFn / onDrawTree
// 全局 keydown 只绑一次(_todoEscBound), 从这里读最新引用, 避免闭包旧值
var _todoEscCtx = { getRows: null, onDraw: null };
// 卡片模式下打开的顶层任务 id；null 表示卡片列表
var _todoDetailRootId = null;
// 侧边抽屉开合: null=按视口默认(PC 开/手机收), true/false=用户显式选择
var _todoDrawerOpen = null;
try { var _d = localStorage.getItem('todoDrawer'); if (_d === '1') _todoDrawerOpen = true; else if (_d === '0') _todoDrawerOpen = false; } catch(e){}
// 分类过滤: null 或 '__all__' 均视作不过滤; '__none__' 表示未分类; 其他值为分类名
var _todoCategory = null;
// 叶子口径计数：只数末端叶子（无子任务的节点），与后端 countStats/statsOfReport 一致
// 顶层任务若无子任务, 自身不算入进度（返回 {0,0}）
function todoLeafCount(node) {
  var total = 0, done = 0;
  (function walk(n){
    n.children.forEach(function(c){
      if (c.children.length === 0) { total++; if (c.done) done++; }
      else walk(c);
    });
  })(node);
  return { total: total, done: done };
}
// 时间筛选 tab → 图表下拉框默认区间映射:
//   today  → 7d  (今天筛选就看近 7 天趋势)
//   其它筛选(all/overdue/future/memo/done/cur) → month (当月, 与统计口径一致)
//   页面没有 #chartRange 就直接返回目标 range 值, 页面可以据此更新 _curRange
// 返回值: 目标 range 字符串
function todoFilterToRange(filter) { return filter === 'today' ? '7d' : 'month'; }
// 同步时间筛选到图表下拉框: 如果页面存在 #chartRange, 把对应 data-range 的按钮标 active 并触发 click
// (触发 click 会走 bindTodoRange 里的 handler, 由页面自己更新 _curRange 并重画图表)
function syncChartRangeToFilter(filter) {
  var box = document.getElementById('chartRange');
  if (!box) return;
  var target = todoFilterToRange(filter);
  var btn = box.querySelector('button[data-range="' + target + '"]');
  if (!btn || btn.classList.contains('active')) return;
  btn.click();
}
// range → 中文文案(用于 stats 上方灰字提示"当前视图: xxx"里的时间段部分)
function todoRangeLabel(range) {
  return ({ 'month':'当月', '7d':'近7天', '30d':'近30天', '60d':'近60天', '6m':'近半年', '1y':'近1年', '3y':'近3年' })[range] || range;
}
// filter → 顶层筛选口径中文
function todoFilterLabel(filter) {
  return ({ all:'全部', today:'今日', overdue:'逾期', future:'未来', memo:'备忘录', done:'已完成', cur:'今日+逾期' })[filter] || filter;
}
// 更新 stats 上方的"当前视图"灰字提示:
//   filter = 顶层筛选口径; range = 已完成计数所依赖的时间窗(与 chartRange 下拉框联动)
//   显示格式: "当前筛选：xxx  ·  已完成计数：range 窗口内"
// 无 #statsHint 时静默返回, 不影响未接入的页面
function updateStatsHint(filter, range) {
  var el = document.getElementById('statsHint');
  if (!el) return;
  el.textContent = '当前筛选：' + todoFilterLabel(filter) + '　·　已完成计数：' + todoRangeLabel(range) + '内完成';
}
// range → { fromDay, toDay } (YYYY-MM-DD, 闭区间)
//   month  = today 所在月 1 号 → today
//   7d/30d/60d = 最近 N 天(含今日)
//   6m/1y/3y  = 最近 N 月的 1 号 → today
function todoRangeWindow(range, today) {
  if (!today || today.length < 10) return { fromDay: '', toDay: '' };
  var y = +today.slice(0, 4), m = +today.slice(5, 7), d = +today.slice(8, 10);
  function pad(n){ return (n<10?'0':'') + n; }
  function fmt(yr, mo, day){ return yr + '-' + pad(mo) + '-' + pad(day); }
  function endMs(){ return Date.UTC(y, m-1, d); }
  var days = ({ '7d':7, '30d':30, '60d':60 })[range];
  // 当月: 整月区间 (月首 → 月末), 而非"月初至今"
  //   —— stats 计数按截止日期, 本月内未来到期的已完成也应算入
  if (range === 'month') {
    var lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate(); // m 月最后一天
    return { fromDay: fmt(y, m, 1), toDay: fmt(y, m, lastDay) };
  }
  if (days) {
    var f = new Date(endMs() - (days - 1) * 86400000);
    return { fromDay: f.toISOString().slice(0, 10), toDay: today };
  }
  var months = ({ '6m':6, '1y':12, '3y':36 })[range];
  if (months) {
    var start = new Date(Date.UTC(y, m - months, 1));
    return { fromDay: start.toISOString().slice(0, 10), toDay: today };
  }
  return { fromDay: fmt(y, m, 1), toDay: today }; // 兜底当月起(不应到达)
}
// 按 filter (空间) 与 range (时间) 双维度统计已完成叶子任务数
//   时间维度以"顶层截止日期(rootDueOf)"衡量, 不是完成日期(done_at)
//   —— 用户预期是"当月/近30天等区间到期的已完成", 完成时间可能跨月
//   filter 决定空间口径:
//     today          = 顶层 due_date === today
//     overdue        = 顶层 due_date < today
//     future         = 顶层 due_date > today
//     memo           = 顶层无 due_date (备忘录; 时间窗对它不适用, 直接豁免)
//     cur            = 顶层 due_date <= today (今日+逾期)
//     all / done     = 全部有 due_date 的空间
//   range 决定 due_date 时间窗: due_date 必须落在 todoRangeWindow(range, today) 闭区间内
//   memo 分支豁免时间窗(无截止日期不受"当月"约束)
// rows 为扁平数据; 只算叶子(hasChild 排除父任务)
function todoDoneByFilter(rows, filter, today, range) {
  var byId = {}; rows.forEach(function(r){ byId[r.id] = r; });
  var hasChild = {};
  rows.forEach(function(r){ if (r.parent_id != null) hasChild[r.parent_id] = 1; });
  function rootDueOf(r) {
    var cur = r;
    while (cur.parent_id != null && byId[cur.parent_id]) cur = byId[cur.parent_id];
    return cur.due_date;
  }
  var win = todoRangeWindow(range || 'month', today);
  var count = 0;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (hasChild[r.id]) continue; // 只算叶子
    if (!r.done) continue;
    var rdue = rootDueOf(r);
    // memo 语义: 只统计无截止日期的备忘录, 时间窗对它无意义
    if (filter === 'memo') {
      if (rdue) continue;
      count++;
      continue;
    }
    // 其它 filter: 时间窗按顶层 due_date 卡, 无 due_date 的排除
    if (!rdue) continue;
    if (win.fromDay && rdue < win.fromDay) continue;
    if (win.toDay && rdue > win.toDay) continue;
    // 空间过滤: 按 filter 判断叶子归属
    if (filter === 'today') {
      if (rdue !== today) continue;
    } else if (filter === 'overdue') {
      if (!(today && rdue < today)) continue;
    } else if (filter === 'future') {
      if (!(today && rdue > today)) continue;
    } else if (filter === 'cur') {
      if (!(today && rdue <= today)) continue;
    }
    // all / done / 其它: 只受时间窗约束
    count++;
  }
  return count;
}
// 前端版 shiftDate: 与后端 services/todo.service.js 的 shiftDate 逻辑一致
// dueDate: YYYY-MM-DD; recurrence: 'daily'|'weekly'|'monthly'|'yearly'|'monthly_nth_weekday'
// jumpToCurrent=true 时以 todayStr 为基准找该周期最近未来日
// interval: 每隔 N 个周期; 缺省或 <1 归一为 1
// nth/weekday: 仅 monthly_nth_weekday 用; nth 1..5(5=最后一个), weekday 0..6(0=周日)
function shiftDateLocal(dueDate, recurrence, jumpToCurrent, todayStr, interval, nth, weekday) {
  var step = (interval != null && interval >= 1) ? Math.floor(interval) : 1;
  var parts = dueDate.split('-');
  var y = +parts[0], m = +parts[1], d = +parts[2];
  function clamp(yr, mo, day){ var last = new Date(Date.UTC(yr, mo, 0)).getUTCDate(); return Math.min(day, last); }
  function fmt(yr, mo, day){ return yr + '-' + (mo<10?'0':'') + mo + '-' + (day<10?'0':'') + day; }
  // 从 (year, month) 向后跨 k 个月, 返回 [newYear, newMonth]; month 从 1 起
  function addMonths(year, month, k) {
    var idx = (year * 12 + (month - 1)) + k;
    return [Math.floor(idx / 12), (idx % 12) + 1];
  }
  // 该月第 n 个 weekday 的日号; n=5 或该月不足 n 个时取该月最后一个 weekday
  function nthWeekdayOf(year, month, n, wd) {
    var first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    var firstOff = ((wd - first) + 7) % 7;
    var first1 = 1 + firstOff;
    var last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (n >= 5) {
      var lastWd = new Date(Date.UTC(year, month - 1, last)).getUTCDay();
      var lastOff = ((lastWd - wd) + 7) % 7;
      return last - lastOff;
    }
    var cand = first1 + (n - 1) * 7;
    if (cand > last) {
      var lastWd2 = new Date(Date.UTC(year, month - 1, last)).getUTCDay();
      var lastOff2 = ((lastWd2 - wd) + 7) % 7;
      return last - lastOff2;
    }
    return cand;
  }
  // ============ monthly_nth_weekday 分支 ============
  if (recurrence === 'monthly_nth_weekday') {
    var n = (nth != null && nth >= 1 && nth <= 5) ? Math.floor(nth) : null;
    var wd = (weekday != null && weekday >= 0 && weekday <= 6) ? Math.floor(weekday) : null;
    if (n == null || wd == null) return dueDate;
    if (!jumpToCurrent) {
      var mm = addMonths(y, m, step);
      return fmt(mm[0], mm[1], nthWeekdayOf(mm[0], mm[1], n, wd));
    }
    var _today = todayStr || new Date(Date.now() + 8*3600*1000).toISOString().slice(0,10);
    var _tp = _today.split('-');
    var _ty = +_tp[0], _tm = +_tp[1], _td = +_tp[2];
    var cy0 = _ty, cm0 = _tm;
    for (var i = 0; i < 240; i++) {
      var day = nthWeekdayOf(cy0, cm0, n, wd);
      if (cy0 > _ty || (cy0 === _ty && (cm0 > _tm || (cm0 === _tm && day > _td)))) {
        return fmt(cy0, cm0, day);
      }
      var _mm = addMonths(cy0, cm0, step); cy0 = _mm[0]; cm0 = _mm[1];
    }
    return fmt(cy0, cm0, nthWeekdayOf(cy0, cm0, n, wd));
  }
  if (!jumpToCurrent) {
    if (recurrence === 'daily') { var t = Date.UTC(y, m-1, d) + step * 86400000; return new Date(t).toISOString().slice(0,10); }
    if (recurrence === 'weekly') { var t2 = Date.UTC(y, m-1, d) + step * 7 * 86400000; return new Date(t2).toISOString().slice(0,10); }
    if (recurrence === 'monthly') { var mm = addMonths(y, m, step); return fmt(mm[0], mm[1], clamp(mm[0], mm[1], d)); }
    if (recurrence === 'yearly') { var ny2 = y + step; return fmt(ny2, m, clamp(ny2, m, d)); }
    return dueDate;
  }
  var today = todayStr || new Date(Date.now() + 8*3600*1000).toISOString().slice(0,10);
  var tp = today.split('-');
  var ty = +tp[0], tm = +tp[1], td = +tp[2];
  if (recurrence === 'daily') {
    if (step === 1) { var tt = Date.UTC(ty, tm-1, td) + 86400000; return new Date(tt).toISOString().slice(0,10); }
    var ms = Date.UTC(y, m-1, d);
    var target = Date.UTC(ty, tm-1, td);
    while (ms <= target) ms += step * 86400000;
    return new Date(ms).toISOString().slice(0,10);
  }
  if (recurrence === 'weekly') {
    if (step === 1) {
      var dow = new Date(Date.UTC(y, m-1, d)).getUTCDay();
      var todayMs = Date.UTC(ty, tm-1, td);
      var tdow = new Date(todayMs).getUTCDay();
      var deltaDays = (dow - tdow + 7) % 7;
      if (deltaDays === 0) deltaDays = 7;
      return new Date(todayMs + deltaDays * 86400000).toISOString().slice(0,10);
    }
    var ms2 = Date.UTC(y, m-1, d);
    var target2 = Date.UTC(ty, tm-1, td);
    while (ms2 <= target2) ms2 += step * 7 * 86400000;
    return new Date(ms2).toISOString().slice(0,10);
  }
  if (recurrence === 'monthly') {
    if (step === 1) {
      if (td < d) return fmt(ty, tm, clamp(ty, tm, d));
      var nm2 = tm===12?1:tm+1; var ny3 = tm===12?ty+1:ty;
      return fmt(ny3, nm2, clamp(ny3, nm2, d));
    }
    var cy = y, cm = m;
    while (cy < ty || (cy === ty && (cm < tm || (cm === tm && clamp(cy, cm, d) <= td)))) {
      var mm2 = addMonths(cy, cm, step); cy = mm2[0]; cm = mm2[1];
    }
    return fmt(cy, cm, clamp(cy, cm, d));
  }
  if (recurrence === 'yearly') {
    if (step === 1) {
      if (tm < m || (tm === m && td < d)) return fmt(ty, m, clamp(ty, m, d));
      return fmt(ty + 1, m, clamp(ty + 1, m, d));
    }
    var cy2 = y;
    while (cy2 < ty || (cy2 === ty && (m < tm || (m === tm && clamp(cy2, m, d) <= td)))) {
      cy2 += step;
    }
    return fmt(cy2, m, clamp(cy2, m, d));
  }
  return dueDate;
}
// 分类计数(顶层任务口径): 目录展示与卡片列表可见性一致 —— 只数顶层任务
// 返回 { __all__: N, __none__: N, '工作': N, ... }
function todoCatCounts(rows) {
  var m = { __all__: 0, __none__: 0 };
  rows.forEach(function(r){
    if (r.parent_id != null) return;
    m.__all__++;
    if (!r.category) m.__none__++;
    else { m[r.category] = (m[r.category] || 0) + 1; }
  });
  return m;
}
// 从 rows 提取去重排序的分类列表
function todoCatDistinct(rows) {
  var set = {};
  rows.forEach(function(r){ if (r.category) set[r.category] = 1; });
  return Object.keys(set).sort(function(a, b){ return a.localeCompare(b); });
}
// 重复徽章文案: recurrence + interval → "每日" / "每2周" / "每3月" / ...
//   interval 缺省或 ≤1 时省略数字: "每日" / "每周" / "每月" / "每年"
//   interval ≥2: daily→"每2天"(注意 daily 无 interval 时展示"每日", 与旧数据一致), 其它按 每N周/月/年
//   monthly_nth_weekday: 需要 nth/weekday, "每月第 N 个周 X" (N=5 显示为"最后一个")
function todoRecurLabel(recurrence, interval, nth, weekday) {
  var n = (interval != null && interval >= 1) ? Math.floor(interval) : 1;
  if (recurrence === 'daily')   return n > 1 ? ('每' + n + '天') : '每日';
  if (recurrence === 'weekly')  return n > 1 ? ('每' + n + '周') : '每周';
  if (recurrence === 'monthly') return n > 1 ? ('每' + n + '月') : '每月';
  if (recurrence === 'yearly')  return n > 1 ? ('每' + n + '年') : '每年';
  if (recurrence === 'monthly_nth_weekday') {
    var NTH = { 1:'第一个', 2:'第二个', 3:'第三个', 4:'第四个', 5:'最后一个' };
    var WD  = ['周日','周一','周二','周三','周四','周五','周六'];
    var pos = NTH[nth] || '';
    var w = (weekday != null) ? WD[weekday] : '';
    if (!pos || !w) return n > 1 ? ('每' + n + '月') : '每月';
    return n > 1 ? ('每' + n + '月的' + pos + w) : ('每月' + pos + w);
  }
  return recurrence || '';
}
// 待办弹窗: 绑定"重复"下拉与"每 N 单位"数字框、monthly_nth_weekday 双下拉的联动
//   选中"不重复" → 隐藏数字框 + 隐藏 nth/weekday
//   选中 daily/weekly/monthly/yearly → 显示数字框, 单位文案切换为 天/周/月/年
//   选中 monthly_nth_weekday → 显示数字框(单位=月) + 显示 nth/weekday 两下拉
// 幂等: __recBound 标记避免重复绑定
function todoBindRecurUI() {
  var sel = document.getElementById('tfRecur');
  if (!sel || sel.__recBound) return;
  sel.__recBound = 1;
  var box = document.getElementById('tfRecurNBox');
  var unit = document.getElementById('tfRecurUnit');
  var nthWrap = document.getElementById('tfNthWrap');
  var UNITS = { daily:'天', weekly:'周', monthly:'月', monthly_nth_weekday:'月', yearly:'年' };
  sel.addEventListener('change', function(){
    var v = sel.value;
    if (box) box.style.display = v ? 'inline-flex' : 'none';
    if (unit && v) unit.textContent = UNITS[v] || '天';
    if (nthWrap) nthWrap.style.display = (v === 'monthly_nth_weekday') ? 'flex' : 'none';
  });
}
// 弹窗内分类下拉填充: 先清空 sel 里除固定项外的所有 option, 再插入现有分类
// currentValue 为当前任务的分类(编辑时非空); 若不在下拉列表则动态插入并选中
function todoFillCategoryOptions(rows, currentValue) {
  var sel = document.getElementById('tfCatSel');
  if (!sel) return;
  // 固定两项: '' (无分类) / '__new__' (新建)
  var frag = document.createDocumentFragment();
  var optNone = document.createElement('option'); optNone.value = ''; optNone.textContent = '（无分类）'; frag.appendChild(optNone);
  var cats = todoCatDistinct(rows);
  if (currentValue && cats.indexOf(currentValue) < 0) cats.push(currentValue);
  cats.forEach(function(c){
    var o = document.createElement('option'); o.value = c; o.textContent = c; frag.appendChild(o);
  });
  var optNew = document.createElement('option'); optNew.value = '__new__'; optNew.textContent = '➕ 新建分类…'; frag.appendChild(optNew);
  sel.innerHTML = '';
  sel.appendChild(frag);
  sel.value = currentValue || '';
  // 绑定切换事件, 避免重复绑定
  if (!sel.__catBound) {
    sel.__catBound = 1;
    sel.addEventListener('change', function(){
      var input = document.getElementById('tfCatNew');
      if (!input) return;
      if (sel.value === '__new__') { input.style.display = 'block'; input.focus(); }
      else input.style.display = 'none';
    });
  }
}
// 渲染侧边分类目录 —— rows 为当前用户全部扁平待办, onSelect(key) 点击回调
// key 取值: '__all__' | '__none__' | '<分类名>'
function renderTodoDrawer(rows, onSelect) {
  var box = document.getElementById('drawerList');
  if (!box) return;
  var counts = todoCatCounts(rows);
  var cats = todoCatDistinct(rows);
  var cur = _todoCategory == null ? '__all__' : _todoCategory;
  box.innerHTML = '';

  // 时间筛选段: 页面存在 #todoFilter (主页) 时镜像其按钮进抽屉, 点击代理触发原按钮 click
  // 抽屉是全屏态下的目录, 需要把顶栏筛选也提上来, 移动端可整体在抽屉里操作
  var fbar = document.getElementById('todoFilter');
  if (fbar) {
    var section1 = document.createElement('div');
    section1.className = 'todo-drawer__section';
    var title1 = document.createElement('div'); title1.className = 'todo-drawer__section-title'; title1.innerHTML = ICONS.calendar + '时间筛选';
    section1.appendChild(title1);
    var timeCounts = todoTimeCounts(rows);
    Array.prototype.forEach.call(fbar.querySelectorAll('button[data-filter]'), function(btn){
      var key = btn.getAttribute('data-filter');
      var it = document.createElement('div');
      var isActive = btn.classList.contains('active');
      it.className = 'todo-drawer__item todo-drawer__item--time' + (isActive ? ' active' : '');
      var l = document.createElement('span'); l.className = 'todo-drawer__label'; l.textContent = btn.textContent.trim();
      var c = document.createElement('span'); c.className = 'todo-drawer__count'; c.textContent = '(' + (timeCounts[key] || 0) + ')';
      it.appendChild(l); it.appendChild(c);
      it.addEventListener('click', function(){
        // 触发原按钮 click, 由主页面 handler 更新 #todoFilter active + drawTree
        btn.click();
        // 抽屉里的选中态跟随重绘: 点完之后重画自己, 让 .active 落在新选的时间项
        renderTodoDrawer(rows, onSelect);
      });
      section1.appendChild(it);
    });
    box.appendChild(section1);
  }

  // 隐藏已完成段: 页面存在 #hideDone 时镜像一份, 点击代理触发原复选框 change
  var origHide = document.getElementById('hideDone');
  if (origHide) {
    var section2 = document.createElement('div');
    section2.className = 'todo-drawer__section';
    var it2 = document.createElement('label');
    it2.className = 'todo-drawer__item todo-drawer__item--hide';
    var cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = !!origHide.checked; cb.style.marginRight = '8px'; cb.style.width = 'auto';
    var lb = document.createElement('span'); lb.className = 'todo-drawer__label'; lb.textContent = '隐藏已完成';
    it2.appendChild(cb); it2.appendChild(lb);
    cb.addEventListener('change', function(){ origHide.checked = cb.checked; origHide.dispatchEvent(new Event('change')); });
    section2.appendChild(it2);
    box.appendChild(section2);
  }

  // 分类段: 原有内容, 增加分段标题
  var section3 = document.createElement('div');
  section3.className = 'todo-drawer__section';
  var title3 = document.createElement('div'); title3.className = 'todo-drawer__section-title'; title3.textContent = '📂 分类';
  section3.appendChild(title3);
  function addItem(key, label, icon) {
    var it = document.createElement('div');
    it.className = 'todo-drawer__item' + (cur === key ? ' active' : '');
    it.setAttribute('data-key', key);
    var l = document.createElement('span'); l.className = 'todo-drawer__label'; l.textContent = (icon ? icon + ' ' : '') + label;
    var c = document.createElement('span'); c.className = 'todo-drawer__count'; c.textContent = '(' + (counts[key] || 0) + ')';
    it.appendChild(l); it.appendChild(c);
    it.addEventListener('click', function(){ if (onSelect) onSelect(key); });
    section3.appendChild(it);
  }
  addItem('__all__', '全部', '📋');
  addItem('__none__', '未分类', '📌');
  cats.forEach(function(c){ addItem(c, c); });
  box.appendChild(section3);

  var foot = document.getElementById('drawerFoot');
  if (foot) foot.textContent = '共 ' + cats.length + ' 个分类';
}
// 时间维度顶层任务计数(顶层口径, 与 todoFilterTrees 同): 全部/今日/逾期/未来/备忘录/已完成
// 只统计顶层任务, 子任务日期继承主任务, 不重复计数
// 桶互斥: 已完成任务归入 done, 不再计入 overdue/today/future/memo
function todoTimeCounts(rows) {
  var today = new Date(Date.now() + 8*3600*1000).toISOString().slice(0,10);
  var m = { all: 0, today: 0, overdue: 0, future: 0, memo: 0, done: 0 };
  rows.forEach(function(r){
    if (r.parent_id != null) return;
    m.all++;
    if (r.done) { m.done++; return; }
    if (!r.due_date) { m.memo++; return; }
    if (r.due_date === today) m.today++;
    else if (r.due_date < today) m.overdue++;
    else m.future++;
  });
  return m;
}
// 抽屉当前是否展开(内部推导)
function todoDrawerIsOpen() {
  if (_todoDrawerOpen == null) return (typeof window !== 'undefined' && window.innerWidth > 640);
  return !!_todoDrawerOpen;
}
// 应用视图状态到 DOM: body class / 全屏容器显隐 / #todoTree 与 #todoCrumb DOM 迁移 / 视图按钮文案 / 抽屉显隐
// 传入 rows 获取函数(避免闭包捕获旧引用)与"重绘树"回调(applyTodoView 内部会最终触发 onDrawTree)
function applyTodoView(getRowsFn, onDrawTree) {
  var body = document.body;
  var fs = document.getElementById('todoFullscreen');
  var tree = document.getElementById('todoTree');
  var crumb = document.getElementById('todoCrumb');
  var fsHost = fs ? fs.querySelector('.todo-fs-main') : null;
  var drawer = document.getElementById('todoDrawer');
  var mask = document.getElementById('todoDrawerMask');
  var vBtn = document.getElementById('viewToggle');
  var vBtnFs = document.getElementById('viewToggleFs');
  var exitBtn = document.getElementById('exitFullscreen');
  var dBtn = document.getElementById('drawerToggle');

  // 视图按钮分工:
  //   vBtn (默认页外壳): 永远只做"进入卡片全屏", 文案固定 "🗂️ 卡片视图"
  //   vBtnFs (全屏顶栏): 在卡片全屏 ↔ 完整树全屏之间切换; 卡片态下显示 "🌳 完整树", 树态下显示 "🗂️ 卡片视图"
  //   exitBtn (全屏顶栏): 任意全屏态下点一下直接回默认页
  if (vBtn) vBtn.innerHTML = ICONS.cards + '卡片视图';
  if (vBtnFs) {
    vBtnFs.innerHTML = (_todoView === 'tree') ? (ICONS.cards + '卡片视图') : (ICONS.tree + '完整树');
    if (!vBtnFs.__fsBound) {
      vBtnFs.__fsBound = 1;
      bindClickBusy(vBtnFs, function(){
        swapTodoFullscreenMode(getRowsFn, onDrawTree);
        return Promise.resolve();
      });
    }
  }
  if (exitBtn) {
    if (!exitBtn.__exitBound) {
      exitBtn.__exitBound = 1;
      bindClickBusy(exitBtn, function(){
        exitTodoFullscreen(getRowsFn, onDrawTree);
        return Promise.resolve();
      });
    }
  }

  // ESC 键退出全屏(PC 端体验): 保存最新回调, 幂等绑定 document keydown 一次
  _todoEscCtx.getRows = getRowsFn;
  _todoEscCtx.onDraw = onDrawTree;
  if (!document.__todoEscBound) {
    document.__todoEscBound = 1;
    document.addEventListener('keydown', function(e){
      if (e.key !== 'Escape' && e.keyCode !== 27) return;
      // 优先关 modal: modal 用 #modalMask.show 表示打开, 之前误判 #modal 永远拿不到导致 ESC 越过 modal 直退全屏
      var mask = document.getElementById('modalMask');
      if (mask && mask.classList.contains('show')) {
        closeModal();
        return;
      }
      if (_todoView === 'default') return; // 非全屏态且无 modal, 交还系统默认
      if (todoDrawerIsOpen() && window.innerWidth <= 640) {
        // 窄屏下抽屉浮层态优先关抽屉
        _todoDrawerOpen = false;
        try { localStorage.setItem('todoDrawer', '0'); } catch(er){}
        applyTodoView(_todoEscCtx.getRows, _todoEscCtx.onDraw);
        return;
      }
      exitTodoFullscreen(_todoEscCtx.getRows, _todoEscCtx.onDraw);
    });
  }

  // DOM 迁移: default 时 tree/crumb 回归"清单卡片"内的初始容器; 非 default 时挪到全屏容器主区域
  // 通过在页面初始位置留一个 anchor 元素 (id="todoTreeHome") 来记录初始父节点
  var home = document.getElementById('todoTreeHome');
  if (_todoView === 'default') {
    body.classList.remove('todo-fs-on');
    if (home && tree && tree.parentNode !== home) {
      if (crumb) home.appendChild(crumb);
      home.appendChild(tree);
    }
  } else {
    body.classList.add('todo-fs-on');
    if (fsHost && tree && tree.parentNode !== fsHost) {
      if (crumb) fsHost.appendChild(crumb);
      fsHost.appendChild(tree);
    }
  }

  // 抽屉: 仅在全屏态下有意义
  if (drawer) {
    if (_todoView === 'default') {
      drawer.classList.remove('open');
      drawer.classList.add('closed');
      if (mask) mask.classList.remove('show');
    } else {
      var open = todoDrawerIsOpen();
      drawer.classList.toggle('closed', !open);
      drawer.classList.toggle('open', open);
      if (mask) mask.classList.toggle('show', open && window.innerWidth <= 640);
    }
  }

  // 抽屉切换按钮: 仅在全屏态下显示
  if (dBtn) dBtn.style.display = (_todoView === 'default') ? 'none' : '';

  // 手机端全屏顶栏滚动方向隐藏/显示: 幂等绑定一次, 仅监听 .todo-fs-main 的 scroll
  // PC 端(> 640px)不生效, 靠 CSS media query 保证 sticky 只在窄屏定义
  var fsMain = fs ? fs.querySelector('.todo-fs-main') : null;
  var fsTop = fs ? fs.querySelector('.todo-fs-top') : null;
  if (fsMain && fsTop && !fsMain.__scrollHideBound) {
    fsMain.__scrollHideBound = 1;
    var lastY = 0, ticking = 0, resumeTimer = null;
    fsMain.addEventListener('scroll', function(){
      if (window.innerWidth > 640) return; // PC 不做
      if (ticking) return;
      ticking = 1;
      requestAnimationFrame(function(){
        var y = fsMain.scrollTop, dy = y - lastY;
        if (y > 40 && dy > 4) fsTop.classList.add('todo-fs-top--hidden');
        else if (dy < -4 || y <= 40) fsTop.classList.remove('todo-fs-top--hidden');
        lastY = y;
        ticking = 0;
      });
      // 停止滚动 200ms 后恢复显示
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(function(){ fsTop.classList.remove('todo-fs-top--hidden'); }, 200);
    }, { passive: true });
  }
  // 每次切回默认页或视图变化, 强制显示顶栏(避免上次隐藏状态残留)
  if (fsTop) fsTop.classList.remove('todo-fs-top--hidden');

  // 全屏顶栏 #hideDoneFs 与页面 #hideDone 双向同步: 状态镜像 + 幂等绑定
  var hideFs = document.getElementById('hideDoneFs');
  var hideOrig = document.getElementById('hideDone');
  if (hideFs && hideOrig) {
    hideFs.checked = !!hideOrig.checked;
    if (!hideFs.__syncBound) {
      hideFs.__syncBound = 1;
      hideFs.addEventListener('change', function(){
        hideOrig.checked = hideFs.checked;
        hideOrig.dispatchEvent(new Event('change'));
      });
    }
  }

  // 触发一次树/卡片重绘 + 抽屉内容刷新
  if (typeof onDrawTree === 'function') onDrawTree();
  if (_todoView !== 'default' && typeof getRowsFn === 'function') {
    var rows = getRowsFn() || [];
    renderTodoDrawer(rows, function(key){
      _todoCategory = key === '__all__' ? null : key;
      // 分类切换后, 移动端可选择自动收起抽屉(留意: 桌面端不收, 避免视线跳)
      if (window.innerWidth <= 640) {
        _todoDrawerOpen = false;
        try { localStorage.setItem('todoDrawer', '0'); } catch(e){}
      }
      applyTodoView(getRowsFn, onDrawTree);
    });
  }
}
// 视图三态循环(旧, 已弃用): 保留以避免破坏未迁移调用点; 新按钮分工见下面三个函数
function cycleTodoView(getRowsFn, onDrawTree) {
  var next = { 'default': 'card', 'card': 'tree', 'tree': 'default' };
  _todoView = next[_todoView] || 'default';
  _todoDetailRootId = null;
  try { localStorage.setItem('todoView', _todoView); } catch(e){}
  applyTodoView(getRowsFn, onDrawTree);
}
// 默认页 → 卡片全屏(单向进入): 用于默认页外壳的 viewToggle 按钮
function enterTodoFullscreen(getRowsFn, onDrawTree) {
  _todoView = 'card';
  _todoDetailRootId = null;
  try { localStorage.setItem('todoView', 'card'); } catch(e){}
  applyTodoView(getRowsFn, onDrawTree);
}
// 全屏内切换卡片 ↔ 完整树(不出全屏): 用于全屏顶栏的 viewToggleFs 按钮
function swapTodoFullscreenMode(getRowsFn, onDrawTree) {
  _todoView = (_todoView === 'tree') ? 'card' : 'tree';
  _todoDetailRootId = null;
  try { localStorage.setItem('todoView', _todoView); } catch(e){}
  applyTodoView(getRowsFn, onDrawTree);
}
// 全屏 → 默认页(单向退出): 用于全屏顶栏的 exitFullscreen 按钮
function exitTodoFullscreen(getRowsFn, onDrawTree) {
  _todoView = 'default';
  _todoDetailRootId = null;
  try { localStorage.setItem('todoView', 'default'); } catch(e){}
  applyTodoView(getRowsFn, onDrawTree);
}
// 抽屉手动开合(全屏态下点 ☰ 或 ✕)
function toggleTodoDrawer(getRowsFn, onDrawTree) {
  _todoDrawerOpen = !todoDrawerIsOpen();
  try { localStorage.setItem('todoDrawer', _todoDrawerOpen ? '1' : '0'); } catch(e){}
  applyTodoView(getRowsFn, onDrawTree);
}
// 按分类过滤顶层任务行: 输入 rows(扁平), 输出仅保留 (顶层匹配 _todoCategory 的顶层 + 其子孙)
// _todoCategory==null 或 '__all__' 时原样返回
function todoRowsByCategory(rows) {
  if (_todoCategory == null || _todoCategory === '__all__') return rows;
  var pass = {}, out = [];
  // 第一遍: 挑符合的顶层
  rows.forEach(function(r){
    if (r.parent_id != null) return;
    var hit = _todoCategory === '__none__' ? !r.category : (r.category === _todoCategory);
    if (hit) pass[r.id] = 1;
  });
  // 第二遍: 收集其所有后代
  function isDesc(r, byId, visited) {
    var cur = r; while (cur.parent_id != null) {
      if (visited[cur.parent_id]) return true;
      if (pass[cur.parent_id]) return true;
      cur = byId[cur.parent_id]; if (!cur) return false;
      visited[cur.id] = 1;
    }
    return false;
  }
  var byId = {};
  rows.forEach(function(r){ byId[r.id] = r; });
  rows.forEach(function(r){
    if (r.parent_id == null) { if (pass[r.id]) out.push(r); }
    else if (isDesc(r, byId, {})) out.push(r);
  });
  return out;
}
var PRI_ICON = { 2: '🔴', 1: '🟡', 0: '⚪' };
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
  // opts.startDepth: 首层节点渲染时的 depth (默认 0); 用于详情页跳过 root 时把 root 的 children 视作首层
  // opts.forcedRootDue: 显式指定的顶层截止日期(供 startDepth>0 用, 因为首层不再是根节点)
  function walk(node, depth, rootDue) {
    if (opts.hideDone && !todoSubtreePending(node)) return null;
    // 有效截止日期：顶层用自身 due_date，子任务继承顶层（rootDue）
    var effDue = depth === 0 ? node.due_date : rootDue;
    var wrap = document.createElement('div');
    wrap.className = 'todo-node';
    wrap.setAttribute('data-depth', depth);
    wrap.setAttribute('data-id', node.id);
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

    // 圆形勾选框（点击立即禁用防重，onToggle 完成后由重绘替换掉本按钮）
    var check = document.createElement('button');
    check.type = 'button';
    check.className = 'todo-check' + (node.done ? ' done' : '');
    check.title = node.done ? '取消完成' : '标记完成';
    if (opts.onToggle) check.addEventListener('click', async function(e){
      e.stopPropagation();
      if (check.disabled) return;
      // 顶层重复任务从未完成→完成: 由页面侧弹选择器决定 jumpToCurrent
      if (node.recurrence && node.parent_id == null && !node.done && opts.onToggleRecur) {
        opts.onToggleRecur(node);
        return;
      }
      check.disabled = true;
      check.setAttribute('data-busy', '1');
      try { await opts.onToggle(node, !node.done); }
      finally { check.disabled = false; check.removeAttribute('data-busy'); }
    });
    row.appendChild(check);

    // 优先级圆点：标题前克制点缀（红=高 琥珀=中 灰=低），不占左色带
    var dot = document.createElement('span');
    dot.className = 'todo-dot pri-' + (node.priority != null ? node.priority : 1);
    dot.title = PRI_TEXT[node.priority != null ? node.priority : 1] + '优先级';
    row.appendChild(dot);

    // 主体：标题 + 元信息
    var main = document.createElement('div');
    main.className = 'todo-main';
    var title = document.createElement('div');
    title.className = 'todo-title';
    title.textContent = node.title;
    if (hasChildren) {
      var cnt = document.createElement('span');
      cnt.className = 'todo-count';
      var lc = todoLeafCount(node);
      cnt.textContent = '(' + lc.done + '/' + lc.total + ')';
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
      dc.innerHTML = (over ? (ICONS.warn + '逾期 ') : ICONS.calendar) + esc(todoDateLabel(effDue, today));
      meta.appendChild(dc);
    }
    // 完成时间 chip：已完成且有完成日期时显示
    if (node.done && node.done_at) {
      var doneC = document.createElement('span');
      doneC.className = 'todo-chip done-at';
      doneC.innerHTML = ICONS.check_circle + '完成于 ' + esc(node.done_at);
      meta.appendChild(doneC);
    }
    // 重复徽章: 仅顶层任务显示
    if (depth === 0 && node.recurrence) {
      var rc = document.createElement('span');
      rc.className = 'todo-chip repeat';
      rc.innerHTML = ICONS.repeat + esc(todoRecurLabel(node.recurrence, node.recur_interval, node.recur_nth, node.recur_weekday));
      meta.appendChild(rc);
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
      // 子任务拖拽手柄：按住手柄拖动排序（手柄上禁用触摸滚动，规避移动端争抢）
      var dragHandle = null;
      if (opts.onReorder && depth > 0) {
        dragHandle = document.createElement('button');
        dragHandle.type = 'button'; dragHandle.className = 'todo-op todo-drag'; dragHandle.title = '拖动排序';
        dragHandle.innerHTML = ICONS.drag;
        ops.appendChild(dragHandle);
      }
      if (opts.onAddChild) { var b1 = mkOp(ICONS.plus,  '添加子任务', function(){ opts.onAddChild(node); }); ops.appendChild(b1); }
      if (opts.onEdit)     { var b2 = mkOp(ICONS.edit,  '编辑',       function(){ opts.onEdit(node); }); ops.appendChild(b2); }
      if (opts.onShare && depth === 0) { var b3 = mkOp(ICONS.share, '协作链接', function(){ opts.onShare(node); }); ops.appendChild(b3); }
      if (opts.onDel)      { var b4 = mkOp(ICONS.trash, '删除',       function(){ opts.onDel(node); }, 'danger'); ops.appendChild(b4); }
      if (ops.childNodes.length) row.appendChild(ops);
      // 手柄插入后再绑定拖拽
      if (dragHandle) todoBindDrag(dragHandle, wrap, node, opts);
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
  function mkOp(icon, title, fn, extraClass) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'todo-op' + (extraClass ? ' ' + extraClass : ''); b.title = title;
    b.setAttribute('aria-label', title);
    b.innerHTML = icon;
    b.addEventListener('click', function(e){ e.stopPropagation(); fn(); });
    return b;
  }
  var any = false;
  var startDepth = opts.startDepth || 0;
  // 顶层任务的 rootDue: 优先 opts.forcedRootDue(详情页明确传入); 否则用节点自身 due_date
  trees.forEach(function(t){ var el = walk(t, startDepth, opts.forcedRootDue != null ? opts.forcedRootDue : t.due_date); if (el) { container.appendChild(el); any = true; } });
  if (!any) container.innerHTML = '<div class="todo-empty">🎉 暂无待办，点击上方按钮新建</div>';
}
// 卡片视图：只渲染顶层任务, 一个顶层任务=一张卡片, 不展开子任务
// opts: today / onToggle / onEdit / onDel / onShare / onEnter / readOnly
function renderTodoCards(container, trees, opts) {
  opts = opts || {};
  var today = opts.today || '';
  container.innerHTML = '';
  container.className = 'todo-cards';
  // 隐藏已完成: 整枝无未完成叶子的顶层任务从卡片列表中剔除
  if (opts.hideDone) trees = trees.filter(function(root){ return todoSubtreePending(root); });
  if (trees.length === 0) {
    container.innerHTML = '<div class="todo-empty">🎉 暂无待办，点击上方按钮新建</div>';
    return;
  }
  trees.forEach(function(root){
    var hasChildren = root.children.length > 0;
    // 卡片一律可点击进入详情(只要提供了 onEnter); 详情里能加子任务/查看子任务
    var canEnter = !!opts.onEnter;
    var card = document.createElement('div');
    card.className = 'todo-card pri-' + (root.priority != null ? root.priority : 1) + (root.done ? ' is-done' : '') + (canEnter ? ' clickable' : '');
    card.setAttribute('data-id', root.id);

    // 顶部色带
    var band = document.createElement('div'); band.className = 'todo-card__band'; card.appendChild(band);

    // 内容区
    var body = document.createElement('div'); body.className = 'todo-card__body';
    var head = document.createElement('div'); head.className = 'todo-card__head';

    // 勾选框: 主任务无论有无子任务都显示, 勾选会级联标记整棵子树完成(后端已实现)
    // readOnly 时始终不显示
    if (!opts.readOnly && opts.onToggle) {
      var check = document.createElement('button');
      check.type = 'button';
      check.className = 'todo-card__check' + (root.done ? ' done' : '');
      check.title = root.done ? '取消完成(级联)' : (hasChildren ? '标记完成(级联子任务)' : '标记完成');
      check.addEventListener('click', async function(e){
        e.stopPropagation();
        if (check.disabled) return;
        if (root.recurrence && root.parent_id == null && !root.done && opts.onToggleRecur) {
          opts.onToggleRecur(root);
          return;
        }
        check.disabled = true;
        check.setAttribute('data-busy', '1');
        try { await opts.onToggle(root, !root.done); }
        finally { check.disabled = false; check.removeAttribute('data-busy'); }
      });
      head.appendChild(check);
    }

    // 标题
    var title = document.createElement('div');
    title.className = 'todo-card__title';
    title.textContent = root.title;
    head.appendChild(title);
    body.appendChild(head);

    // meta 行：分类 + 日期 + 叶子进度 chip
    var meta = document.createElement('div'); meta.className = 'todo-card__meta';
    if (root.category) {
      var cc = document.createElement('span'); cc.className = 'todo-chip cat'; cc.textContent = root.category; meta.appendChild(cc);
    }
    if (root.due_date) {
      var over = !root.done && today && root.due_date < today;
      var dc = document.createElement('span');
      dc.className = 'todo-chip due' + (over ? ' overdue' : '');
      dc.innerHTML = (over ? (ICONS.warn + '逾期 ') : ICONS.calendar) + esc(todoDateLabel(root.due_date, today));
      meta.appendChild(dc);
    }
    if (root.done && root.done_at) {
      var doneC = document.createElement('span');
      doneC.className = 'todo-chip done-at';
      doneC.innerHTML = ICONS.check_circle + '完成于 ' + esc(root.done_at);
      meta.appendChild(doneC);
    }
    if (root.recurrence) {
      var rc = document.createElement('span');
      rc.className = 'todo-chip repeat';
      rc.innerHTML = ICONS.repeat + esc(todoRecurLabel(root.recurrence, root.recur_interval, root.recur_nth, root.recur_weekday));
      meta.appendChild(rc);
    }
    if (hasChildren) {
      var lc = todoLeafCount(root);
      var pc = document.createElement('span');
      pc.className = 'todo-chip todo-card__count' + (lc.total > 0 && lc.done === lc.total ? ' done' : '');
      pc.textContent = '📋 ' + lc.done + '/' + lc.total;
      meta.appendChild(pc);
    }
    if (meta.childNodes.length) body.appendChild(meta);

    // 备注单行截断（有则显示）
    if (root.note) {
      var noteEl = document.createElement('div');
      noteEl.className = 'todo-card__note';
      noteEl.textContent = root.note;
      body.appendChild(noteEl);
    }
    card.appendChild(body);

    // 底部操作 + 进入指示
    if (!opts.readOnly || canEnter) {
      var foot = document.createElement('div'); foot.className = 'todo-card__foot';
      var ops = document.createElement('div'); ops.className = 'todo-card__ops';
      if (!opts.readOnly) {
        // 顶层卡片"添加子任务"入口：直接调用 onAddChild, 不必先进详情
        if (opts.onAddChild) ops.appendChild(mkCardOp(ICONS.plus,  '添加子任务', function(){ opts.onAddChild(root); }));
        if (opts.onEdit)  ops.appendChild(mkCardOp(ICONS.edit,  '编辑',       function(){ opts.onEdit(root); }));
        if (opts.onShare) ops.appendChild(mkCardOp(ICONS.share, '协作链接',   function(){ opts.onShare(root); }));
        if (opts.onDel)   ops.appendChild(mkCardOp(ICONS.trash, '删除',       function(){ opts.onDel(root); }, 'danger'));
      }
      foot.appendChild(ops);
      if (canEnter) {
        var enter = document.createElement('div');
        enter.className = 'todo-card__enter';
        enter.textContent = hasChildren ? '查看子任务 ▶' : '进入详情 ▶';
        foot.appendChild(enter);
      }
      card.appendChild(foot);
    }

    // 整卡点击进入详情：忽略勾选/操作按钮区
    if (canEnter) {
      card.addEventListener('click', function(e){
        if (e.target.closest('.todo-card__check, .todo-card__ops')) return;
        opts.onEnter(root);
      });
    }
    container.appendChild(card);
  });
}
// 卡片视图行内操作按钮工厂：与 renderTodoTree 内 mkOp 独立作用域, 避免重名污染
function mkCardOp(icon, title, fn, extraClass) {
  var b = document.createElement('button');
  b.type = 'button'; b.className = 'todo-op' + (extraClass ? ' ' + extraClass : ''); b.title = title;
  b.setAttribute('aria-label', title);
  b.innerHTML = icon;
  b.addEventListener('click', function(e){ e.stopPropagation(); fn(); });
  return b;
}
// 三态视图调度器：opts.view + opts.detailRootId 决定渲染哪种
//   view='tree'                       → 完整树（多棵）
//   view='card' && detailRootId==null → 顶层卡片列表
//   view='card' && detailRootId!=null → 单个顶层任务的完整子树 + 面包屑
// opts 其余键与 renderTodoTree/renderTodoCards 一致, 额外:
//   crumbEl: 面包屑 DOM; onExitDetail(): 返回按钮回调
function todoRenderView(container, trees, opts) {
  opts = opts || {};
  var view = opts.view || 'card';
  var crumb = opts.crumbEl || null;
  container.className = view === 'card' && opts.detailRootId == null ? 'todo-cards' : 'todo-tree';

  if (view === 'tree') {
    if (crumb) crumb.style.display = 'none';
    renderTodoTree(container, trees, opts);
    return;
  }
  // view === 'card'
  if (opts.detailRootId != null) {
    var root = null;
    trees.forEach(function(t){ if (t.id === opts.detailRootId) root = t; });
    if (!root) {
      // 目标顶层已消失（可能被删除或改日期被筛掉）——退回卡片列表
      if (opts.onExitDetail) opts.onExitDetail();
      return;
    }
    if (crumb) {
      crumb.style.display = 'flex';
      crumb.innerHTML = '';
      var back = document.createElement('button');
      back.type = 'button'; back.className = 'todo-crumb__back';
      back.textContent = '← 返回';
      back.addEventListener('click', function(){ if (opts.onExitDetail) opts.onExitDetail(); });
      var t = document.createElement('div');
      t.className = 'todo-crumb__title';
      t.textContent = root.title;
      crumb.appendChild(back);
      crumb.appendChild(t);
      // 详情页"完成主任务/取消完成"入口: 复用 onToggle/onToggleRecur, 与卡片视图勾选框行为一致
      // 只读页(无 onToggle)不显示; 未完成的顶层重复任务优先走 onToggleRecur 弹窗
      if (opts.onToggle && !opts.readOnly) {
        var hasKids = root.children.length > 0;
        var doneBtn = document.createElement('button');
        doneBtn.type = 'button';
        doneBtn.className = 'btn sm' + (root.done ? ' gray' : '');
        doneBtn.innerHTML = root.done
          ? (ICONS.undo + '取消完成')
          : (ICONS.check + (hasKids ? '完成主任务（级联）' : '完成主任务'));
        doneBtn.addEventListener('click', async function(e){
          e.stopPropagation();
          if (doneBtn.disabled) return;
          if (root.recurrence && root.parent_id == null && !root.done && opts.onToggleRecur) {
            opts.onToggleRecur(root);
            return;
          }
          doneBtn.disabled = true;
          doneBtn.setAttribute('data-busy', '1');
          try { await opts.onToggle(root, !root.done); }
          finally { doneBtn.disabled = false; doneBtn.removeAttribute('data-busy'); }
        });
        crumb.appendChild(doneBtn);
      }
      // 详情页添加子任务入口: 只读页(无 onAddChild)不显示
      if (opts.onAddChild) {
        var addBtn = document.createElement('button');
        addBtn.type = 'button'; addBtn.className = 'btn sm'; addBtn.textContent = '➕ 添加子任务';
        addBtn.addEventListener('click', function(e){ e.stopPropagation(); opts.onAddChild(root); });
        crumb.appendChild(addBtn);
      }
    }
    // 详情页只渲染 root 的子任务，避免与面包屑标题重复; 首层子任务视作 depth 0 但截止日期继承 root
    // 如果 root 自身就没子任务, 显示空态提示(添加入口在面包屑上)
    if (root.children.length === 0) {
      container.className = 'todo-tree';
      container.innerHTML = '<div class="todo-empty">此任务暂无子任务' + (opts.onAddChild ? '，点击右上角 ➕ 添加' : '') + '</div>';
      return;
    }
    var childOpts = {};
    for (var k in opts) if (Object.prototype.hasOwnProperty.call(opts, k)) childOpts[k] = opts[k];
    childOpts.startDepth = 0;
    childOpts.forcedRootDue = root.due_date;
    renderTodoTree(container, root.children, childOpts);
    return;
  }
  // 卡片列表
  if (crumb) crumb.style.display = 'none';
  renderTodoCards(container, trees, opts);
}
// 子任务拖拽排序（仅同级重排）：按住行尾手柄即可拖动，同父兄弟间按位置插入，松手回调 onReorder
// handle: 拖拽手柄按钮；wrap: 该节点 .todo-node 容器；node: 数据节点；opts.onReorder(parentId, ids)
function todoBindDrag(handle, wrap, node, opts) {
  var dragging = false, parentBox = null;
  function siblings() {
    return Array.prototype.filter.call(parentBox.children, function(el){
      return el.classList && el.classList.contains('todo-node');
    });
  }
  function cleanup() {
    if (dragging) {
      dragging = false;
      wrap.classList.remove('dragging');
      document.body.classList.remove('todo-dragging');
    }
    document.removeEventListener('pointermove', onMove, true);
    document.removeEventListener('pointerup', onUp, true);
    document.removeEventListener('pointercancel', onUp, true);
  }
  function onMove(e) {
    if (!dragging) return;
    e.preventDefault();
    var y = e.clientY;
    // 在同父兄弟中按各兄弟中点定位插入位置
    var sibs = siblings();
    for (var i = 0; i < sibs.length; i++) {
      var el = sibs[i];
      if (el === wrap) continue;
      var r = el.getBoundingClientRect();
      var mid = r.top + r.height / 2;
      if (y < mid) { if (el !== wrap.nextSibling) parentBox.insertBefore(wrap, el); return; }
    }
    if (wrap !== parentBox.lastChild) parentBox.appendChild(wrap);
  }
  function onUp() {
    var wasDragging = dragging;
    var box = parentBox;
    cleanup();
    if (!wasDragging || !box) return;
    var ids = Array.prototype.filter.call(box.children, function(el){
      return el.classList && el.classList.contains('todo-node');
    }).map(function(el){ return parseInt(el.getAttribute('data-id'), 10); });
    var pid = node.parent_id != null ? node.parent_id : null;
    opts.onReorder(pid, ids);
  }
  handle.addEventListener('pointerdown', function(e){
    e.preventDefault(); e.stopPropagation();
    dragging = true;
    parentBox = wrap.parentNode; // .todo-children
    wrap.classList.add('dragging');
    document.body.classList.add('todo-dragging');
    if (navigator.vibrate) { try { navigator.vibrate(15); } catch(err){} }
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('pointercancel', onUp, true);
  });
  // 手柄上点击不触发行展开
  handle.addEventListener('click', function(e){ e.stopPropagation(); });
}
// 任务编辑表单 HTML：标题(多行长文本)/优先级/截止(仅顶层, 新建默认当天)/分类/备注
// isNew=true 新建；isChild=true 为子任务(日期继承主任务, 不显示日期字段)
function todoFormHtml(t, isNew, isChild) {
  t = t || {};
  var defDue = t.due_date || (isNew ? todoTodayStr() : '');
  var dueField = isChild ? '' :
    '<div><label>截止日期</label><input id="tfDue" type="date" value="' + defDue + '"></div>';
  return '<label>标题</label>' +
    '<textarea id="tfTitle" rows="2" data-autogrow="1" placeholder="要做什么？（支持换行）" style="resize:vertical;">' + esc(t.title || '') + '</textarea>' +
    '<div class="row">' +
      '<div><label>优先级</label><select id="tfPri">' +
        '<option value="2"' + (t.priority === 2 ? ' selected' : '') + '>🔴 高</option>' +
        '<option value="1"' + (t.priority == null || t.priority === 1 ? ' selected' : '') + '>🟡 中</option>' +
        '<option value="0"' + (t.priority === 0 ? ' selected' : '') + '>⚪ 低</option>' +
      '</select></div>' +
      dueField +
    '</div>' +
    (isChild ? '<p class="muted" style="margin:-4px 0 10px;font-size:12px;">' + ICONS.calendar + '子任务的截止日期跟随主任务</p>'
             : '<p class="muted" style="margin:-4px 0 10px;font-size:12px;">📌 留空截止日期即作备忘录，不计入日报</p>') +
    (isChild ? '' :
      '<label>重复</label>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
        '<select id="tfRecur" style="flex:1;min-width:120px;">' +
          '<option value="">不重复</option>' +
          '<option value="daily"' + (t.recurrence === 'daily' ? ' selected' : '') + '>每日</option>' +
          '<option value="weekly"' + (t.recurrence === 'weekly' ? ' selected' : '') + '>每周</option>' +
          '<option value="monthly"' + (t.recurrence === 'monthly' ? ' selected' : '') + '>每月 (按日期, 如每月 5 号)</option>' +
          '<option value="monthly_nth_weekday"' + (t.recurrence === 'monthly_nth_weekday' ? ' selected' : '') + '>每月第 N 个星期 X</option>' +
          '<option value="yearly"' + (t.recurrence === 'yearly' ? ' selected' : '') + '>每年</option>' +
        '</select>' +
        '<span id="tfRecurNBox" style="display:' + (t.recurrence ? 'inline-flex' : 'none') + ';align-items:center;gap:4px;color:#5a6b9a;font-size:13px;">' +
          '每' +
          '<input id="tfRecurN" type="number" min="1" max="99" value="' + (t.recur_interval && t.recur_interval >= 1 ? t.recur_interval : 1) + '" style="width:58px;padding:4px 6px;text-align:center;">' +
          '<span id="tfRecurUnit">' + (({ daily:'天', weekly:'周', monthly:'月', monthly_nth_weekday:'月', yearly:'年' })[t.recurrence] || '天') + '</span>' +
        '</span>' +
      '</div>' +
      // monthly_nth_weekday 专属两下拉: 位置(第 N 个) + 星期几; 仅在选中该重复时显示
      '<div id="tfNthWrap" style="display:' + (t.recurrence === 'monthly_nth_weekday' ? 'flex' : 'none') + ';gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap;">' +
        '<span style="color:#5a6b9a;font-size:13px;">的</span>' +
        '<select id="tfRecurNth" style="flex:1;min-width:110px;">' +
          '<option value="1"' + (t.recur_nth === 1 ? ' selected' : '') + '>第一个</option>' +
          '<option value="2"' + (t.recur_nth === 2 ? ' selected' : '') + '>第二个</option>' +
          '<option value="3"' + (t.recur_nth === 3 ? ' selected' : '') + '>第三个</option>' +
          '<option value="4"' + (t.recur_nth === 4 ? ' selected' : '') + '>第四个</option>' +
          '<option value="5"' + (t.recur_nth === 5 ? ' selected' : '') + '>最后一个</option>' +
        '</select>' +
        '<select id="tfRecurWd" style="flex:1;min-width:110px;">' +
          '<option value="1"' + (t.recur_weekday === 1 ? ' selected' : '') + '>周一</option>' +
          '<option value="2"' + (t.recur_weekday === 2 ? ' selected' : '') + '>周二</option>' +
          '<option value="3"' + (t.recur_weekday === 3 ? ' selected' : '') + '>周三</option>' +
          '<option value="4"' + (t.recur_weekday === 4 ? ' selected' : '') + '>周四</option>' +
          '<option value="5"' + (t.recur_weekday === 5 ? ' selected' : '') + '>周五</option>' +
          '<option value="6"' + (t.recur_weekday === 6 ? ' selected' : '') + '>周六</option>' +
          '<option value="0"' + (t.recur_weekday === 0 ? ' selected' : '') + '>周日</option>' +
        '</select>' +
      '</div>' +
      '<p class="muted" style="margin:-4px 0 10px;font-size:12px;">' + ICONS.repeat + '完成后自动生成下一条任务；如"每 2 周"、"每月第一个周一"</p>') +
    '<label>分类（可选）</label>' +
    '<select id="tfCatSel"><option value="">（无分类）</option><option value="__new__">➕ 新建分类…</option></select>' +
    '<input id="tfCatNew" placeholder="输入新分类名称" style="display:none;">' +
    '<label>备注（可选）</label>' +
    '<textarea id="tfNote" rows="2" data-autogrow="1" placeholder="补充说明…" style="resize:vertical;">' + esc(t.note || '') + '</textarea>';
}
function todoFormRead() {
  var dueEl = document.getElementById('tfDue');
  // 分类: 下拉 tfCatSel 选中 '__new__' 时读 tfCatNew 输入; 空字符串归一为 null
  var catSel = document.getElementById('tfCatSel');
  var catVal = catSel ? catSel.value : '';
  if (catVal === '__new__') {
    var catNewEl = document.getElementById('tfCatNew');
    catVal = catNewEl ? catNewEl.value.trim() : '';
  }
  return {
    title: document.getElementById('tfTitle').value.trim(),
    priority: parseInt(document.getElementById('tfPri').value, 10),
    due_date: dueEl ? (dueEl.value || null) : null,
    category: catVal || null,
    note: document.getElementById('tfNote').value.trim() || null,
    recurrence: (function(){ var e = document.getElementById('tfRecur'); return e ? (e.value || null) : null; })(),
    recur_interval: (function(){
      var e = document.getElementById('tfRecur');
      var n = document.getElementById('tfRecurN');
      if (!e || !e.value || !n) return null; // 无 recurrence 时不传, 后端自动 clamp 为 null
      var v = parseInt(n.value, 10);
      if (!isFinite(v) || v < 1) return 1;
      return Math.min(v, 99);
    })(),
    // monthly_nth_weekday 专属两列: 其它周期时忽略即可(后端 readRecurFields 会强制清空)
    recur_nth: (function(){
      var e = document.getElementById('tfRecur');
      var n = document.getElementById('tfRecurNth');
      if (!e || e.value !== 'monthly_nth_weekday' || !n) return null;
      var v = parseInt(n.value, 10);
      if (!isFinite(v) || v < 1 || v > 5) return null;
      return v;
    })(),
    recur_weekday: (function(){
      var e = document.getElementById('tfRecur');
      var w = document.getElementById('tfRecurWd');
      if (!e || e.value !== 'monthly_nth_weekday' || !w) return null;
      var v = parseInt(w.value, 10);
      if (!isFinite(v) || v < 0 || v > 6) return null;
      return v;
    })()
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
  var s = data.stats || { pending:0, overdue:0, done:0, total:0, memo:0 };
  _stats = s;
  document.getElementById('stPending').textContent = s.pending;
  document.getElementById('stOverdue').textContent = s.overdue;
  document.getElementById('stDone').textContent = todoDoneByFilter(_rows, _filter, todayStr(), _curRange);
  document.getElementById('stMemo').textContent = s.memo || 0;
  updateStatsHint(_filter, _curRange);
  drawTree();
}
var _filter = 'all'; // all | today | overdue | future | memo | done
// 按筛选归类顶层任务（子任务随顶层，因日期继承主任务）
function todoFilterTrees(trees) {
  var t = todayStr();
  if (_filter === 'today')   return trees.filter(function(n){ return n.due_date && n.due_date === t; });
  if (_filter === 'overdue') return trees.filter(function(n){ return n.due_date && n.due_date < t; });
  if (_filter === 'future')  return trees.filter(function(n){ return n.due_date && n.due_date > t; });
  if (_filter === 'memo')    return trees.filter(function(n){ return !n.due_date; });
  if (_filter === 'done')    return trees.filter(function(n){ return n.done; });
  return trees;
}
// 视图 3 态循环需要的一对回调: 取当前 rows / 触发树重绘
function _todoGetRows() { return _rows; }
function drawTree() {
  // 已完成 tab 下强制显示完成项，否则遵从复选框
  var hideDone = _filter === 'done' ? false : document.getElementById('hideDone').checked;
  // 先按抽屉选中的分类过滤扁平 rows, 再按 filter tab 过滤顶层
  var trees = todoFilterTrees(todoBuildTree(todoRowsByCategory(_rows)));
  var container = document.getElementById('todoTree');
  var crumb = document.getElementById('todoCrumb');
  todoRenderView(container, trees, {
    view: _todoView === 'default' ? 'card' : _todoView,
    detailRootId: _todoDetailRootId,
    crumbEl: crumb,
    today: todayStr(), hideDone: hideDone,
    onExitDetail: function(){ _todoDetailRootId = null; drawTree(); },
    onEnter: function(node){ _todoDetailRootId = node.id; drawTree(); },
    onToggleRecur: function(node){
      var dueDate = node.due_date || todayStr();
      var defaultNext = shiftDateLocal(dueDate, node.recurrence, false, todayStr(), node.recur_interval, node.recur_nth, node.recur_weekday);
      var jumpNext = shiftDateLocal(dueDate, node.recurrence, true, todayStr(), node.recur_interval, node.recur_nth, node.recur_weekday);
      var sameDate = defaultNext === jumpNext;
      var _t = todayStr();
      var html =
        '<p style="margin:6px 0;">📝 ' + esc(node.title) + '（' + todoRecurLabel(node.recurrence, node.recur_interval, node.recur_nth, node.recur_weekday) + '）</p>' +
        '<p class="muted" style="margin:4px 0 14px;">本次截止：' + esc(todoDateLabel(dueDate, _t)) + ' <span style="color:#b0b6c8;">(' + dueDate + ')</span></p>' +
        '<p style="margin:6px 0;">完成后自动生成下一条任务，日期：</p>' +
        '<label style="display:block;padding:8px 4px;"><input type="radio" name="rjump" value="0" checked style="width:auto;margin-right:8px;"> ' + todoDateLabel(defaultNext, _t) + ' <span style="color:#b0b6c8;font-size:12px;">(' + defaultNext + ')</span>（下一周期，默认）</label>' +
        (sameDate ? '' :
          '<label style="display:block;padding:8px 4px;"><input type="radio" name="rjump" value="1" style="width:auto;margin-right:8px;"> ' + todoDateLabel(jumpNext, _t) + ' <span style="color:#b0b6c8;font-size:12px;">(' + jumpNext + ')</span>（跳到当前周期）</label>') +
        '<div style="text-align:right;margin-top:14px;"><button type="button" class="btn gray" onclick="closeModal()">取消</button> <button type="button" class="btn" id="rrConfirm">完成并生成</button></div>';
      openModal('✅ 完成重复任务', html);
      bindClickBusy(document.getElementById('rrConfirm'), async function(){
        var jr = document.querySelector('input[name="rjump"]:checked');
        var jumpToCurrent = !!(jr && jr.value === '1');
        await api('/api/todo/' + node.id + '/done', { method:'PUT', body:{ done: true, jumpToCurrent: jumpToCurrent } });
        closeModal();
        await loadTodos(); await loadChart();
        todoCelebrate(_stats.total - _stats.done, _stats.total);
      });
    },
    onToggle: async function(node, done){
      try {
        await api('/api/todo/' + node.id + '/done', { method:'PUT', body:{ done: done } });
        await loadTodos(); await loadChart();
        if (done) todoCelebrate(_stats.total - _stats.done, _stats.total);
      }
      catch(e){ alertModal(e.message, {ok:false}); }
    },
    onEdit: function(node){
      var isChild = node.parent_id != null;
      openModal('编辑任务', todoFormHtml(node, false, isChild) +
        '<div style="margin-top:12px;"><button class="btn" id="tfSave">保存</button> <button class="btn gray" onclick="closeModal()">取消</button></div>');
      todoFillCategoryOptions(_rows, node.category || '');
      bindClickBusy(document.getElementById('tfSave'), async function(){
        var body = todoFormRead();
        if (!body.title) { alertModal('请填写标题', {ok:false}); return; }
        await api('/api/todo/' + node.id, { method:'PUT', body: body });
        closeModal(); await loadTodos();
      });
    },
    onAddChild: function(node){ openAddForm(node.id, '为「' + node.title + '」添加子任务', true); },
    onDel: function(node){ confirmDeleteTodo(node); },
    onShare: function(node){ todoShareLink(node.id); },
    onReorder: async function(parentId, ids){
      try { await api('/api/todo/reorder', { method:'PUT', body:{ parent_id: parentId, ids: ids } }); await loadTodos(); }
      catch(e){ alertModal(e.message, {ok:false}); await loadTodos(); }
    }
  });
}
function confirmDeleteTodo(node) {
  openModal('删除任务',
    '<p style="line-height:1.6;">删除「' + esc(node.title) + '」及其全部子任务？</p>' +
    '<div style="text-align:right;margin-top:18px;"><button type="button" class="btn gray" onclick="closeModal()">取消</button> <button type="button" class="btn danger" id="tdDelConfirm">删除</button></div>');
  bindClickBusy(document.getElementById('tdDelConfirm'), async function(){
    await api('/api/todo/' + node.id, { method:'DELETE' });
    closeModal(); await loadTodos(); await loadChart();
    // 若删除的是当前详情页的根节点, 退回卡片列表
    if (_todoDetailRootId === node.id) _todoDetailRootId = null;
  });
}
window.todoShareLink = async function(id, reset){
  async function openShare(doReset) {
    var d = await api('/api/todo/' + id + '/share-link' + (doReset ? '?reset=1' : ''));
    openModal('免密协作链接',
      '<p class="muted">此链接长期有效，打开无需登录即可查看、添加、勾选该清单下的任务。</p>' +
      '<input id="tShareUrl" value="' + esc(d.link) + '" readonly style="margin-bottom:8px;">' +
      '<button class="btn" onclick="todoCopy()">复制链接</button> ' +
      '<button class="btn gray" onclick="todoShareLink(' + id + ', true)">重置链接</button>' +
      (doReset ? '<p class="msg ok" style="margin-top:8px;">链接已重置，旧链接已失效</p>' : ''));
  }
  if (reset) return confirmModal('重置链接', '重置后，旧链接将立即失效，已分享出去的旧链接将无法再使用。确认重置？', function(){ return openShare(true); });
  try { await openShare(false); } catch(e){ alertModal(e.message, {ok:false}); }
};
window.todoCopy = function(){ var el=document.getElementById('tShareUrl'); el.select(); try{document.execCommand('copy');alertModal('已复制');}catch(e){alertModal('请手动复制', {ok:false});} };
function openAddForm(parentId, title, isChild) {
  openModal(title, todoFormHtml({}, true, !!isChild) +
    '<div style="margin-top:12px;"><button class="btn" id="tfCreate">创建</button> <button class="btn gray" onclick="closeModal()">取消</button></div>');
  // 新建时若抽屉选中了具体分类, 预填该分类, 便于连续录入
  var pref = (_todoCategory && _todoCategory !== '__none__') ? _todoCategory : '';
  todoFillCategoryOptions(_rows, pref);
  bindClickBusy(document.getElementById('tfCreate'), async function(){
    var body = todoFormRead();
    if (!body.title) { alertModal('请填写标题', {ok:false}); return; }
    if (parentId != null) body.parent_id = parentId;
    await api('/api/todo', { method:'POST', body: body });
    closeModal(); await loadTodos(); await loadChart();
  });
}
bindClickBusy(document.getElementById('tAdd'), function(){ openAddForm(null, '新建任务', false); return Promise.resolve(); });
bindClickBusy(document.getElementById('tAddFs'), function(){ openAddForm(null, '新建任务', false); return Promise.resolve(); });
// 视图三态循环: default → card → tree → default
bindClickBusy(document.getElementById('viewToggle'), function(){
  enterTodoFullscreen(_todoGetRows, drawTree);
  return Promise.resolve();
});
// 抽屉切换按钮 ☰
bindClickBusy(document.getElementById('drawerToggle'), function(){
  toggleTodoDrawer(_todoGetRows, drawTree);
  return Promise.resolve();
});
// 抽屉右上角 ✕
bindClickBusy(document.getElementById('drawerClose'), function(){
  _todoDrawerOpen = false;
  try { localStorage.setItem('todoDrawer', '0'); } catch(e){}
  applyTodoView(_todoGetRows, drawTree);
  return Promise.resolve();
});
// 抽屉遮罩点击关闭(仅手机, CSS 控制显隐)
document.getElementById('todoDrawerMask').addEventListener('click', function(){
  _todoDrawerOpen = false;
  try { localStorage.setItem('todoDrawer', '0'); } catch(e){}
  applyTodoView(_todoGetRows, drawTree);
});
// 视口尺寸变化时刷新抽屉状态(用户拖窗跨越 640px 边界)
window.addEventListener('resize', function(){ if (_todoView !== 'default') applyTodoView(_todoGetRows, drawTree); });
document.getElementById('hideDone').addEventListener('change', drawTree);
// 筛选 tab：点击切换 active 并重绘
document.getElementById('todoFilter').addEventListener('click', function(e){
  var btn = e.target.closest('button[data-filter]');
  if (!btn) return;
  _filter = btn.getAttribute('data-filter');
  Array.prototype.forEach.call(this.querySelectorAll('button'), function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  // 已完成计数按 filter × range 双维度联动
  document.getElementById('stDone').textContent = todoDoneByFilter(_rows, _filter, todayStr(), _curRange);
  updateStatsHint(_filter, _curRange);
  // 图表下拉框联动: today→7d, 其它→month
  syncChartRangeToFilter(_filter);
  drawTree();
});

// 任务趋势图（含子任务），默认当月
var _curRange = 'month';
async function loadChart() {
  try {
    var d = await api('/api/todo/chart?range=' + _curRange);
    drawTodoChart('todoChart', d.series);
  } catch(e){ /* 图表失败不阻断页面 */ }
}
bindTodoRange(function(r){
  _curRange = r;
  // range 变化: stDone 时间窗跟着变
  document.getElementById('stDone').textContent = todoDoneByFilter(_rows, _filter, todayStr(), _curRange);
  updateStatsHint(_filter, _curRange);
  loadChart();
});

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
bindClickBusy(document.getElementById('pushSave'), async function(){
  await api('/api/push/todo', { method:'PUT', body:{
    channel_ids: tPushChannelPick ? tPushChannelPick.getValues() : [],
    format: document.getElementById('pushFmt').value,
    hours: tPushHourPick ? tPushHourPick.getString() : '9',
    enabled: document.getElementById('pushEn').checked
  }});
  alertModal('推送配置已保存');
});
bindClickBusy(document.getElementById('pushSend'), async function(){
  setLoadingProgress(90);
  var r = await api('/api/push/todo/send', { method:'POST', loadingText: '正在发送待办日报…' });
  alertModal(r.message || '已推送');
});

(async function(){
  try {
    await loadTodos();
    await loadChart();
    await loadPush();
    // 应用视图状态: localStorage 里可能已有 'card'/'tree', 首次进入直接全屏
    applyTodoView(_todoGetRows, drawTree);
  }
  catch(e){ if (String(e.message).indexOf('登录')>=0) location.href='/login'; else alertModal(e.message, {ok:false}); }
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
var _curRange = 'month';

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
    // 应用视图状态(抽屉/全屏/按钮文案); onDrawTree 仅重绘可见树, 不重新 loadPublic(避免死循环)
    // 这个 fn 也会被 viewToggleFs/exitFullscreen 等按钮的幂等绑定捕获, 必须能触发实际重绘
    applyTodoView(_todoGetRows, function(){ drawTree(visibleTrees()); });
  } catch(e) { showMsg(msg, e.message || '链接无效', false); }
}
// 可见树：仅截止今天或已逾期的顶层任务（与日报 filterTodayOverdue 口径一致），子任务随顶层
function visibleTrees() {
  return todoBuildTree(_rows).filter(function(t){
    return t.due_date && _today && t.due_date <= _today;
  });
}
// 统计（口径同日报 statsOfReport）：基于可见树，子任务继承顶层截止日期判逾期
// 已完成一栏改为"当月完成"(免密单链接页无 filter, 默认按月)
function renderStats(trees) {
  var pending = 0, overdue = 0;
  function walk(node, rootDue){
    if (node.children.length > 0) {
      // 有子任务：父不计入，仅递归统计子任务（叶子口径，与后端 countStats 一致）
      node.children.forEach(function(c){ walk(c, rootDue); });
      return;
    }
    if (!node.done) {
      pending++;
      if (rootDue && _today && rootDue < _today) overdue++;
    }
  }
  trees.forEach(function(root){ walk(root, root.due_date); });
  document.getElementById('stPending').textContent = pending;
  document.getElementById('stOverdue').textContent = overdue;
  document.getElementById('stDone').textContent = todoDoneByFilter(_rows, 'all', _today, _curRange);
  // 单链接页无 filter tab, 固定 all 语义(未完成/已逾期为可见子树, 已完成按 _curRange 时间窗)
  updateStatsHint('all', _curRange);
}
async function loadChart() {
  try { var c = await api('/api/public/todo-chart/' + _token + '?range=' + _curRange); drawTodoChart('todoChart', c.series); }
  catch(e){ /* 图表失败不阻断 */ }
}
// 为 applyTodoView 提供 rows(用可见的扁平原始数据构造抽屉计数)
function _todoGetRows() { return _rows; }
function drawTree(trees) {
  var container = document.getElementById('todoTree');
  var crumb = document.getElementById('todoCrumb');
  // 若已切到 tree/card 全屏, 用扁平 rows 按分类过滤后重新可见树; 默认页面沿用传入的 visibleTrees
  var effectiveTrees = trees;
  if (_todoView !== 'default' && _todoCategory != null && _todoCategory !== '__all__') {
    effectiveTrees = todoBuildTree(todoRowsByCategory(_rows)).filter(function(t){
      return t.due_date && _today && t.due_date <= _today;
    });
  }
  // 免密单链接页只覆盖一个顶层子树, 时间筛选无意义; 仅支持"隐藏已完成"
  var hideBox = document.getElementById('hideDone');
  var hideDone = hideBox ? hideBox.checked : false;
  todoRenderView(container, effectiveTrees, {
    view: _todoView === 'default' ? 'card' : _todoView,
    detailRootId: _todoDetailRootId,
    crumbEl: crumb,
    today: _today, hideDone: hideDone,
    onExitDetail: function(){ _todoDetailRootId = null; loadPublic(); },
    onEnter: function(node){ _todoDetailRootId = node.id; loadPublic(); },
    onToggle: async function(node, done){
      try {
        await api('/api/public/todo/' + _token + '/' + node.id + '/done', { method:'PUT', body:{ done: done } });
        await loadPublic();
        if (done) {
          // 庆祝口径与可见列表一致（叶子口径）：有子任务的父不计，只数末端叶子
          var total = 0, doneCnt = 0;
          (function count(list){ list.forEach(function(n){
            if (n.children.length > 0) { count(n.children); return; }
            total++; if (n.done) doneCnt++;
          }); })(visibleTrees());
          todoCelebrate(total - doneCnt, total);
        }
      }
      catch(e){ alertModal(e.message, {ok:false}); }
    },
    onEdit: function(node){
      var isChild = node.id !== _rootId;
      openModal('编辑任务', todoFormHtml(node, false, isChild) +
        '<div style="margin-top:12px;"><button class="btn" id="tfSave">保存</button> <button class="btn gray" onclick="closeModal()">取消</button></div>');
      todoFillCategoryOptions(_rows, node.category || '');
      bindClickBusy(document.getElementById('tfSave'), async function(){
        var body = todoFormRead();
        if (!body.title) { alertModal('请填写标题', {ok:false}); return; }
        await api('/api/public/todo/' + _token + '/' + node.id, { method:'PUT', body: body });
        closeModal(); await loadPublic();
      });
    },
    onAddChild: function(node){ openAddForm(node.id, '为「' + node.title + '」添加子任务'); }
  });
}
function openAddForm(parentId, title) {
  openModal(title, todoFormHtml({}, true, true) +
    '<div style="margin-top:12px;"><button class="btn" id="tfCreate">添加</button> <button class="btn gray" onclick="closeModal()">取消</button></div>');
  var pref = (_todoCategory && _todoCategory !== '__none__' && _todoCategory !== '__all__') ? _todoCategory : '';
  todoFillCategoryOptions(_rows, pref);
  bindClickBusy(document.getElementById('tfCreate'), async function(){
    var body = todoFormRead();
    if (!body.title) { alertModal('请填写标题', {ok:false}); return; }
    if (parentId != null) body.parent_id = parentId;
    await api('/api/public/todo/' + _token, { method:'POST', body: body });
    closeModal(); await loadPublic();
  });
}
bindClickBusy(document.getElementById('tAddRoot'), function(){ openAddForm(_rootId, '添加任务'); return Promise.resolve(); });
bindClickBusy(document.getElementById('tAddFs'), function(){ openAddForm(_rootId, '添加任务'); return Promise.resolve(); });
// 视图三态循环
bindClickBusy(document.getElementById('viewToggle'), function(){
  enterTodoFullscreen(_todoGetRows, function(){ loadPublic(); });
  return Promise.resolve();
});
// 抽屉切换
bindClickBusy(document.getElementById('drawerToggle'), function(){
  toggleTodoDrawer(_todoGetRows, function(){ loadPublic(); });
  return Promise.resolve();
});
bindClickBusy(document.getElementById('drawerClose'), function(){
  _todoDrawerOpen = false;
  try { localStorage.setItem('todoDrawer', '0'); } catch(e){}
  applyTodoView(_todoGetRows, function(){ loadPublic(); });
  return Promise.resolve();
});
document.getElementById('todoDrawerMask').addEventListener('click', function(){
  _todoDrawerOpen = false;
  try { localStorage.setItem('todoDrawer', '0'); } catch(e){}
  applyTodoView(_todoGetRows, function(){ loadPublic(); });
});
window.addEventListener('resize', function(){ if (_todoView !== 'default') applyTodoView(_todoGetRows, function(){ loadPublic(); }); });
// hideDone 复选框: 变化时仅重绘可见树, 不重拉数据
var _hb = document.getElementById('hideDone');
if (_hb) _hb.addEventListener('change', function(){ drawTree(visibleTrees()); });
loadPublic();
`;

// ============ 待办免密报告查看页（只读） ============
const TODO_REPORT_JS = `
${COMMON_JS}
${TODO_TREE_CORE}
bindModal();
bindQuickLogin('todo-report');
var _token = location.pathname.split('/').filter(Boolean).pop();
var _curRange = 'month';
var _rows = [], _trees = [], _today = '';
var _filter = 'all'; // all | today | overdue | future | memo | done
function _todoGetRows() { return _rows; }
async function loadChart() {
  try { var c = await api('/api/public/todo-chart/' + _token + '?range=' + _curRange); drawTodoChart('todoChart', c.series); }
  catch(e){ /* 图表失败不阻断 */ }
}
function drawTree() {
  var t = _today;
  // 时间筛选 tab: 与登录态 TODO_JS 逻辑一致(顶层口径)
  var filtered = _trees;
  if (_filter === 'today')   filtered = _trees.filter(function(n){ return n.due_date && n.due_date === t; });
  else if (_filter === 'overdue') filtered = _trees.filter(function(n){ return n.due_date && n.due_date < t; });
  else if (_filter === 'future')  filtered = _trees.filter(function(n){ return n.due_date && n.due_date > t; });
  else if (_filter === 'memo')    filtered = _trees.filter(function(n){ return !n.due_date; });
  else if (_filter === 'done')    filtered = _trees.filter(function(n){ return n.done; });
  // 全屏态下按抽屉选中的分类过滤扁平 rows 重新建树
  var trees = filtered;
  if (_todoView !== 'default' && _todoCategory != null && _todoCategory !== '__all__') {
    var byCat = todoBuildTree(todoRowsByCategory(_rows));
    // 分类过滤后再按当前 filter 过滤一次(保持两者协同)
    trees = byCat.filter(function(n){
      if (_filter === 'today')   return n.due_date && n.due_date === t;
      if (_filter === 'overdue') return n.due_date && n.due_date < t;
      if (_filter === 'future')  return n.due_date && n.due_date > t;
      if (_filter === 'memo')    return !n.due_date;
      if (_filter === 'done')    return n.done;
      return true;
    });
  }
  // 已完成 tab 下强制显示完成项, 否则遵从复选框
  var hideBox = document.getElementById('hideDone');
  var hideDone = (_filter === 'done') ? false : (hideBox ? hideBox.checked : false);
  todoRenderView(document.getElementById('todoTree'), trees, {
    view: _todoView === 'default' ? 'card' : _todoView,
    detailRootId: _todoDetailRootId,
    crumbEl: document.getElementById('todoCrumb'),
    today: _today, hideDone: hideDone,
    onExitDetail: function(){ _todoDetailRootId = null; drawTree(); },
    onEnter: function(node){ _todoDetailRootId = node.id; drawTree(); },
    // 顶层重复任务勾选前弹窗选下一日期(与 TODO_COLLAB_JS 同口径)
    onToggleRecur: function(node){
      var dueDate = node.due_date || _today;
      var defaultNext = shiftDateLocal(dueDate, node.recurrence, false, _today, node.recur_interval, node.recur_nth, node.recur_weekday);
      var jumpNext = shiftDateLocal(dueDate, node.recurrence, true, _today, node.recur_interval, node.recur_nth, node.recur_weekday);
      var sameDate = defaultNext === jumpNext;
      var html =
        '<p style="margin:6px 0;">📝 ' + esc(node.title) + '（' + todoRecurLabel(node.recurrence, node.recur_interval, node.recur_nth, node.recur_weekday) + '）</p>' +
        '<p class="muted" style="margin:4px 0 14px;">本次截止：' + esc(todoDateLabel(dueDate, _today)) + ' <span style="color:#b0b6c8;">(' + dueDate + ')</span></p>' +
        '<p style="margin:6px 0;">完成后自动生成下一条任务，日期：</p>' +
        '<label style="display:block;padding:8px 4px;"><input type="radio" name="rjump" value="0" checked style="width:auto;margin-right:8px;"> ' + todoDateLabel(defaultNext, _today) + ' <span style="color:#b0b6c8;font-size:12px;">(' + defaultNext + ')</span>（下一周期，默认）</label>' +
        (sameDate ? '' :
          '<label style="display:block;padding:8px 4px;"><input type="radio" name="rjump" value="1" style="width:auto;margin-right:8px;"> ' + todoDateLabel(jumpNext, _today) + ' <span style="color:#b0b6c8;font-size:12px;">(' + jumpNext + ')</span>（跳到当前周期）</label>') +
        '<div style="text-align:right;margin-top:14px;"><button type="button" class="btn gray" onclick="closeModal()">取消</button> <button type="button" class="btn" id="rrConfirm">完成并生成</button></div>';
      openModal('✅ 完成重复任务', html);
      bindClickBusy(document.getElementById('rrConfirm'), async function(){
        var jr = document.querySelector('input[name="rjump"]:checked');
        var jumpToCurrent = !!(jr && jr.value === '1');
        await api('/api/public/todo-all/' + _token + '/' + node.id + '/done', { method:'PUT', body:{ done: true, jumpToCurrent: jumpToCurrent } });
        closeModal();
        await reloadReport();
      });
    },
    onToggle: async function(node, done){
      try {
        await api('/api/public/todo-all/' + _token + '/' + node.id + '/done', { method:'PUT', body:{ done: done } });
        await reloadReport();
        if (done) {
          // 庆祝口径与可见列表一致(叶子口径): 有子任务的父不计, 只数末端叶子
          var total = 0, doneCnt = 0;
          (function count(list){ list.forEach(function(n){
            if (n.children.length > 0) { count(n.children); return; }
            total++; if (n.done) doneCnt++;
          }); })(_trees);
          todoCelebrate(total - doneCnt, total);
        }
      }
      catch(e){ alertModal(e.message, {ok:false}); }
    },
    onAddChild: function(node){ openAddForm(node.id, '为「' + node.title + '」添加子任务', true); }
  });
}
// 新建任务/子任务弹窗: parentId=null → 顶层主任务(可设日期/重复); 传 id → 子任务(继承主任务日期)
// 与 TODO_COLLAB_JS 同口径, 走 report_token 的 /api/public/todo-all/:token API
function openAddForm(parentId, title, isChild) {
  openModal(title, todoFormHtml({}, true, !!isChild) +
    '<div style="margin-top:12px;"><button class="btn" id="tfCreate">添加</button> <button class="btn gray" onclick="closeModal()">取消</button></div>');
  var pref = (_todoCategory && _todoCategory !== '__none__' && _todoCategory !== '__all__') ? _todoCategory : '';
  todoFillCategoryOptions(_rows, pref);
  bindClickBusy(document.getElementById('tfCreate'), async function(){
    var body = todoFormRead();
    if (!body.title) { alertModal('请填写标题', {ok:false}); return; }
    if (parentId != null) body.parent_id = parentId;
    await api('/api/public/todo-all/' + _token, { method:'POST', body: body });
    closeModal(); await reloadReport();
  });
}
// 刷新数据并重绘: 勾选后调用, 重新拉 report + 重算 stats + 重画树
async function reloadReport() {
  var d = await api('/api/public/todo-report/' + _token);
  var s = d.stats || { pending:0, overdue:0, done:0 };
  document.getElementById('stPending').textContent = s.pending;
  document.getElementById('stOverdue').textContent = s.overdue;
  _rows = d.todos || [];
  _trees = todoBuildTree(_rows);
  _today = d.today || '';
  document.getElementById('stDone').textContent = todoDoneByFilter(_rows, _filter, _today, _curRange);
  updateStatsHint(_filter, _curRange);
  drawTree();
}
(async function(){
  try {
    var d = await api('/api/public/todo-report/' + _token);
    var s = d.stats || { pending:0, overdue:0, done:0 };
    document.getElementById('stPending').textContent = s.pending;
    document.getElementById('stOverdue').textContent = s.overdue;
    document.getElementById('content').style.display = 'block';
    _rows = d.todos || [];
    _trees = todoBuildTree(_rows);
    _today = d.today || '';
    // 已完成一栏: 按 _filter × _curRange 双维度联动
    document.getElementById('stDone').textContent = todoDoneByFilter(_rows, _filter, _today, _curRange);
    updateStatsHint(_filter, _curRange);
    // 视图三态循环
    bindClickBusy(document.getElementById('viewToggle'), function(){
      enterTodoFullscreen(_todoGetRows, drawTree);
      return Promise.resolve();
    });
    // 新建主任务: 常规态 / 全屏态两处入口共用 openAddForm(null,...)
    bindClickBusy(document.getElementById('tAddRoot'), function(){ openAddForm(null, '新建任务', false); return Promise.resolve(); });
    bindClickBusy(document.getElementById('tAddFs'), function(){ openAddForm(null, '新建任务', false); return Promise.resolve(); });
    // 抽屉切换
    bindClickBusy(document.getElementById('drawerToggle'), function(){
      toggleTodoDrawer(_todoGetRows, drawTree);
      return Promise.resolve();
    });
    bindClickBusy(document.getElementById('drawerClose'), function(){
      _todoDrawerOpen = false;
      try { localStorage.setItem('todoDrawer', '0'); } catch(e){}
      applyTodoView(_todoGetRows, drawTree);
      return Promise.resolve();
    });
    document.getElementById('todoDrawerMask').addEventListener('click', function(){
      _todoDrawerOpen = false;
      try { localStorage.setItem('todoDrawer', '0'); } catch(e){}
      applyTodoView(_todoGetRows, drawTree);
    });
    window.addEventListener('resize', function(){ if (_todoView !== 'default') applyTodoView(_todoGetRows, drawTree); });
    // 首次应用视图状态(会触发 drawTree)
    applyTodoView(_todoGetRows, drawTree);
    // hideDone / 时间筛选 tab: 与登录态同结构
    var _hb = document.getElementById('hideDone');
    if (_hb) _hb.addEventListener('change', drawTree);
    var _tf = document.getElementById('todoFilter');
    if (_tf) _tf.addEventListener('click', function(e){
      var btn = e.target.closest('button[data-filter]');
      if (!btn) return;
      _filter = btn.getAttribute('data-filter');
      Array.prototype.forEach.call(this.querySelectorAll('button'), function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      // 已完成计数按 filter × range 双维度联动
      document.getElementById('stDone').textContent = todoDoneByFilter(_rows, _filter, _today, _curRange);
      updateStatsHint(_filter, _curRange);
      // 图表下拉框联动: today→7d, 其它→month
      syncChartRangeToFilter(_filter);
      drawTree();
    });
    bindTodoRange(function(r){
      _curRange = r;
      document.getElementById('stDone').textContent = todoDoneByFilter(_rows, _filter, _today, _curRange);
      updateStatsHint(_filter, _curRange);
      loadChart();
    });
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
var _curRange = 'month';
// 汇总协作页时间筛选: 默认 'cur' (今日+逾期, 与日报口径一致); 其它取值与登录态一致
var _filter = 'cur';

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
    // 应用视图状态; onDrawTree 仅重绘可见树, 不重新 loadCollab(避免死循环)
    // 这个 fn 也会被 viewToggleFs/exitFullscreen 等按钮的幂等绑定捕获, 必须能触发实际重绘
    applyTodoView(_todoGetRows, function(){ drawTree(visibleTrees()); });
  } catch(e) { showMsg(msg, e.message || '链接无效', false); }
}
// 可见树: 按 _filter 过滤顶层任务(子任务随顶层)
//   cur     = 今日到期 + 已逾期(默认, 与日报口径一致)
//   all     = 全部顶层
//   today/overdue/future/memo/done = 与登录态 TODO_JS 一致
function visibleTrees() {
  var t = _today;
  var trees = todoBuildTree(_rows);
  if (_filter === 'cur')     return trees.filter(function(n){ return n.due_date && t && n.due_date <= t; });
  if (_filter === 'today')   return trees.filter(function(n){ return n.due_date && n.due_date === t; });
  if (_filter === 'overdue') return trees.filter(function(n){ return n.due_date && n.due_date < t; });
  if (_filter === 'future')  return trees.filter(function(n){ return n.due_date && n.due_date > t; });
  if (_filter === 'memo')    return trees.filter(function(n){ return !n.due_date; });
  if (_filter === 'done')    return trees.filter(function(n){ return n.done; });
  return trees;
}
// 统计（口径同日报 statsOfReport）：基于可见树，子任务继承顶层截止日期判逾期
// 已完成一栏按 _filter 联动: cur→今日+逾期完成, today→今日, overdue/future/memo→各自类别, all/done→当月
function renderStats(trees) {
  var pending = 0, overdue = 0;
  function walk(node, rootDue){
    if (node.children.length > 0) {
      // 有子任务：父不计入，仅递归统计子任务（叶子口径，与后端 countStats 一致）
      node.children.forEach(function(c){ walk(c, rootDue); });
      return;
    }
    if (!node.done) {
      pending++;
      if (rootDue && _today && rootDue < _today) overdue++;
    }
  }
  trees.forEach(function(root){ walk(root, root.due_date); });
  document.getElementById('stPending').textContent = pending;
  document.getElementById('stOverdue').textContent = overdue;
  document.getElementById('stDone').textContent = todoDoneByFilter(_rows, _filter, _today, _curRange);
  updateStatsHint(_filter, _curRange);
}
async function loadChart() {
  try { var c = await api('/api/public/todo-chart/' + _token + '?range=' + _curRange); drawTodoChart('todoChart', c.series); }
  catch(e){ /* 图表失败不阻断 */ }
}
function _todoGetRows() { return _rows; }
function drawTree(trees) {
  // 全屏态下按抽屉选中的分类过滤扁平 rows 重新建可见树(遵从 _filter)
  var effectiveTrees = trees;
  if (_todoView !== 'default' && _todoCategory != null && _todoCategory !== '__all__') {
    var t = _today;
    var byCat = todoBuildTree(todoRowsByCategory(_rows));
    effectiveTrees = byCat.filter(function(n){
      if (_filter === 'cur')     return n.due_date && t && n.due_date <= t;
      if (_filter === 'today')   return n.due_date && n.due_date === t;
      if (_filter === 'overdue') return n.due_date && n.due_date < t;
      if (_filter === 'future')  return n.due_date && n.due_date > t;
      if (_filter === 'memo')    return !n.due_date;
      if (_filter === 'done')    return n.done;
      return true;
    });
  }
  // 已完成 tab 强制显示, 其它遵从复选框
  var hideBox = document.getElementById('hideDone');
  var hideDone = (_filter === 'done') ? false : (hideBox ? hideBox.checked : false);
  todoRenderView(document.getElementById('todoTree'), effectiveTrees, {
    view: _todoView === 'default' ? 'card' : _todoView,
    detailRootId: _todoDetailRootId,
    crumbEl: document.getElementById('todoCrumb'),
    today: _today, hideDone: hideDone,
    onExitDetail: function(){ _todoDetailRootId = null; loadCollab(); },
    onEnter: function(node){ _todoDetailRootId = node.id; loadCollab(); },
    onToggleRecur: function(node){
      var dueDate = node.due_date || _today;
      var defaultNext = shiftDateLocal(dueDate, node.recurrence, false, _today, node.recur_interval, node.recur_nth, node.recur_weekday);
      var jumpNext = shiftDateLocal(dueDate, node.recurrence, true, _today, node.recur_interval, node.recur_nth, node.recur_weekday);
      var sameDate = defaultNext === jumpNext;
      var html =
        '<p style="margin:6px 0;">📝 ' + esc(node.title) + '（' + todoRecurLabel(node.recurrence, node.recur_interval, node.recur_nth, node.recur_weekday) + '）</p>' +
        '<p class="muted" style="margin:4px 0 14px;">本次截止：' + esc(todoDateLabel(dueDate, _today)) + ' <span style="color:#b0b6c8;">(' + dueDate + ')</span></p>' +
        '<p style="margin:6px 0;">完成后自动生成下一条任务，日期：</p>' +
        '<label style="display:block;padding:8px 4px;"><input type="radio" name="rjump" value="0" checked style="width:auto;margin-right:8px;"> ' + todoDateLabel(defaultNext, _today) + ' <span style="color:#b0b6c8;font-size:12px;">(' + defaultNext + ')</span>（下一周期，默认）</label>' +
        (sameDate ? '' :
          '<label style="display:block;padding:8px 4px;"><input type="radio" name="rjump" value="1" style="width:auto;margin-right:8px;"> ' + todoDateLabel(jumpNext, _today) + ' <span style="color:#b0b6c8;font-size:12px;">(' + jumpNext + ')</span>（跳到当前周期）</label>') +
        '<div style="text-align:right;margin-top:14px;"><button type="button" class="btn gray" onclick="closeModal()">取消</button> <button type="button" class="btn" id="rrConfirm">完成并生成</button></div>';
      openModal('✅ 完成重复任务', html);
      bindClickBusy(document.getElementById('rrConfirm'), async function(){
        var jr = document.querySelector('input[name="rjump"]:checked');
        var jumpToCurrent = !!(jr && jr.value === '1');
        // 汇总协作页仍走 public API, 但可传 jumpToCurrent(后端会忽略并强制 false)
        await api('/api/public/todo-all/' + _token + '/' + node.id + '/done', { method:'PUT', body:{ done: true, jumpToCurrent: jumpToCurrent } });
        closeModal();
        await loadCollab();
      });
    },
    onToggle: async function(node, done){
      try {
        await api('/api/public/todo-all/' + _token + '/' + node.id + '/done', { method:'PUT', body:{ done: done } });
        await loadCollab();
        if (done) {
          var total = 0, doneCnt = 0;
          (function count(list){ list.forEach(function(n){
            if (n.children.length > 0) { count(n.children); return; }
            total++; if (n.done) doneCnt++;
          }); })(visibleTrees());
          todoCelebrate(total - doneCnt, total);
        }
      }
      catch(e){ alertModal(e.message, {ok:false}); }
    },
    onEdit: function(node){
      var isChild = node.parent_id != null;
      openModal('编辑任务', todoFormHtml(node, false, isChild) +
        '<div style="margin-top:12px;"><button class="btn" id="tfSave">保存</button> <button class="btn gray" onclick="closeModal()">取消</button></div>');
      todoFillCategoryOptions(_rows, node.category || '');
      bindClickBusy(document.getElementById('tfSave'), async function(){
        var body = todoFormRead();
        if (!body.title) { alertModal('请填写标题', {ok:false}); return; }
        await api('/api/public/todo-all/' + _token + '/' + node.id, { method:'PUT', body: body });
        closeModal(); await loadCollab();
      });
    },
    onAddChild: function(node){ openAddForm(node.id, '为「' + node.title + '」添加子任务', true); },
    onReorder: async function(parentId, ids){
      try { await api('/api/public/todo-all/' + _token + '/reorder', { method:'PUT', body:{ parent_id: parentId, ids: ids } }); await loadCollab(); }
      catch(e){ alertModal(e.message, {ok:false}); await loadCollab(); }
    }
  });
}
function openAddForm(parentId, title, isChild) {
  openModal(title, todoFormHtml({}, true, !!isChild) +
    '<div style="margin-top:12px;"><button class="btn" id="tfCreate">添加</button> <button class="btn gray" onclick="closeModal()">取消</button></div>');
  var pref = (_todoCategory && _todoCategory !== '__none__' && _todoCategory !== '__all__') ? _todoCategory : '';
  todoFillCategoryOptions(_rows, pref);
  bindClickBusy(document.getElementById('tfCreate'), async function(){
    var body = todoFormRead();
    if (!body.title) { alertModal('请填写标题', {ok:false}); return; }
    if (parentId != null) body.parent_id = parentId;
    await api('/api/public/todo-all/' + _token, { method:'POST', body: body });
    closeModal(); await loadCollab();
  });
}
bindClickBusy(document.getElementById('tAddRoot'), function(){ openAddForm(null, '新建任务', false); return Promise.resolve(); });
bindClickBusy(document.getElementById('tAddFs'), function(){ openAddForm(null, '新建任务', false); return Promise.resolve(); });
// 视图三态循环
bindClickBusy(document.getElementById('viewToggle'), function(){
  enterTodoFullscreen(_todoGetRows, function(){ loadCollab(); });
  return Promise.resolve();
});
// 抽屉切换
bindClickBusy(document.getElementById('drawerToggle'), function(){
  toggleTodoDrawer(_todoGetRows, function(){ loadCollab(); });
  return Promise.resolve();
});
bindClickBusy(document.getElementById('drawerClose'), function(){
  _todoDrawerOpen = false;
  try { localStorage.setItem('todoDrawer', '0'); } catch(e){}
  applyTodoView(_todoGetRows, function(){ loadCollab(); });
  return Promise.resolve();
});
document.getElementById('todoDrawerMask').addEventListener('click', function(){
  _todoDrawerOpen = false;
  try { localStorage.setItem('todoDrawer', '0'); } catch(e){}
  applyTodoView(_todoGetRows, function(){ loadCollab(); });
});
window.addEventListener('resize', function(){ if (_todoView !== 'default') applyTodoView(_todoGetRows, function(){ loadCollab(); }); });
// hideDone / 时间筛选 tab: 与登录态 TODO_JS 一致, 变化时仅重绘可见树, 不重拉数据
var _hb = document.getElementById('hideDone');
if (_hb) _hb.addEventListener('change', function(){ drawTree(visibleTrees()); });
var _tf = document.getElementById('todoFilter');
if (_tf) _tf.addEventListener('click', function(e){
  var btn = e.target.closest('button[data-filter]');
  if (!btn) return;
  _filter = btn.getAttribute('data-filter');
  Array.prototype.forEach.call(this.querySelectorAll('button'), function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  // 已完成计数按 filter × range 双维度联动
  document.getElementById('stDone').textContent = todoDoneByFilter(_rows, _filter, _today, _curRange);
  updateStatsHint(_filter, _curRange);
  syncChartRangeToFilter(_filter);
  drawTree(visibleTrees());
});
loadCollab();
`;

export {
  COMMON_JS, LOGIN_JS, DASHBOARD_JS, ADMIN_JS, SETUP_JS, MONITOR_JS, FUND_JS,
  PUBLIC_BUY_JS, WEIGHT_JS, PUBLIC_WEIGHT_JS, SETTINGS_JS, ASSET_JS, PUBLIC_ASSET_JS, CHANNELS_JS,
  WEIGHT_REPORT_JS, ASSET_REPORT_JS, FUND_REPORT_JS,
  TODO_JS, PUBLIC_TODO_JS, TODO_REPORT_JS, TODO_COLLAB_JS
};
