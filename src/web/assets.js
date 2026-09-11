/**
 * 前端通用 JS 片段（作为字符串注入页面）
 */

// 通用 API 请求与工具函数（所有页面共用）
const COMMON_JS = `
// ============ 全局软键盘避让 ============
// App WebView / 手机浏览器里, 任意输入框聚焦时弹窗与输入框都不被软键盘遮挡。
// 键盘高度(CSS px)双来源取大: App 原生 WindowInsets.ime 实测注入的 --kb-native(该 App WebView 的
// visualViewport 不反映键盘, 为可靠来源) 与 visualViewport 计算值(手机浏览器/桌面回退)。
//  - 写入 CSS 变量 --kb-inset: 供 .modal-mask / body / .todo-fs-main 底部留白(见 layout.js)。
//  - 弹窗遮罩键盘弹出时加 .kb-on: modal-box 由垂直居中改靠顶部对齐, 键盘盖住弹窗下半部, 再把
//    "当前聚焦框"滚到键盘上方——键盘只贴在当前输入框下面, 不挪动其它输入框。
// 原生注入 --kb-native 后会调 window.__onKb 驱动(visualViewport 不反映键盘时靠它)。
(function(){
  function curKb(){
    var vv = window.visualViewport;
    var vvKb = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
    var nativeKb = 0;
    try { nativeKb = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kb-native')) || 0; } catch(e){}
    return Math.max(nativeKb, vvKb);
  }
  function liftFocused(){
    var el = document.activeElement;
    if (!el) return;
    var tag = (el.tagName || '').toLowerCase();
    if (tag !== 'input' && tag !== 'textarea' && !el.isContentEditable) return;
    var kb = curKb();
    var r = el.getBoundingClientRect();
    var bottom = window.innerHeight - kb; // 键盘上方可视底边(布局坐标)
    var delta = r.bottom - bottom + 16; // + 16px 余量
    if (delta <= 0) return;
    for (var p = el.parentElement; p; p = p.parentElement) {
      var s = getComputedStyle(p);
      if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && p.scrollHeight > p.clientHeight) {
        p.scrollTop += delta; return;
      }
    }
    window.scrollBy(0, delta);
  }
  function syncKb(){
    var kb = curKb();
    document.documentElement.style.setProperty('--kb-inset', kb + 'px');
    // 键盘弹出时给打开的弹窗遮罩加 .kb-on(靠顶对齐, 见 layout.js); 不做遮罩几何压缩以免弹窗被顶起重排
    var masks = document.querySelectorAll('.modal-mask');
    Array.prototype.forEach.call(masks, function(mask){
      mask.classList.toggle('kb-on', kb > 80 && mask.classList.contains('show'));
    });
  }
  // 键盘变化/聚焦统一入口: 更新变量与 .kb-on, 等两帧(底部 padding 完成重新布局、可滚动高度增加)
  // 再把当前聚焦框滚到键盘上方; 同步滚会因留白未生效而滚不动。
  function onKbChange(){
    syncKb();
    requestAnimationFrame(function(){ requestAnimationFrame(liftFocused); });
  }
  window.__onKb = onKbChange; // 原生 App 注入 --kb-native 后调用(见 MainActivity)
  document.addEventListener('focusin', function(){ setTimeout(onKbChange, 300); });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onKbChange);
    window.visualViewport.addEventListener('scroll', onKbChange);
  }
  window.addEventListener('resize', onKbChange);
  syncKb();
})();
// ============ 现代化日期选择器(渐进增强, 自动接管全站 input[type=date]) ============
// 日视图: 今天/明天/下周今天快捷胶囊 + 日历网格; 点标题"2026年9月"进月视图(12 月快选),
// 再点"2026年"进年视图(12 年快选), 逐级快速跳年月; ‹ › 日视图翻月、月视图翻年、年视图翻 12 年。
// 尊重 input 的 min/max; 选中写回 input.value(YYYY-MM-DD) 并触发 input/change, 现有表单零改动。
// 事件委托挂 document, modal 动态注入的日期框也接管; 日期框置只读, 点选不弹软键盘。
(function(){
  var WD = ['日','一','二','三','四','五','六'];
  var MO = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  function bjToday(){ var d = new Date(Date.now() + 8*3600*1000); return d.toISOString().slice(0,10); }
  function parse(s){ if(!s) return null; var m = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(s); return m ? {y:+m[1], mo:+m[2], d:+m[3]} : null; }
  function fmt(y,mo,d){ return y + '-' + (mo<10?'0':'') + mo + '-' + (d<10?'0':'') + d; }
  function pStr(p){ return fmt(p.y,p.mo,p.d); }
  function addDays(s,n){ var p=parse(s); return new Date(Date.UTC(p.y,p.mo-1,p.d)+n*86400000).toISOString().slice(0,10); }
  function wdOf(s){ var p=parse(s); return WD[new Date(Date.UTC(p.y,p.mo-1,p.d)).getUTCDay()]; }
  var pop=null, cur=null, vY=0, vMo=0, view='day';
  function close(){ if(pop){ pop.remove(); pop=null; cur=null; } }
  function disabled(ds, input){
    var mn=parse(input.min), mx=parse(input.max);
    return (mn && ds < pStr(mn)) || (mx && ds > pStr(mx));
  }
  function position(){
    if(!pop||!cur) return;
    var r = cur.getBoundingClientRect();
    var pw = pop.offsetWidth || 300, ph = pop.offsetHeight || 320;
    var left = Math.min(Math.max(8, r.left), window.innerWidth - pw - 8);
    var top = (r.bottom + 6 + ph <= window.innerHeight) ? r.bottom + 6 : Math.max(8, r.top - ph - 6);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
  }
  function navBar(title, goto){
    return '<div class="dp-nav"><button type="button" class="dp-navb" data-dir="-1">‹</button>' +
      '<span class="dp-ym"' + (goto ? ' data-goto="'+goto+'"' : '') + '>'+title+'</span>' +
      '<button type="button" class="dp-navb" data-dir="1">›</button></div>';
  }
  function renderDay(today, sel){
    var quick = [['今天', today], ['明天', addDays(today,1)], ['下周今天', addDays(today,7)]];
    var chips = quick.map(function(q){
      var p = parse(q[1]), dis = disabled(q[1], cur);
      return '<button type="button" class="dp-chip' + (sel&&pStr(sel)===q[1]?' active':'') + (dis?' dis':'') + '" data-d="'+q[1]+'"'+(dis?' disabled':'')+'>' +
        '<span>'+q[0]+'</span><small>'+p.mo+'/'+p.d+' 周'+wdOf(q[1])+'</small></button>';
    }).join('');
    var firstWd = new Date(Date.UTC(vY, vMo-1, 1)).getUTCDay();
    var daysIn = new Date(Date.UTC(vY, vMo, 0)).getUTCDate();
    var prevDays = new Date(Date.UTC(vY, vMo-1, 0)).getUTCDate();
    var cells = '';
    for(var i=firstWd-1;i>=0;i--) cells += '<span class="dp-cell mute">'+(prevDays-i)+'</span>';
    for(var d=1;d<=daysIn;d++){
      var ds = fmt(vY,vMo,d), dis = disabled(ds,cur);
      var cls = 'dp-cell';
      if (ds===today) cls += ' today';
      if (sel && pStr(sel)===ds) cls += ' sel';
      if (dis) cls += ' dis';
      cells += '<button type="button" class="'+cls+'" data-d="'+ds+'"'+(dis?' disabled':'')+'>'+d+'</button>';
    }
    return '<div class="dp-quick">'+chips+'</div>' +
      navBar(vY+'年'+vMo+'月', 'month') +
      '<div class="dp-wd">'+WD.map(function(w){return '<span>'+w+'</span>';}).join('')+'</div>' +
      '<div class="dp-grid">'+cells+'</div>';
  }
  function renderMonth(today){
    var tp = parse(today);
    var cells = MO.map(function(m,i){
      var mo=i+1, cls='dp-cell dp-cell--mon';
      if (tp && tp.y===vY && tp.mo===mo) cls += ' today';
      return '<button type="button" class="'+cls+'" data-mo="'+mo+'">'+m+'</button>';
    }).join('');
    return navBar(vY+'年', 'year') + '<div class="dp-grid dp-grid--mon">'+cells+'</div>';
  }
  function renderYear(today){
    var tp = parse(today);
    var start = Math.floor(vY/12)*12, cells = '';
    for(var i=0;i<12;i++){
      var y=start+i, cls='dp-cell dp-cell--mon';
      if (tp && tp.y===y) cls += ' today';
      if (vY===y) cls += ' sel';
      cells += '<button type="button" class="'+cls+'" data-yr="'+y+'">'+y+'</button>';
    }
    return navBar(start+'-'+(start+11), null) + '<div class="dp-grid dp-grid--mon">'+cells+'</div>';
  }
  function render(){
    if(!pop||!cur) return;
    var today = bjToday(), sel = parse(cur.value);
    pop.innerHTML = view==='month' ? renderMonth(today) : view==='year' ? renderYear(today) : renderDay(today, sel);
    position();
  }
  function open(input){
    cur = input;
    input.readOnly = true;
    var base = parse(input.value) || parse(bjToday());
    vY = base.y; vMo = base.mo; view = 'day';
    if (!pop){
      pop = document.createElement('div');
      pop.className = 'dp-pop';
      document.body.appendChild(pop);
      pop.addEventListener('click', function(e){
        var el = e.target;
        function q(s){ return el.closest ? el.closest(s) : null; }
        var day=q('[data-d]'), mo=q('[data-mo]'), yr=q('[data-yr]'), goto=q('[data-goto]'), nav=q('.dp-navb');
        if (day){ choose(day.getAttribute('data-d')); return; }
        if (mo){ vMo = parseInt(mo.getAttribute('data-mo'),10); view='day'; render(); return; }
        if (yr){ vY = parseInt(yr.getAttribute('data-yr'),10); view='month'; render(); return; }
        if (goto){ view = goto.getAttribute('data-goto'); render(); return; }
        if (nav){
          var dir = parseInt(nav.getAttribute('data-dir'),10);
          if (view==='day'){ vMo += dir; if(vMo<1){vMo=12;vY--;} if(vMo>12){vMo=1;vY++;} }
          else if (view==='month'){ vY += dir; }
          else { vY += dir*12; }
          render();
        }
      });
    }
    pop.style.display = 'block';
    render();
  }
  function choose(ds){
    if(!cur) return;
    cur.value = ds;
    cur.dispatchEvent(new Event('input',{bubbles:true}));
    cur.dispatchEvent(new Event('change',{bubbles:true}));
    close();
  }
  function isDate(t){ return t && t.tagName==='INPUT' && t.type==='date'; }
  document.addEventListener('pointerdown', function(e){
    var t = e.target;
    if (isDate(t)){ e.preventDefault(); open(t); return; }
    if (pop && !(t.closest && t.closest('.dp-pop'))) close();
  }, true);
  document.addEventListener('keydown', function(e){
    var t = e.target;
    if (isDate(t) && (e.key==='Enter' || e.key===' ')){ e.preventDefault(); open(t); }
    if (e.key==='Escape') close();
  }, true);
  window.addEventListener('scroll', function(){ close(); }, true);
  window.addEventListener('resize', function(){ close(); });
})();
// ============ 统一 SVG 图标(24x24, stroke: currentColor, 与 topbar 风格一致) ============
// 移动端 emoji 在浅底色行上易被吞噬(尤其 ✏️/🔗/🗑️), 全部换成矢量描边图标; 颜色由 .todo-op 决定
var ICONS = {
  plus:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  edit:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  view:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  paperclip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.4 11.05-9.2 9.2a5.5 5.5 0 0 1-7.78-7.78l9.2-9.2a3.67 3.67 0 0 1 5.19 5.19l-9.2 9.2a1.83 1.83 0 0 1-2.6-2.6l8.5-8.48"/></svg>',
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
// ============ 全局 loading: 双环 + 磨砂 + 慢请求兜底进度条 ============
// 生命周期覆盖: "点击 → 浏览器导航 → 新页面 HTML 到达 → 页面 JS 执行 → 首屏 api 完成"
// 关键设计: layout.js 里 #globalLoading 默认 display:flex → 新页面 HTML 一到就 paint 遮罩,
// 早于任何 JS 执行. COMMON_JS 初始化时把 _loadingCount 顶到 1, _loadingShown = true,
// 让 JS 状态与 HTML 视觉一致, 后续任何 showLoading()/hideLoading() 自然接管. DOM ready 后
// 800ms 若首屏 api 未起来 → 兜底 hide, 静态页面不会永远转圈.
// 分层展示 (四层防闪, 目标: 快请求无感 / 中速请求平滑 / 慢请求有反馈):
//   0-300ms       什么都不显示 → 快请求无感 (LOADING_SHOW_DELAY, 仅对"页面内 api"生效)
//   显示后 <400ms  即使 api 已完成也不隐藏, 保底停留 → 杜绝"闪一下"      (LOADING_MIN_VISIBLE)
//   count 归 0 后  再等 120ms 才真正 hide, 期间新请求可复用 → 串行 api 合并 (LOADING_HIDE_DELAY)
//   ≥3s          底部进度条出现 (从 showLoading 起算)                (LOADING_BAR_DELAY)
// 不显示数字: 前端不知道后端真实进度; 进度条只在 3s 后作为"再等等"的强反馈出现.
var _loadingCount = 1;         // ★ 从 1 起步, 承接 layout.js 默认可见的遮罩
var _bootCountAlive = true;    // ★ 启动 count 是否还没被消化 (首个 api 起来时消化, 消除"数据到了遮罩不关"的 gap)
var _loadingShowTimer = null;  // 显示延迟定时器
var _loadingHideTimer = null;  // 熄灯延迟定时器 (可被新 showLoading 打断)
var _loadingBarTimer = null;   // 3s 兜底进度条出现定时器
var _loadingShown = true;      // ★ 与 HTML 默认 display:flex 对齐
var _loadingShownAt = Date.now(); // ★ 视为 JS 加载时刻已 paint
var _loadingBarShown = false;  // 兜底进度条当前是否显示
var _loadingBarRAF = null;     // 进度条 rAF 句柄
var _loadingLastText = '加载中…'; // 最新 loadingText, 遮罩出现时应用
var LOADING_SHOW_DELAY = 300;  // 遮罩延迟出现阈值 (< 此值的请求完全无感)
var LOADING_MIN_VISIBLE = 400; // 遮罩最小停留时长 (paint 之后至少停这么久才允许 hide)
var LOADING_HIDE_DELAY = 120;  // count 归 0 后的熄灯延迟 (串行 api 合并窗口)
var LOADING_BAR_DELAY = 3000;  // 进度条延迟出现阈值 (从 showLoading 起算, ≥ 此值才显示)
var LOADING_BOOT_FALLBACK = 300; // ★ DOM ready 后多久若无 api 起来则自动 hide 启动 count

function showLoading(text) {
  // ★ 首个 api 起来: 立即消化启动 count, 让"数据到 → 遮罩关"的路径只由这次 api 决定, 不用等 300ms 兜底
  if (_bootCountAlive) { _bootCountAlive = false; _loadingCount = Math.max(0, _loadingCount - 1); }
  _loadingCount++;
  _loadingLastText = text || '加载中…';
  // 有正在排队的熄灯定时器 → 取消, 复用当前显示状态 (合并串行 api)
  if (_loadingHideTimer) { clearTimeout(_loadingHideTimer); _loadingHideTimer = null; }
  // 已经在显示: 只更新文案
  if (_loadingShown) { setLoadingText(_loadingLastText); return; }
  // 已经排了显示定时器: 只更新文案, 等阈值后一并显示
  if (_loadingShowTimer) return;
  // 首次进入, 起延迟定时器. 阈值内被 hideLoading 会 clearTimeout —— 完全无感
  _loadingShowTimer = setTimeout(function(){
    _loadingShowTimer = null;
    if (_loadingCount === 0) return;   // 已经完成, 不显示
    _showLoadingNow();
  }, LOADING_SHOW_DELAY);
  // 兜底进度条: 从 showLoading 起 3s 后仍未完成 → 进度条出现开始爬升
  _loadingBarTimer = setTimeout(function(){
    _loadingBarTimer = null;
    if (_loadingCount === 0) return;
    _showLoadingBarNow();
  }, LOADING_BAR_DELAY);
}
function _showLoadingNow() {
  var el = document.getElementById('globalLoading');
  if (!el) return;
  el.classList.remove('boot-visible');   // 主动显示 → 移除 CSS 延迟规则, 立即可见
  el.style.opacity = '';                 // 清可能被 animation 留下的 opacity
  el.style.display = 'flex';
  _loadingShown = true;
  _loadingShownAt = Date.now();   // 记录 paint 时刻, hideLoading 用它算最小停留
  setLoadingText(_loadingLastText);
  lockBodyScroll();               // 只在真正显示时才锁滚动
}
function _showLoadingBarNow() {
  var bar = document.getElementById('loadingBar');
  if (!bar) return;
  bar.style.display = 'block';
  _setLoadingBar(0);
  // 让浏览器先应用 display:block, 再切 .show 触发 opacity 过渡 (避免同帧内 fade-in 失效)
  requestAnimationFrame(function(){ bar.classList.add('show'); });
  _loadingBarShown = true;
  _startLoadingBar();
}
function hideLoading() {
  _loadingCount = Math.max(0, _loadingCount - 1);
  if (_loadingCount > 0) return;
  // count 归 0 → 无论遮罩最终会不会显示, 启动阶段的 CSS 锁都可以释放了
  document.body.classList.remove('booting');
  // 300ms 窗口内完成 → 遮罩定时器取消, 遮罩从未显示 ✅ 用户无感
  if (_loadingShowTimer) { clearTimeout(_loadingShowTimer); _loadingShowTimer = null; }
  // 3s 窗口内完成 → 进度条定时器取消, 进度条从未显示
  if (_loadingBarTimer) { clearTimeout(_loadingBarTimer); _loadingBarTimer = null; }
  // 已经显示 → 走"最小停留 + 熄灯延迟"两段式关闭, 避免闪 & 合并串行 api
  if (_loadingShown) {
    var el0 = document.getElementById('globalLoading');
    var isBoot = el0 && el0.classList.contains('boot-visible');
    // 启动阶段(遮罩靠 CSS 300ms 才 fade in): 若数据在 300ms 内到, opacity 还是 0, 用户根本没看见 → 立即隐藏, 无 gap.
    // 判断依据: 从 _loadingShownAt (JS 启动时刻) 起算, HTML 到 JS 通常 <100ms, 加 CSS delay 300ms → JS 起算未到 300ms 就是 opacity=0
    var elapsedFromBoot = Date.now() - _loadingShownAt;
    if (isBoot && elapsedFromBoot < 300) {
      // 快路径: 遮罩其实还没可见, 立即拆除, 用户体验就是"点进来就有数据, 无 loading"
      if (el0) { el0.classList.remove('boot-visible'); el0.style.opacity = ''; el0.style.display = 'none'; }
      _loadingShown = false;
      _loadingShownAt = 0;
      return;
    }
    var elapsed = Date.now() - _loadingShownAt;
    // 启动阶段(boot-visible 还挂着): 遮罩已 fade in 可见, 但不做 400ms 最小停留(CSS 已保证不闪), 只留 120ms 熄灯延迟
    var remainMin = isBoot ? 0 : Math.max(0, LOADING_MIN_VISIBLE - elapsed);
    var wait = remainMin + LOADING_HIDE_DELAY;                    // 再多等一小段, 让下一个 api 有机会合并
    if (_loadingHideTimer) clearTimeout(_loadingHideTimer);
    _loadingHideTimer = setTimeout(function(){
      _loadingHideTimer = null;
      if (_loadingCount > 0) return;                              // 期间又有新请求 → 保持显示
      var el = document.getElementById('globalLoading');
      if (el) { el.classList.remove('boot-visible'); el.style.opacity = ''; el.style.display = 'none'; }
      _loadingShown = false;
      _loadingShownAt = 0;
      document.body.classList.remove('booting');   // ★ 启动阶段的 CSS 锁一并解除 (未走过 lockBodyScroll 也能正确解锁)
      unlockBodyScroll();
      // 进度条同步隐藏并复位
      if (_loadingBarShown) {
        _stopLoadingBar();
        var bar = document.getElementById('loadingBar');
        if (bar) { bar.classList.remove('show'); bar.style.display = 'none'; }
        _setLoadingBar(0);
        _loadingBarShown = false;
      }
    }, wait);
    return;
  }
  // 遮罩从未显示: 进度条兜底状态也一并清理 (通常已在 _loadingBarTimer 分支清理, 保险起见)
  if (_loadingBarShown) {
    _stopLoadingBar();
    var bar2 = document.getElementById('loadingBar');
    if (bar2) { bar2.classList.remove('show'); bar2.style.display = 'none'; }
    _setLoadingBar(0);
    _loadingBarShown = false;
  }
}
// 兼容层: 保留 setLoadingProgress / resetLoadingProgress 让旧调用点不报错, 内部无操作.
function setLoadingProgress(_target) { /* no-op */ }
function resetLoadingProgress() { /* no-op */ }
function setLoadingText(text) {
  var t = document.getElementById('loadingText');
  if (t) t.textContent = text || '加载中…';
}
// 进度条控制: rAF (而非 setInterval) 减少主线程压力, 手机也不卡.
// 从 0% 匀速爬到 90%, easeOutQuad 让越接近 90% 越慢, 符合"就快好了"直觉; 停在 90% 等待 fetch 完成.
function _setLoadingBar(pct) {
  var el = document.querySelector('#globalLoading .lb-fill');
  if (el) el.style.width = Math.max(0, Math.min(100, pct)) + '%';
}
function _startLoadingBar() {
  _stopLoadingBar();
  var start = performance.now(), from = 0, to = 90, dur = 8000;
  function tick(now) {
    if (!_loadingBarShown) { _loadingBarRAF = null; return; }
    var t = Math.min(1, (now - start) / dur);
    var eased = 1 - (1 - t) * (1 - t);              // easeOutQuad
    _setLoadingBar(from + (to - from) * eased);
    if (t < 1) _loadingBarRAF = requestAnimationFrame(tick);
    else _loadingBarRAF = null;                     // 到 90% 停住, 等 hideLoading 直接消失
  }
  _loadingBarRAF = requestAnimationFrame(tick);
}
function _stopLoadingBar() {
  if (_loadingBarRAF) { cancelAnimationFrame(_loadingBarRAF); _loadingBarRAF = null; }
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
// 页面跳转 loading: 延迟 LOADING_NAV_DELAY(150ms) 后显示遮罩, 供菜单点击 / location.href 场景使用.
// 快导航(缓存命中 / 边缘节点极快)会在 150ms 内被新页面覆盖 → 旧 timer 随旧 JS 环境一起销毁, 遮罩从未 paint → 无闪.
// 慢导航 → 150ms 后遮罩正常出现, 让用户看到"确实在动"; 3s 仍未完成时兜底进度条也出现.
var LOADING_NAV_DELAY = 150;
function _showLoadingImmediate(text) {
  // ★ 首个动作是导航: 消化启动 count, 语义交接给这次导航
  if (_bootCountAlive) { _bootCountAlive = false; _loadingCount = Math.max(0, _loadingCount - 1); }
  _loadingCount++;
  _loadingLastText = text || '正在打开页面…';
  // 熄灯排队中 → 取消, 沿用当前显示
  if (_loadingHideTimer) { clearTimeout(_loadingHideTimer); _loadingHideTimer = null; }
  if (_loadingShown) { setLoadingText(_loadingLastText); return; }
  // 已排了延迟定时器: 只更新文案, 沿用它
  if (_loadingShowTimer) return;
  _loadingShowTimer = setTimeout(function(){
    _loadingShowTimer = null;
    if (_loadingCount === 0) return;
    _showLoadingNow();
  }, LOADING_NAV_DELAY);
  // 兜底进度条仍按 3s 计时 (导航 3s 内完成不显示条, 慢导航才出现)
  if (!_loadingBarTimer && !_loadingBarShown) {
    _loadingBarTimer = setTimeout(function(){
      _loadingBarTimer = null;
      if (_loadingCount === 0) return;
      _showLoadingBarNow();
    }, LOADING_BAR_DELAY);
  }
}
// 统一封装的页面跳转: 立即显示 loading → 触发 location.href.
// 相比裸 location.href, 用户在点击后立刻看到反馈, 不用干等到新页面渲染.
function navTo(url, text) {
  _showLoadingImmediate(text || '正在打开页面…');
  location.href = url;
}
// 全局 <a> 点击拦截: 同源内部路径导航立即触发 loading.
// 排除: 外链 / 锚点 / target=_blank / 修饰键(新窗口/新标签) / download 属性 / javascript: 协议
document.addEventListener('click', function(e){
  // 允许其他 listener 已经 preventDefault (如自定义 SPA 逻辑)
  if (e.defaultPrevented) return;
  // 修饰键: 用户主动新窗口打开时不该显示当前页的 loading
  if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button === 1) return;
  var a = e.target && e.target.closest && e.target.closest('a[href]');
  if (!a) return;
  var href = a.getAttribute('href');
  if (!href || href.charAt(0) === '#') return;
  if (a.hasAttribute('download')) return;
  if (a.target && a.target !== '' && a.target !== '_self') return;
  // 只处理相对路径 或 同源绝对路径
  var isRelative = href.charAt(0) === '/' && href.charAt(1) !== '/';
  var isSameOrigin = false;
  if (!isRelative) {
    try {
      var u = new URL(href, location.href);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return;   // 排除 mailto: / tel: / javascript:
      isSameOrigin = u.origin === location.origin;
    } catch (err) { return; }
  }
  if (!isRelative && !isSameOrigin) return;
  _showLoadingImmediate('正在打开页面…');
});
// ===== 启动阶段的 loading 生命周期 =====
// 静态页面兜底: 若 DOM ready 后 LOADING_BOOT_FALLBACK 内既没首屏 api 也没导航追加 count,
// 判定为"页面 JS 已就绪且无首屏 api", 自动 hide 启动那次 count 消除遮罩.
// 有首屏 api 时: 首个 showLoading 里已消化启动 count (_bootCountAlive→false), 兜底直接 skip.
(function bootLoadingFallback(){
  function scheduleHide(){
    setTimeout(function(){
      if (!_bootCountAlive) return;   // 首个 api / 导航已接管, 不重复消化
      _bootCountAlive = false;
      hideLoading();
    }, LOADING_BOOT_FALLBACK);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleHide, { once: true });
  } else {
    scheduleHide();
  }
})();
// ===== 数据共享(家庭/团队): 按模块记住当前查看的数据源(空=我的数据, 否则=主人 uid) =====
// 登录态业务请求自动带 X-Data-As 头; 公开免密路径(/api/public/...)与共享管理(/api/share)不带
function dataShareModOf(path){
  if (path.indexOf('/api/fund')===0) return 'fund';
  if (path.indexOf('/api/weight')===0) return 'weight';
  if (path.indexOf('/api/asset')===0) return 'asset';
  if (path.indexOf('/api/todo')===0) return 'todo';
  return null;
}
function dataShareGet(mod){
  try { return localStorage.getItem('dataAs_'+mod) || ''; } catch(e){ return ''; }
}
function dataShareSet(mod, uid){
  try { uid ? localStorage.setItem('dataAs_'+mod, String(uid)) : localStorage.removeItem('dataAs_'+mod); } catch(e){}
}
// 在模块页 .container 顶部挂"数据源切换条"(仅有共享来源时出现); 切换后整页刷新
async function mountDataSwitcher(mod){
  var box = document.querySelector('.container');
  if (!box) return;
  var shares;
  try { shares = (await api('/api/share/mine')).shares || []; } catch(e){ return; }
  var sources = shares.filter(function(s){ return (s.modules||[]).indexOf(mod) >= 0; });
  var cur = dataShareGet(mod);
  // 没有共享来源时不展示切换条(全是自己的数据); 若本地残留 dataAs(共享已撤销/退出后),
  // 清掉并刷新回自己的数据, 否则会一直带着失效的 X-Data-As 请求
  if (!sources.length) {
    if (cur) { dataShareSet(mod, ''); location.reload(); }
    return;
  }
  var btn = function(uid, label){
    var active = String(uid||'') === String(cur||'');
    return '<button type="button" class="btn sm ' + (active?'':'gray') + '" data-uid="'+(uid||'')+'">'+label+'</button>';
  };
  var html = '<div style="font-size:13px;">📊 数据源：' + btn('', '我的数据') +
    sources.map(function(s){ return btn(s.owner_user_id, '来自 '+esc(s.owner_name)+' 的共享'); }).join('') +
    (cur ? '<div class="muted" style="width:100%;margin-top:4px;">你正在查看/编辑共享数据，推送设置、免密链接等个人功能不可用。</div>' : '') +
    '</div>';
  var bar = document.createElement('div');
  bar.style.cssText = 'margin:0 0 12px;padding:9px 12px;background:var(--hover-brand);border:1px solid var(--brand-border);border-radius:8px;';
  bar.innerHTML = html;
  bar.querySelectorAll('button').forEach(function(b){
    b.addEventListener('click', function(){
      dataShareSet(mod, b.getAttribute('data-uid'));
      location.reload();
    });
  });
  box.insertBefore(bar, box.firstChild);
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
      var reqHeaders = opts.body ? { 'Content-Type': 'application/json' } : {};
      // 数据共享: 业务模块请求按当前数据源带上主人 uid(公开/共享管理路径不带)
      var _mod = dataShareModOf(path);
      var _as = _mod ? dataShareGet(_mod) : '';
      if (_as) reqHeaders['X-Data-As'] = _as;
      var res = await fetch(path, {
        method: method,
        headers: reqHeaders,
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
// 顶部 toast 提示: 固定在视口顶部居中, 成功绿/失败红, 2.8s 自动淡出; 单例复用, 连续调用重置计时
var _toastTimer = null;
function showToast(text, ok) {
  var bar = document.getElementById('appToast');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'appToast';
    bar.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:10002;max-width:92vw;'
      + 'padding:10px 20px;border-radius:10px;color:#fff;font-size:14px;line-height:1.5;text-align:center;'
      + 'word-break:break-all;box-shadow:0 6px 20px rgba(0,0,0,.2);opacity:0;transition:opacity .25s;pointer-events:none;';
    document.body.appendChild(bar);
  }
  bar.style.background = ok === false ? '#cf1322' : '#389e0d';
  bar.textContent = text;
  bar.style.opacity = '1';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function(){ bar.style.opacity = '0'; }, 2800);
}
function bindLogout() {
  bindClickBusy(document.getElementById('logoutBtn'), async function(e){
    if (e && e.preventDefault) e.preventDefault();
    try { await api('/api/auth/logout', { method: 'POST' }); } catch (err) {}
    navTo('/login');
  });
  bindClickBusy(document.getElementById('stopImpersonateBtn'), async function(e){
    if (e && e.preventDefault) e.preventDefault();
    await api('/api/admin/stop-impersonate', { method: 'POST' });
    navTo('/admin');
  });
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}
// Markdown 备注唯一渲染入口：marked(GFM+换行) → DOMPurify 消毒。
// 安全策略：img 仅允许自家附件相对路径 /todo-file/<token>（外域/data:/javascript: 一律移除，防追踪与注入）；
// 链接强制新开页 noopener。所有备注渲染点必须走本函数，禁止散落 marked.parse。
function renderTodoNote(text) {
  if (!text) return '';
  if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') return esc(text);
  if (!marked._todoConfigured) {
    marked.setOptions({ gfm: true, breaks: true });
    DOMPurify.addHook('uponSanitizeAttribute', function(node, data) {
      if (data.attrName === 'src' && node.tagName === 'IMG') {
        // 注意：本函数位于模板字符串内，正则不能含未双写的 /；故用前缀 + 字符校验代替 /^\\/todo-file\\/.../
        var v = data.attrValue || '';
        var token = v.indexOf('/todo-file/') === 0 ? v.slice(11) : '';
        if (!/^[A-Za-z0-9_-]{16,}$/.test(token)) data.keepAttr = false;
      }
      if (data.attrName === 'href' && node.tagName === 'A') {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    });
    marked._todoConfigured = true;
  }
  return DOMPurify.sanitize(marked.parse(text), { USE_PROFILES: { html: true } });
}
// 把渲染后容器里的 GFM 任务复选框转成只读视觉结构（.md-task / .md-tasks 由本函数打类，不依赖 :has()）
function mdTaskToBoxes(scope) {
  if (!scope) return;
  Array.prototype.forEach.call(scope.querySelectorAll('li'), function(li) {
    var cb = li.querySelector('input[type=checkbox]');
    if (!cb) return;
    var box = document.createElement('span');
    box.className = 'tk ' + (cb.checked ? 'on' : 'off');
    if (cb.checked) box.textContent = '✓';
    li.insertBefore(box, li.firstChild);
    cb.remove();
    li.classList.add('md-task');
    if (li.parentNode) li.parentNode.classList.add('md-tasks');
    if (cb.checked) li.classList.add('done');
  });
}
// 数据库时间按配置时区显示: DB 存 UTC(datetime('now') 形如 'YYYY-MM-DD HH:mm:ss'),
// 按顶栏时钟同一配置 window.__TZ_OFFSET__(默认 8)平移到墙钟, 输出 'YYYY-MM-DD HH:mm'。
// 与时钟口径一致, 保证"录入/更新时间"和网页实时时间对得上; 空/非法串安全兜底。
function fmtDbTime(s) {
  if (!s) return '';
  var t = Date.parse(String(s).replace(' ', 'T') + 'Z');
  if (isNaN(t)) return esc(String(s));
  var off = (typeof window.__TZ_OFFSET__ === 'number' && isFinite(window.__TZ_OFFSET__)) ? window.__TZ_OFFSET__ : 8;
  var d = new Date(t + off * 3600 * 1000);
  var p = function(n){ return (n < 10 ? '0' : '') + n; };
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) +
    ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes());
}
// 极简安全 markdown 渲染：先转义再替换标记，输出可直接 innerHTML
// 支持：# 标题、粗体、斜体、行内代码(反引号)、[文字](链接)、-/* 与 1. 列表、段落与换行
function renderMd(md) {
  var lines = String(md == null ? '' : md).replace(/\\r\\n?/g, '\\n').split('\\n');
  function inline(text) {
    // 行内代码先提取并转义，用 \\u0001 占位（模板求值后为浏览器侧 SOH 控制字符，正文不会出现），避免内容被后续标记处理
    var codes = [];
    text = text.replace(/\`([^\`]+)\`/g, function(_, c) {
      codes.push(esc(c));
      return '\\u0001' + (codes.length - 1) + '\\u0001';
    });
    text = esc(text);
    text = text.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
    text = text.replace(/\\*([^*]+)\\*/g, '<em>$1</em>');
    text = text.replace(/\\[([^\\]]+)\\]\\(([^)\\s]+)\\)/g, function(_, t, u) {
      // 仅允许 http(s)/mailto/相对路径，拦截 javascript: 等协议
      if (/^(https?:\\/\\/|mailto:|\\/|#)/i.test(u)) {
        return '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + t + '</a>';
      }
      return t;
    });
    text = text.replace(/\\u0001(\\d+)\\u0001/g, function(_, n) { return '<code>' + (codes[+n] || '') + '</code>'; });
    return text;
  }
  var out = [];
  var para = [];
  function flushPara() {
    if (!para.length) return;
    out.push('<p>' + para.map(inline).join('<br>') + '</p>');
    para = [];
  }
  for (var i = 0; i < lines.length; i++) {
    var t = lines[i].trim();
    var m;
    if (!t) { flushPara(); continue; }
    if ((m = t.match(/^(#{1,4})\\s+(.*)$/))) {
      flushPara();
      var lv = m[1].length <= 2 ? 3 : 4;
      out.push('<h' + lv + '>' + inline(m[2]) + '</h' + lv + '>');
    } else if ((m = t.match(/^[-*]\\s+(.*)$/))) {
      flushPara();
      var items = [];
      while (i < lines.length && (m = lines[i].trim().match(/^[-*]\\s+(.*)$/))) {
        items.push('<li>' + inline(m[1]) + '</li>');
        i++;
      }
      i--;
      out.push('<ul>' + items.join('') + '</ul>');
    } else if ((m = t.match(/^\\d+\\.\\s+(.*)$/))) {
      flushPara();
      var ol = [];
      while (i < lines.length && (m = lines[i].trim().match(/^\\d+\\.\\s+(.*)$/))) {
        ol.push('<li>' + inline(m[1]) + '</li>');
        i++;
      }
      i--;
      out.push('<ol>' + ol.join('') + '</ol>');
    } else {
      para.push(t);
    }
  }
  flushPara();
  return '<div class="md-body">' + out.join('') + '</div>';
}
// 通用弹窗；maskClass 可选，给遮罩加临时修饰类（如 'modal-mask--lg' 大弹窗），每次打开先摘除
function openModal(title, bodyHtml, maskClass) {
  var mask = document.getElementById('modalMask');
  if (!mask) return;
  mask.classList.remove('modal-mask--lg');
  if (maskClass) mask.classList.add(maskClass);
  var wasOpen = mask.classList.contains('show');
  document.getElementById('modalTitle').textContent = title || '';
  document.getElementById('modalBody').innerHTML = bodyHtml || '';
  mask.classList.add('show');
  // 已打开时(如 confirmModal 内部再次 openModal)不重复上锁, 避免引用计数与 close 不匹配
  if (!wasOpen) lockBodyScroll();
  // 主动通知原生壳禁用下拉刷新(不等 500ms 轮询): 长弹窗(如任务分析)滚到边界继续下拉时,
  // 不能让原生抢走手势, 否则弹窗无法滚回顶部
  try { if (window._appShellPullDisable) window._appShellPullDisable(); } catch(e) {}
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
  // 弹窗关闭后按当前滚动位置恢复原生下拉刷新开关
  try { if (window._appShellReport) window._appShellReport(); } catch(e) {}
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
    document.documentElement.classList.add('no-scroll');   // ★ 兼容不支持 :has() 的内核
    document.body.classList.remove('booting');   // JS 接管后, 移除纯 CSS 的启动锁类, 避免冗余样式
  }
  _bodyScrollLockCount++;
}
function unlockBodyScroll() {
  if (_bodyScrollLockCount === 0) return;   // 从未 lock 过就不做恢复 (启动阶段 hideLoading 会调用此函数)
  _bodyScrollLockCount--;
  if (_bodyScrollLockCount === 0) {
    document.body.classList.remove('no-scroll');
    document.documentElement.classList.remove('no-scroll');
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
    '<p style="line-height:1.6;word-break:break-all;white-space:pre-line;">' + esc(message) + '</p>' +
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

// 推送前校验：通知渠道多选必须至少选中一项，否则弹窗拦截并返回 false（保存推送配置/立即推送共用）
function requirePushChannels(pick) {
  var ids = pick && pick.getValues ? pick.getValues() : [];
  if (!ids.length) {
    alertModal('请先选择至少一个通知渠道；还没有渠道可到「通知渠道」页添加。', { ok: false });
    return false;
  }
  return true;
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
    navTo(r.redirect || '/dashboard');
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
  var md = dueDate.slice(5,7) + '/' + dueDate.slice(8,10);
  if (!today || today.length < 10) return md;
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
  // 范围外: 本年 MM/DD; 跨年 yy/MM/DD(2 位年, 如 26/08/01)
  if (dueDate.slice(0,4) !== today.slice(0,4)) return dueDate.slice(2,4) + '/' + md;
  return md;
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
    // canvas 排除: 图表区是横向滑动误触高发区(长按曲线拖动曾被当成右滑返回, 直接跳了首页);
    // 图表自身只响应轻点钻取, 需要返回手势时从图表外的页面区域起手即可
    if (tag === 'canvas') return;
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
      // 首次进入全屏、数据加载完成前, exitBtn 上的 click 事件还没绑(applyTodoView 尚未运行), 单纯 .click() 会哑;
      // 直接调 exitTodoFullscreen 兜底; 若函数不存在则手动移除 body class 做最小回退
      if (typeof exitTodoFullscreen === 'function') {
        try { exitTodoFullscreen(null, null); return; } catch(err){ /* fallthrough */ }
      }
      if (exitBtn && exitBtn.__exitBound) { exitBtn.click(); return; }
      // 兜底: 手动切回默认页
      try { if (typeof _todoView !== 'undefined') { _todoView = 'default'; localStorage.setItem('todoView', 'default'); } } catch(err){}
      document.body.classList.remove('todo-fs-on');
      return;
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
    navTo('/dashboard');
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
    // 恢复原生下拉刷新状态(下层可能仍是弹窗, report 会继续判为禁用)
    try { if (window._appShellReport) window._appShellReport(); } catch(e) {}
  }
  function onKey(e){ if (e.key === 'Escape') shut(); }
  close.addEventListener('click', shut);
  mask.addEventListener('click', function(e){ if (e.target === mask) shut(); });
  document.addEventListener('keydown', onKey, true);
  mask.appendChild(stage);
  mask.appendChild(close);
  document.body.appendChild(mask);
  lockBodyScroll(); locked = true;
  // 主动禁用原生下拉刷新, 不等 500ms 轮询
  try { if (window._appShellPullDisable) window._appShellPullDisable(); } catch(e) {}
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
    if (el.__agDisabled) return;   // 被自定义编辑器接管（固定高度内部滚动）
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
// 左滑返回手势仅在待办相关页面(/todo, /t/:token, /tr/:token, /tc/:token)启用, 其他页面不劫持横向手势
function _isTodoPage() {
  var p = location.pathname;
  return p === '/todo' || p.indexOf('/t/') === 0 || p.indexOf('/tr/') === 0 || p.indexOf('/tc/') === 0;
}
// 顶栏 Logo 右侧时钟: 页面存在 #brandClock 时启动秒级刷新, 无 topbar 的公开页无 element 自动跳过.
// 桌面与手机窄屏均显示"MM-DD HH:mm:ss"实时秒级刷新.
// 时间按后端注入的配置时区 window.__TZ_OFFSET__(app_settings.tz_offset, 默认 8)显示;
// 缺失时(旧页面/未注入)回退浏览器本地时间. tabular-nums 已在 CSS 里保证数字等宽, 秒变化不横向抖动.
function initBrandClock() {
  var el = document.getElementById('brandClock');
  if (!el || el.__ticked) return;
  el.__ticked = 1;
  function pad2(n){ return (n < 10 ? '0' : '') + n; }
  var off = window.__TZ_OFFSET__;
  var useTz = typeof off === 'number' && isFinite(off);
  function tick() {
    var d = new Date();
    if (useTz) {
      // 平移到目标时区后用 UTC getters 读墙钟, 避免再受浏览器/设备本地时区影响
      var t = new Date(d.getTime() + off*3600*1000);
      el.textContent = pad2(t.getUTCMonth()+1) + '-' + pad2(t.getUTCDate()) + ' ' +
                       pad2(t.getUTCHours()) + ':' + pad2(t.getUTCMinutes()) + ':' + pad2(t.getUTCSeconds());
    } else {
      el.textContent = pad2(d.getMonth()+1) + '-' + pad2(d.getDate()) + ' ' +
                       pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
    }
  }
  tick();
  // 秒级刷新: 页面 visible 时 1s tick; 隐藏时 setInterval 由浏览器限流, 无需自处理
  setInterval(tick, 1000);
  // 页面从后台切回前台时立即刷新一次, 避免上次留下的秒数看起来"卡了"
  document.addEventListener('visibilitychange', function(){ if (!document.hidden) tick(); });
}
function _initGlobalUX() { initChartFullscreen(); initBrandClock(); if (_isTodoPage()) initGlobalSwipeBack(); }
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initGlobalUX);
} else {
  _initGlobalUX();
}

// ============ App 原生壳联动: 下拉刷新(SwipeRefreshLayout)开关 ============
// 待办全屏/弹窗等页面在"内部容器"里滚动(网页 body 不滚), 原生侧只读 WebView.scrollY,
// 会永远以为在顶部而拦截向下拖拽 → 卡片列表/弹窗卡死无法下滑.
// 网页实时上报"是否在顶部": 内部容器滚动、弹窗/菜单打开、键盘弹起时一律关闭原生下拉刷新.
// 仅在原生壳注入了 window.AppShell 时生效, 普通浏览器/微信内为 no-op.
(function initAppShellBridge(){
  var api = null;
  try {
    if (window.AppShell && typeof window.AppShell.setPullRefresh === 'function') api = window.AppShell;
  } catch (e) { return; }
  if (!api) return;
  var _last = '';
  function report() {
    var atTop = (window.scrollY || window.pageYOffset || 0) <= 4;
    if (atTop) {
      // 弹窗/图表全屏/多选面板打开期间禁用(遮罩盖住页面, 下拉只应作用于弹窗内部)
      if (document.querySelector('.modal-mask.show, .chart-fs-mask, .mp-menu.show')) atTop = false;
    }
    if (atTop) {
      // 内部滚动容器不在顶部时禁用(待办全屏主区/弹窗遮罩/长表格/抽屉目录)
      var boxes = document.querySelectorAll('.todo-fs-main, .modal-mask.show, .table-scroll-mobile, .todo-drawer__list');
      for (var i = 0; i < boxes.length; i++) { if (boxes[i].scrollTop > 4) { atTop = false; break; } }
    }
    if (atTop && window.visualViewport && window.innerHeight) {
      // 软键盘弹起(可视高度明显小于布局高度)时禁用, 避免键盘上方区域误触下拉刷新
      if (window.visualViewport.height < window.innerHeight * 0.75) atTop = false;
    }
    var key = atTop ? '1' : '0';
    if (key === _last) return;
    _last = key;
    try { api.setPullRefresh(atTop); } catch (e) {}
  }
  document.addEventListener('scroll', report, true);
  window.addEventListener('resize', report);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', report);
    window.visualViewport.addEventListener('scroll', report);
  }
  setInterval(report, 500); // 兜底: DOM 变动(弹窗开合/重绘)无 scroll 事件时 500ms 内纠正
  // 供长按拖拽等场景:
  //   _appShellReport()      —— 手势结束后立即按当前滚动/弹窗状态重算(不等 500ms 兜底)
  //   _appShellPullDisable() —— 手势期间强制禁用; 必须同步去重状态 _last='0',
  //                             否则手势结束 report 判定"仍在顶部"(key='1' 与旧 _last 相同)会跳过恢复,
  //                             下拉刷新会一直卡在禁用
  window._appShellReport = report;
  window._appShellPullDisable = function() {
    _last = '0';
    try { api.setPullRefresh(false); } catch (e) {}
  };
  // 待办数据变更通知: 待办页 loadTodos 成功收尾时调用, 原生壳防抖后直连刷新桌面小组件
  // (App 内网页增删改不经过小组件动作, 否则只能等 15 分钟周期 Worker); 普通浏览器无此接口 no-op.
  window._appShellTodoChanged = function() {
    try { if (typeof api.todoChanged === 'function') api.todoChanged(); } catch (e) {}
  };
  report();
})();

// ============ 主题切换（浅色/暗色/护眼，账号级同步） ============
// 服务端已按用户偏好把 data-theme 直出在 <html>（首屏无闪白）；这里负责顶栏按钮渲染、
// 点击循环切换与持久化。window.__applyTheme(theme, persist) 同时供 Android 原生壳
//（"我的"页主题项）经 evaluateJavascript 调用。
(function initThemeSwitcher(){
  var THEME_ORDER = ['light', 'dark', 'eye'];
  var SVG_SUN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
  var SVG_MOON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  var SVG_EYE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  var THEME_META = {
    light: { label: '浅色', icon: SVG_SUN },
    dark:  { label: '暗色', icon: SVG_MOON },
    eye:   { label: '护眼', icon: SVG_EYE }
  };
  function currentTheme() {
    var t = document.documentElement.getAttribute('data-theme');
    return THEME_META[t] ? t : 'light';
  }
  function renderToggle() {
    var m = THEME_META[currentTheme()];
    var icon = document.getElementById('themeToggleIcon');
    var label = document.getElementById('themeToggleLabel');
    if (icon) icon.innerHTML = m.icon;
    if (label) label.textContent = m.label;
  }
  // 应用主题: 切 <html data-theme> + 刷新按钮; persist=true 时 PUT 到账号(失败静默, 本地已生效)
  window.__applyTheme = function(theme, persist) {
    if (!THEME_META[theme]) theme = 'light';
    document.documentElement.setAttribute('data-theme', theme);
    renderToggle();
    if (persist) {
      try { api('/api/auth/theme', { method: 'PUT', body: { theme: theme } }).catch(function(){}); } catch(e) {}
    }
  };
  function cycle() {
    var t = currentTheme();
    var next = THEME_ORDER[(THEME_ORDER.indexOf(t) + 1) % THEME_ORDER.length];
    window.__applyTheme(next, true);
  }
  function bind() {
    var btn = document.getElementById('themeToggle');
    if (btn && !btn.__themeBound) {
      btn.__themeBound = 1;
      btn.addEventListener('click', function(e){ e.preventDefault(); cycle(); });
    }
    renderToggle();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();

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
var loginForm = document.getElementById('loginForm');
var regForm = document.getElementById('regForm');
var msg = document.getElementById('msg');
var tabLogin = document.getElementById('tabLogin');
var tabReg = document.getElementById('tabReg');
// 登录提交：表单底部"登录"按钮与顶部"登录"标签（已在登录页时）共用
async function doLogin() {
  try {
    await api('/api/auth/login', { method: 'POST', body: {
      username: document.getElementById('lu').value,
      password: document.getElementById('lp').value
    }});
    navTo('/dashboard');
  } catch (err) { showMsg(msg, err.message, false); }
}
loginForm.addEventListener('submit', function(e) { e.preventDefault(); doLogin(); });
// 顶部"登录"标签：已在登录页时点击直接提交登录；在注册页时点击仅切回登录表单
tabLogin.addEventListener('click', function() {
  if (loginForm.style.display !== 'none') { doLogin(); return; }
  tabLogin.className = 'btn'; tabReg.className = 'btn gray';
  loginForm.style.display = 'block'; regForm.style.display = 'none';
});
tabReg.addEventListener('click', function() {
  tabReg.className = 'btn'; tabLogin.className = 'btn gray';
  regForm.style.display = 'block'; loginForm.style.display = 'none';
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
  } catch (err) {
    showMsg(msg, err.message, false);
    // 竞态兜底：加载页时未满员、提交时已满员 → 重新拉取状态并关闭注册入口
    if (err.message && err.message.indexOf('注册人数已满') !== -1) applyRegLimit();
  }
});
// 注册人数上限：查询公开状态，满员则隐藏注册 tab 并展示超管配置的 markdown 提示词
async function applyRegLimit() {
  try {
    var st = await api('/api/auth/register-status');
    if (st && st.limited) {
      tabReg.style.display = 'none';
      if (regForm.style.display !== 'none') tabLogin.click();
      var box = document.getElementById('regLimitMsg');
      if (box) { box.innerHTML = renderMd(st.msg || '注册人数已满'); box.style.display = 'block'; }
    }
  } catch (e) {}
}
applyRegLimit();
`;

// 仪表盘 JS
const DASHBOARD_JS = `
bindLogout();
(async function() {
  try {
    var me = await api('/api/auth/me');
    document.getElementById('welcome').textContent = '欢迎，' + (me.user.nickname || me.user.username);
  } catch (err) { navTo('/login'); }
})();
`;

// 个人设置页 JS
const SETTINGS_JS = `
bindLogout();
bindModal();
var msg = document.getElementById('msg');
// 个人设置页: 成功/失败提示统一走顶部 toast(替代页内 #msg 行内提示)
var showMsg = function(_el, text, ok){ showToast(text, ok); };
(async function(){
  try {
    var d = await api('/api/auth/profile');
    document.getElementById('pfUsername').value = d.profile.username;
    document.getElementById('pfNick').value = d.profile.nickname;
    var ql = document.getElementById('qlRestrict');
    if (ql) ql.checked = d.profile.restrict_quicklogin != 0;
    var tap = document.getElementById('todoAutoParent');
    if (tap) tap.checked = d.profile.todo_auto_parent !== 0;
  } catch(e){ navTo('/login'); }
})();
// 免密登录限制开关：切换即保存
var qlEl = document.getElementById('qlRestrict');
if (qlEl) qlEl.addEventListener('change', async function(){
  try {
    await api('/api/auth/quicklogin-restrict', { method:'PUT', body:{ enabled: qlEl.checked } });
    showMsg(msg, '免密登录设置已保存', true);
  } catch(err){ showMsg(msg, err.message, false); qlEl.checked = !qlEl.checked; }
});
// 待办偏好：子任务全部完成后自动完成父任务，切换即保存
var tapEl = document.getElementById('todoAutoParent');
if (tapEl) tapEl.addEventListener('change', async function(){
  try {
    await api('/api/auth/todo-auto-parent', { method:'PUT', body:{ enabled: tapEl.checked } });
    showMsg(msg, '待办偏好已保存', true);
  } catch(err){ showMsg(msg, err.message, false); tapEl.checked = !tapEl.checked; }
});
// 免密 Token：加载并渲染各模块 report_token + 一键复制
var SHARE_META = {
  fund:   { name:'基金持仓', path:'/fr/' },
  weight: { name:'体重',     path:'/wr/' },
  asset:  { name:'资产',     path:'/ar/' },
  todo:   { name:'待办',     path:'/tr/' }
};
window.copyInput = function(id){
  var el = document.getElementById(id);
  if (!el) return;
  el.select(); el.setSelectionRange(0, el.value.length);
  try { document.execCommand('copy'); showMsg(msg, '已复制', true); }
  catch(e){ showMsg(msg, '请手动复制', false); }
};
async function loadShareTokens(){
  var box = document.getElementById('shareTokenBox');
  if (!box) return;
  try {
    var d = await api('/api/share/tokens');
    var origin = location.origin;
    box.innerHTML = Object.keys(SHARE_META).map(function(m){
      var t = (d.tokens[m] && d.tokens[m].token) || '';
      var meta = SHARE_META[m];
      var inputId = 'st_' + m;
      var linkId = 'sl_' + m;
      return '<div style="margin-bottom:12px;padding:10px;background:var(--surface-2);border-radius:6px;">'
        + '<label style="font-weight:600;margin-bottom:4px;display:block;">' + meta.name + ' report_token</label>'
        + '<div class="row" style="align-items:center;">'
        + '<input id="' + inputId + '" readonly value="' + t + '" style="flex:1;font-family:monospace;font-size:12px;">'
        + '<button class="btn sm" type="button" onclick="copyInput(\\'' + inputId + '\\')">复制token</button>'
        + '</div>'
        + '<div class="row" style="align-items:center;margin-top:6px;">'
        + '<input id="' + linkId + '" readonly value="' + origin + meta.path + t + '" style="flex:1;font-size:12px;">'
        + '<button class="btn sm gray" type="button" onclick="copyInput(\\'' + linkId + '\\')">复制链接</button>'
        + '</div></div>';
    }).join('');
  } catch(e){ box.innerHTML = '<p class="muted" style="font-size:12px;color:var(--danger);">加载失败：' + (e.message||'') + '</p>'; }
}
loadShareTokens();
// 模块级重置免密链接
window.resetShare = async function(module){
  var names = { fund:'基金', weight:'体重', asset:'资产', todo:'待办' };
  confirmModal('重置免密链接', '确认重置「' + (names[module]||module) + '」的全部免密链接？旧链接将立即失效。', async function(){
    try {
      var r = await api('/api/share/reset/' + module, { method:'POST' });
      showMsg(msg, r.message, true);
      loadShareTokens();
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
// ===== 家庭数据共享 =====
var DS_MODS = [ {k:'fund',name:'基金持仓'}, {k:'weight',name:'体重'}, {k:'asset',name:'资产'}, {k:'todo',name:'待办'} ];
function dsModNames(arr){ return DS_MODS.filter(function(m){ return arr.indexOf(m.k)>=0; }).map(function(m){ return m.name; }).join('、'); }
async function loadDataShare(){
  var box = document.getElementById('dataShareBox');
  if (!box) return;
  var mine = [], invites = [];
  try {
    mine = (await api('/api/share/mine')).shares || [];
    invites = (await api('/api/share/invites')).invites || [];
  } catch(e){ box.innerHTML = '<p class="muted" style="font-size:12px;color:var(--danger);">加载失败：' + esc(e.message) + '</p>'; return; }
  var h = '';
  // 我发起的共享
  h += '<div style="padding:10px;background:var(--surface-2);border-radius:6px;margin-bottom:12px;">';
  h += '<div style="font-weight:600;margin-bottom:6px;">我发起的共享</div>';
  h += '<div style="margin-bottom:8px;">';
  DS_MODS.forEach(function(m){
    // label 用 inline-flex 横排; checkbox 显式重置全局 input 的 width:100%/padding/margin-bottom, 否则方框与文字错位换行
    h += '<label style="display:inline-flex;align-items:center;gap:6px;font-weight:normal;font-size:13px;margin:0 16px 8px 0;white-space:nowrap;">'
      + '<input type="checkbox" class="ds-mod" value="'+m.k+'" style="width:auto;min-width:0;height:auto;margin:0;padding:0;flex:none;">'
      + m.name + '</label>';
  });
  h += '</div>';
  h += '<div class="row" style="align-items:center;"><input id="dsNote" placeholder="备注（可选，如：咱家账本）" style="flex:1;"> <button class="btn sm" id="dsCreate">生成共享码</button></div>';
  invites.forEach(function(inv){
    h += '<div style="margin-top:10px;padding:8px;border:1px solid #eee;border-radius:6px;' + (inv.revoked ? 'opacity:.55;' : '') + '">';
    h += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">';
    h += '<code style="font-size:15px;font-weight:700;letter-spacing:1px;">' + esc(inv.code) + '</code>';
    h += '<span class="muted" style="font-size:12px;">' + esc(dsModNames(inv.modules)) + (inv.note ? ' · ' + esc(inv.note) : '') + (inv.revoked ? ' · 已撤销' : '') + '</span>';
    h += '</div>';
    if (!inv.revoked) {
      h += '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;">';
      h += '<button class="btn sm" onclick="dsCopyLink(\\'' + inv.code + '\\')">复制加入链接</button>';
      h += '<button class="btn sm gray" onclick="dsResetInvite(' + inv.id + ')">重置码</button>';
      h += '<button class="btn sm danger" onclick="dsRevokeInvite(' + inv.id + ')">撤销邀请</button>';
      h += '</div>';
    }
    var active = inv.members.filter(function(m){ return m.active; });
    if (active.length) {
      h += '<div style="margin-top:6px;font-size:13px;">成员：' + active.map(function(m){
        return esc(m.nickname) + ' <button class="btn sm danger" style="padding:0 6px;font-size:11px;" onclick="dsKick(' + m.id + ')">移出</button>';
      }).join(' &nbsp;') + '</div>';
    }
    h += '</div>';
  });
  h += '</div>';
  // 加入共享
  h += '<div style="padding:10px;background:var(--surface-2);border-radius:6px;">';
  h += '<div style="font-weight:600;margin-bottom:6px;">加入共享</div>';
  h += '<div class="row" style="align-items:center;"><input id="dsJoinCode" placeholder="输入家人给的共享码" style="flex:1;letter-spacing:1px;"> <button class="btn sm" id="dsJoin">加入</button></div>';
  if (mine.length) {
    h += '<div style="margin-top:8px;font-size:13px;">我已加入：' + mine.map(function(s){
      return esc(s.owner_name) + '（' + esc(dsModNames(s.modules)) + '） <button class="btn sm gray" style="padding:0 6px;font-size:11px;" onclick="dsLeave(' + s.member_id + ')">退出</button>';
    }).join(' &nbsp;') + '</div>';
  }
  h += '</div>';
  box.innerHTML = h;

  // 一人一码: 已有有效邀请时回显勾选模块/备注, 按钮变为"保存并换新码"
  var activeInv = invites.filter(function(i){ return !i.revoked; })[0];
  var dsBtn = document.getElementById('dsCreate');
  if (dsBtn) dsBtn.textContent = activeInv ? '保存并换新码' : '生成共享码';
  if (activeInv) {
    box.querySelectorAll('.ds-mod').forEach(function(c){ c.checked = activeInv.modules.indexOf(c.value) >= 0; });
    var noteEl = document.getElementById('dsNote');
    if (noteEl) noteEl.value = activeInv.note || '';
  }

  document.getElementById('dsCreate').addEventListener('click', async function(){
    var mods = Array.prototype.map.call(box.querySelectorAll('.ds-mod:checked'), function(c){ return c.value; });
    if (!mods.length) { showMsg(msg, '请至少勾选一个模块', false); return; }
    try {
      var r = await api('/api/share/invites', { method:'POST', body:{ modules: mods, note: document.getElementById('dsNote').value } });
      showMsg(msg, (r.updated ? '共享码已更新，旧码已失效：' : '共享码已生成：') + r.code, true);
      loadDataShare();
    } catch(e){ showMsg(msg, e.message, false); }
  });
  document.getElementById('dsJoin').addEventListener('click', function(){ dsDoJoin(); });
  document.getElementById('dsJoinCode').addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); dsDoJoin(); } });
  // 链接 ?join=code 落地自动加入
  var jc = new URLSearchParams(location.search).get('join');
  if (jc) dsDoJoin(jc.trim());
}
async function dsDoJoin(presetCode){
  var code = (typeof presetCode === 'string' ? presetCode : ((document.getElementById('dsJoinCode')||{}).value || '')).trim();
  if (!code) { showMsg(msg, '请输入共享码', false); return; }
  try {
    var r = await api('/api/share/join', { method:'POST', body:{ code: code } });
    showMsg(msg, r.message, true);
    if (typeof presetCode === 'string') {
      try { history.replaceState(null, '', location.pathname); } catch(e){}
      var el = document.getElementById('dsJoinCode'); if (el) el.value = '';
    }
    loadDataShare();
  } catch(e){ showMsg(msg, e.message, false); }
}
window.dsCopyLink = function(code){
  var link = location.origin + '/settings?join=' + code;
  var done = function(){ showMsg(msg, '已复制加入链接', true); };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(done, function(){ dsFallbackCopy(link, done); });
      return;
    }
  } catch(e){}
  dsFallbackCopy(link, done);
};
function dsFallbackCopy(text, done){
  var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
  try { document.execCommand('copy'); done(); } catch(e){ showMsg(msg, '请手动复制：' + text, false); }
  document.body.removeChild(t);
}
window.dsResetInvite = function(id){
  confirmModal('重置共享码', '重置后旧码立即失效（已加入的成员不受影响）。确认？', async function(){
    try { var r = await api('/api/share/invites/' + id + '/reset', { method:'POST' }); showMsg(msg, '新共享码：' + r.code, true); loadDataShare(); }
    catch(e){ alertModal(e.message, { ok:false }); }
  });
};
window.dsRevokeInvite = function(id){
  confirmModal('撤销共享邀请', '撤销后旧码失效，且已加入的全部成员将被移出（不影响任何人已录入的数据）。确认？', async function(){
    try { await api('/api/share/invites/' + id + '/revoke', { method:'POST' }); showMsg(msg, '邀请已撤销', true); loadDataShare(); }
    catch(e){ alertModal(e.message, { ok:false }); }
  });
};
window.dsKick = function(memberId){
  confirmModal('移出成员', '确定把该成员移出共享？（不影响已录入的数据）', async function(){
    try { await api('/api/share/members/' + memberId, { method:'DELETE' }); showMsg(msg, '已移出', true); loadDataShare(); }
    catch(e){ alertModal(e.message, { ok:false }); }
  });
};
window.dsLeave = function(memberId){
  confirmModal('退出共享', '退出后你将不再看到该共享数据（可凭原码重新加入）。确认？', async function(){
    try { await api('/api/share/members/' + memberId, { method:'DELETE' }); showMsg(msg, '已退出共享', true); loadDataShare(); }
    catch(e){ alertModal(e.message, { ok:false }); }
  });
};
loadDataShare();
`;

// 初始化超管页 JS
const SETUP_JS = `
var form = document.getElementById('setupForm');
var msg = document.getElementById('msg');
var tokenField = document.getElementById('tokenField');
(async function() {
  try {
    var st = await api('/api/auth/setup-status');
    if (!st.needSetup) {
      showMsg(msg, '系统已初始化，正在跳转登录...', true);
      setTimeout(function(){ navTo('/login'); }, 1500);
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
    setTimeout(function(){ navTo('/login'); }, 1500);
  } catch (err) { showMsg(msg, err.message, false); }
});
`;

// 超管用户管理 JS
const ADMIN_JS = `
bindLogout();
bindModal();
var tbody = document.getElementById('userTbody');
var detail = document.getElementById('detail');

// DB 时间(datetime('now') 存 UTC)统一按配置时区显示: 复用 COMMON_JS 的 fmtDbTime(与顶栏时钟同口径); 空值显示破折号
function fmtUTC2CN(s) {
  var t = fmtDbTime(s);
  return t ? t : '<span class="muted">—</span>';
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
  } catch (err) { alertModal(err.message, {ok:false}); if (err.message.indexOf('权限') >= 0 || err.message.indexOf('登录') >= 0) navTo('/login'); }
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
    try { await api('/api/admin/users/' + id + '/impersonate', { method: 'POST' }); navTo('/dashboard'); }
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

// 待办附件大小上限
(async function(){
  var inp = document.getElementById('attachMaxMbInput');
  if (!inp) return;
  var stMsg = document.getElementById('stMsg');
  try {
    var d = await api('/api/admin/settings/todo-attach-max-mb');
    inp.value = d.max_mb;
  } catch (err) { inp.value = 5; }
  var btn = document.getElementById('attachMaxMbSave');
  if (btn) btn.addEventListener('click', async function(){
    try {
      var r = await api('/api/admin/settings/todo-attach-max-mb', { method: 'PUT', body: { max_mb: parseInt(inp.value, 10) } });
      showMsg(stMsg, r.message || '已保存', true);
    } catch (err) { showMsg(stMsg, err.message, false); }
  });
})();

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

// 注册人数上限与满员提示词（提示词在弹窗内编辑，不铺在系统设置页）
var regLimitMsg = '';
async function loadRegisterLimit() {
  try {
    var d = await api('/api/admin/settings/register-limit');
    document.getElementById('regLimitInput').value = d.limit || 0;
    regLimitMsg = d.msg || '';
  } catch (err) { /* 忽略 */ }
}
var regLimitSave = document.getElementById('regLimitSave');
if (regLimitSave) regLimitSave.addEventListener('click', async function(){
  var stMsg = document.getElementById('stMsg');
  try {
    var r = await api('/api/admin/settings/register-limit', { method: 'PUT', body: {
      limit: document.getElementById('regLimitInput').value,
      msg: regLimitMsg
    }});
    document.getElementById('regLimitInput').value = r.limit;
    regLimitMsg = r.msg || '';
    showMsg(stMsg, r.message || '已保存', true);
  } catch (err) { showMsg(stMsg, err.message, false); }
});
var regLimitMsgBtn = document.getElementById('regLimitMsgBtn');
if (regLimitMsgBtn) regLimitMsgBtn.addEventListener('click', function(){
  openModal('满员提示词（支持 markdown）',
    '<div style="margin-bottom:10px;"><label>提示词内容（留空则使用默认文案）</label>' +
    '<textarea id="rlmText" data-autogrow style="width:100%;min-height:160px;padding:8px;" placeholder="支持 **粗体**、*斜体*、[文字](链接)、- 列表、# 标题"></textarea></div>' +
    '<div style="margin-bottom:10px;"><label>预览</label>' +
    '<div id="rlmPreview" style="border:1px solid #E4E1D8;border-radius:8px;padding:10px 12px;min-height:60px;background:var(--surface-2);"></div></div>' +
    '<div style="text-align:right;"><button class="btn gray" id="rlmCancel">取消</button> ' +
    '<button class="btn" id="rlmSave">保存提示词</button></div>');
  var ta = document.getElementById('rlmText');
  var pv = document.getElementById('rlmPreview');
  ta.value = regLimitMsg;
  function refreshPreview() {
    pv.innerHTML = ta.value.trim() ? renderMd(ta.value) : '<span class="muted">（留空时访客将看到默认提示文案）</span>';
  }
  refreshPreview();
  ta.addEventListener('input', refreshPreview);
  document.getElementById('rlmCancel').addEventListener('click', closeModal);
  document.getElementById('rlmSave').addEventListener('click', async function(){
    var stMsg = document.getElementById('stMsg');
    try {
      var r = await api('/api/admin/settings/register-limit', { method: 'PUT', body: {
        limit: document.getElementById('regLimitInput').value,
        msg: ta.value
      }});
      document.getElementById('regLimitInput').value = r.limit;
      regLimitMsg = r.msg || '';
      closeModal();
      showMsg(stMsg, r.message || '已保存', true);
    } catch (err) { showMsg(stMsg, err.message, false); }
  });
});
loadRegisterLimit();

// ============ 数据备份与恢复（仅超管页）============
var bkExport = document.getElementById('bkExport');
if (bkExport) bkExport.addEventListener('click', async function(){
  if (bkExport.disabled) return;
  bkExport.disabled = true;
  showLoading('正在导出全量数据…');
  try {
    // 用 fetch 拿 Blob：等待期间显示全局遮罩（大数据量时有兜底进度条），完成后再触发下载
    var resp = await fetch('/api/admin/backup/export', { credentials: 'same-origin' });
    if (!resp.ok) {
      var em = '导出失败';
      try { var ej = await resp.json(); if (ej && ej.message) em = ej.message; } catch (_) {}
      throw new Error(em);
    }
    var blob = await resp.blob();
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    var cd = resp.headers.get('Content-Disposition') || '';
    var fm = /filename="?([^"]+)"?/.exec(cd);
    a.download = fm ? fm[1] : ('backup-' + new Date().toISOString().slice(0, 10) + '.json');
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
    showMsg(document.getElementById('bkMsg'), '导出完成，已开始下载', true);
  } catch (err) {
    showMsg(document.getElementById('bkMsg'), err.message || '导出失败', false);
  } finally {
    hideLoading();
    bkExport.disabled = false;
  }
});
var bkImport = document.getElementById('bkImport');
if (bkImport) bkImport.addEventListener('click', async function(){
  var bkMsg = document.getElementById('bkMsg');
  var fileEl = document.getElementById('bkFile');
  var file = fileEl && fileEl.files && fileEl.files[0];
  if (!file) { showMsg(bkMsg, '请先选择备份文件（.json）', false); return; }
  var data;
  try {
    data = JSON.parse(await file.text());
  } catch (e) { showMsg(bkMsg, '文件解析失败：不是合法 JSON', false); return; }
  if (!data || data.format !== 'cron-day-report-backup' || !data.tables) {
    showMsg(bkMsg, '文件格式不正确：不是本系统的备份文件', false); return;
  }
  if (!confirm('导入将【清空当前全部数据】并替换为备份内容，操作不可撤销！\\n完成后需重新登录。\\n\\n确定继续吗？')) return;
  bkImport.disabled = true;
  showLoading('正在导入并覆盖数据，数据量较大时请耐心等待，请勿关闭页面…');
  try {
    var r = await api('/api/admin/backup/import', { method: 'POST', body: data });
    hideLoading();
    showMsg(bkMsg, (r.message || '导入完成') + '，即将跳转登录页…', true);
    // users 表已被备份覆盖，当前会话可能失效，2 秒后跳登录页重新登录
    setTimeout(function(){ window.location.href = '/login'; }, 2000);
  } catch (err) {
    hideLoading();
    showMsg(bkMsg, err.message || '导入失败', false);
    bkImport.disabled = false;  // 失败恢复按钮，允许重试
  }
});

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
bindLogout();
bindModal();
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
// 新建/编辑任务弹窗(t 有 id=编辑); 表单元素在弹窗内动态创建, 保存/取消绑定也在此处
function taskForm(t) {
  t = t || {};
  var isEdit = !!t.id;
  var enabled = t.enabled !== 0 && t.enabled !== false;
  var standalone = t.standalone === 1 || t.standalone === true;
  var html =
    '<input type="hidden" id="tId" value="' + (t.id || '') + '">' +
    '<label>任务名称</label><input id="tName" value="' + esc(t.name || '') + '">' +
    '<label>URL</label><input id="tUrl" placeholder="https://..." value="' + esc(t.url || '') + '">' +
    '<div class="row"><div><label>返回格式</label>' +
      '<select id="tType"><option value="text">text</option><option value="html">html</option></select></div>' +
    '<div><label>通知渠道</label><select id="tChannel">' + channelOptions(t.channel_id || '') + '</select></div></div>' +
    '<label><input type="checkbox" id="tEnabled" style="width:auto;"' + (enabled ? ' checked' : '') + '> 启用</label>' +
    '<label><input type="checkbox" id="tStandalone" style="width:auto;"' + (standalone ? ' checked' : '') + '> 独立发送（该任务结果单独一条消息；不勾则与同渠道其他任务合并）</label>' +
    '<div style="margin-top:12px;"><button class="btn" id="tSave">保存</button> <button class="btn gray" id="tCancel">取消</button></div>';
  openModal(isEdit ? '编辑任务' : '新建任务', html);
  document.getElementById('tType').value = t.return_type || 'text';
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
      closeModal(); await loadTasks();
    } catch(e){ alertModal(e.message, {ok:false}); }
  });
  document.getElementById('tCancel').addEventListener('click', function(){ closeModal(); });
}
window.editTask = function(id){ taskForm((window._tasks||[]).filter(function(x){return x.id===id;})[0]); };
window.delTask = async function(id){
  var t = (window._tasks||[]).filter(function(x){return x.id===id;})[0];
  var info = t ? ('任务：' + t.name + '\\nURL：' + t.url) : '';
  confirmModal('删除任务', '确定删除该监控任务吗？删除后不再定时检查与推送。\\n' + info, async function(){
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
        return '<tr><td data-label="时间" class="muted">' + fmtDbTime(l.created_at) + '</td>' +
          '<td data-label="结果">' + (l.success ? '<span class="tag ok">成功</span>' : '<span class="tag fail">失败</span>') + '</td>' +
          '<td data-label="状态">' + esc(l.status) + ' ' + esc(l.status_text||'') + '</td>' +
          '<td data-label="耗时">' + (l.response_time||0) + 'ms</td><td data-label="大小">' + (l.response_size||0) + '</td></tr>';
      }).join('') || '<tr><td colspan="5" class="muted">暂无日志</td></tr>') + '</tbody></table>';
    box.scrollIntoView({ behavior:'smooth' });
  } catch(e){ alertModal(e.message, {ok:false}); }
};
// 新建/编辑走 taskForm() 弹窗; tNew 按钮在 h2, 点击打开空白表单
document.getElementById('tNew').addEventListener('click', function(){ taskForm({}); });
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
  catch(e){ if (String(e.message).indexOf('登录')>=0) navTo('/login'); else alertModal(e.message, {ok:false}); }
})();
`;

// 通知渠道管理 JS（独立页）
const CHANNELS_JS = `
bindLogout();
bindModal();
var CH_HELP = {
  wechat: '<b>📢 企业微信群机器人</b><br>• <b>URL</b>：群机器人 Webhook 地址<br>&nbsp;&nbsp;<code>https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=你的key</code><br>• <b>请求头 JSON</b>、<b>Body 模板</b>：留空',
  webhook: '<b>🔗 通用 Webhook</b><br>• <b>URL</b>：接收消息的接口地址<br>• <b>请求头 JSON</b>（可选）：<code>{"Authorization":"Bearer xxx"}</code><br>• <b>Body 模板</b>（可选）：用 <code>{{content}}</code> 代表正文，例 <code>{"text":"{{content}}"}</code>',
  email: '<b>📧 邮件（中转服务转发）</b><br>• <b>URL</b>：邮件中转服务地址<br>• <b>请求头 JSON</b>：<span style="color:var(--danger);">填收件人和主题</span> <code>{"mailto":"x@qq.com","subject":"标题"}</code><br>• <b>Body 模板</b>：留空'
};
async function loadChannels() {
  var data = await api('/api/notify/channels');
  var tb = document.getElementById('chTbody');
  tb.innerHTML = data.channels.map(function(c) {
    return '<tr><td data-label="名称">' + esc(c.name) + '</td><td data-label="类型">' + c.type + '</td>' +
      '<td data-label="URL" class="muted" style="word-break:break-all;">' + esc(c.url) + '</td>' +
      '<td data-label="状态">' + (c.enabled ? '<span class="tag ok">启用</span>' : '<span class="tag disabled">停用</span>') + '</td>' +
      '<td data-label="操作">' +
        (c.enabled
          ? '<button class="btn sm gray" onclick="toggleCh(' + c.id + ')">停用</button> '
          : '<button class="btn sm" onclick="toggleCh(' + c.id + ')">启用</button> ') +
      '<button class="btn sm gray" onclick="editCh(' + c.id + ')">编辑</button> ' +
      '<button class="btn sm danger" onclick="delCh(' + c.id + ')">删除</button></td></tr>';
  }).join('') || '<tr><td colspan="5" class="muted">暂无渠道</td></tr>';
  window._channels = data.channels;
}
function chModal(c) {
  c = c || {};
  var help = '<div id="chHelp" style="background:var(--surface-3);border:1px solid #e6e8f0;border-radius:6px;padding:12px;margin-bottom:12px;font-size:13px;line-height:1.7;"></div>';
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
window.toggleCh = async function(id){
  var cur = (window._channels||[]).filter(function(x){return x.id===id;})[0];
  if (!cur) return;
  try {
    await api('/api/notify/channels/' + id + '/status', { method:'PUT', body: { enabled: !cur.enabled } });
    await loadChannels();
  } catch(e){ alertModal(e.message, {ok:false}); }
};
// 一键全部启用/停用：仅对状态不符的渠道发请求，复用单个 /status 接口；停用影响推送，二次确认
window.toggleAllCh = function(enable){
  var targets = (window._channels||[]).filter(function(c){ return enable ? !c.enabled : c.enabled; });
  if (!targets.length) { alertModal(enable ? '没有需要启用的渠道' : '没有需要停用的渠道', {ok:false}); return; }
  var run = async function(){
    try {
      for (var i = 0; i < targets.length; i++) {
        await api('/api/notify/channels/' + targets[i].id + '/status', { method:'PUT', body: { enabled: !!enable } });
      }
      await loadChannels();
    } catch(e){ alertModal(e.message, {ok:false}); await loadChannels(); }
  };
  if (enable) run();
  else confirmModal('全部停用', '确认停用全部 ' + targets.length + ' 个渠道？停用后相关推送将暂停。', run);
};
window.delCh = async function(id){
  confirmModal('删除渠道', '确认删除该渠道?', async function(){
    try { await api('/api/notify/channels/' + id, { method:'DELETE' }); await loadChannels(); } catch(e){ alertModal(e.message, {ok:false}); }
  });
};
document.getElementById('chNew').addEventListener('click', function(){ chModal({}); });
document.getElementById('chEnableAll').addEventListener('click', function(){ window.toggleAllCh(true); });
document.getElementById('chDisableAll').addEventListener('click', function(){ window.toggleAllCh(false); });
(async function(){
  try { await loadChannels(); }
  catch(e){ if (String(e.message).indexOf('登录')>=0) navTo('/login'); else alertModal(e.message, {ok:false}); }
})();
`;

// 基金追踪 JS
const FUND_JS = `
bindLogout();
bindModal();
mountDataSwitcher('fund');
var chart = null;   // 饼图
var profitChart = null;
var navChart = null;   // 单只基金近30日净值折线图
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
          '<button data-id="' + it.id + '" data-name="' + esc(it.name) + '" data-code="' + esc(it.code) + '" onclick="viewNavHistory(this)">近30净值</button>' +
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
  var isDateWin = false;  // 日期窗口类: cutoff 为 YYYY-MM-DD, 早于 cutoff 的数据跳过
  // 近 N 天 = 含今日往前 N-1 天, 共 N 天 (与 todo 的 todoRangeWindow 保持一致)
  //   直接 (now - N天) 会把 today-N 也放行, 实际渲染 N+1 天; 应用 (N-1)*86400000
  var dayBack = { '7d': 6, '30d': 29 }[rng];
  if (dayBack != null) {
    isDateWin = true;
    cutoff = new Date(now.getTime()-dayBack*86400000).toISOString().slice(0,10);
  }
  else if (rng==='2y' || rng==='3y') {
    isDateWin = true;
    var yrs = rng==='2y' ? 2 : 3;  // 同日同月回退 N 年(闰年 2/29 由 Date 自动归一到 3/1)
    cutoff = new Date(Date.UTC(now.getUTCFullYear()-yrs, now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0,10);
  }
  else if (rng==='month') { cutoff = now.toISOString().slice(0,7); } // YYYY-MM
  else if (rng==='year') { cutoff = now.toISOString().slice(0,4); }  // YYYY

  for (var i=0;i<window._profitSeries.length;i++) {
    var s = window._profitSeries[i];
    if (isDateWin && s.date < cutoff) continue;
    if (rng!=='all' && !isDateWin && s.date.slice(0,cutoff.length)!==cutoff) continue;
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
    if (isDateWin && s.date < cutoff) continue;
    if (rng!=='all' && !isDateWin && s.date.slice(0,cutoff.length)!==cutoff) continue;
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

// ---------- 单只基金近30日净值 ----------
// 后端 /api/fund/:id/nav-history 兜底返回 45 条 (加仓按日期回填的覆盖力),
// 曲线场景只取后 30 条 → 手机看 30 个交易日不挤, 语义贴 "近 30 天"
window.viewNavHistory = async function(btn){
  var id = btn.dataset.id;
  var name = btn.dataset.name || '';
  var code = btn.dataset.code || '';
  var html =
    '<p class="muted">近 30 个交易日单位净值走势（数据源：天天基金 F10 历史接口）。</p>' +
    '<div id="navChartWrap" style="max-width:640px;margin:0 auto;"><canvas id="navChart"></canvas></div>' +
    '<h3 style="margin:16px 0 8px;font-size:15px;">每日明细</h3>' +
    '<div class="scroll-box"><table><thead><tr style="background:var(--surface-2);"><th>日期</th><th>单位净值</th><th>较前一日</th></tr></thead><tbody id="navTbody"></tbody></table></div>';
  openModal('近30净值 · ' + name + ' (' + code + ')', html);
  try {
    var d = await api('/api/fund/' + id + '/nav-history', { loadingText: '正在加载近30日净值…' });
    var series = (d.navHistory || []).slice(-30);
    if (!series.length) {
      document.getElementById('navChartWrap').innerHTML = '<p class="muted" style="text-align:center;padding:24px;">暂无历史净值数据</p>';
      document.getElementById('navTbody').innerHTML = '<tr><td colspan="3" data-label="提示" class="muted">暂无数据</td></tr>';
      return;
    }
    var labels = series.map(function(s){ return s.date.slice(5); });  // MM-DD
    var vals = series.map(function(s){ return s.nav; });
    if (navChart) navChart.destroy();   // 防内存泄漏: 重开前先销毁上次的实例
    navChart = new Chart(document.getElementById('navChart'), {
      type: 'line',
      data: { labels: labels, datasets: [{
        label: '单位净值', data: vals,
        borderColor: '#4a6cf7', backgroundColor: 'rgba(74,108,247,.12)',
        fill: true, tension: 0.3,
        pointRadius: series.length > 15 ? 0 : 2   // 30 条数据点太密则隐藏
      }] },
      options: {
        responsive: true, maintainAspectRatio: true, aspectRatio: 2.5,
        plugins: { legend: { display: false } },
        scales: { y: { ticks: { callback: function(v){ return Number(v).toFixed(4); } } } }
      }
    });
    // 表格倒序 + 较前一日 %
    var rows = [];
    for (var i = series.length - 1; i >= 0; i--) {
      var s = series[i];
      var prev = i > 0 ? series[i - 1].nav : null;
      var change = prev ? (s.nav - prev) / prev * 100 : null;
      var color = change == null ? '#999' : (change >= 0 ? '#cf1322' : '#389e0d');
      var text = change == null ? '—' : (sign(change) + '%');
      rows.push('<tr><td data-label="日期">' + s.date + '</td><td data-label="单位净值">' + s.nav.toFixed(4) + '</td><td data-label="较前一日" style="color:' + color + '">' + text + '</td></tr>');
    }
    document.getElementById('navTbody').innerHTML = rows.join('');
  } catch(e) {
    alertModal(e.message, {ok:false});
  }
};

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
window.buyFundUI = async function(id){
  var f = (window._items||[]).filter(function(x){return x.id===id;})[0];
  if (!f) return;
  // 先拉历史净值 + 服务端"今天"(用全局 tz_offset), 供选日期回填净值
  var navMap = {}, today = '';
  try {
    var nh = await api('/api/fund/' + id + '/nav-history', { loadingText: '正在加载历史净值…' });
    today = nh.today || '';
    (nh.navHistory||[]).forEach(function(h){ navMap[h.date] = h.nav; });
  } catch(e) { /* 拉失败不阻塞: 用户仍可手填净值或选今天靠后端实时拉 */ }
  if (!today) today = new Date(Date.now() + 8*3600*1000).toISOString().slice(0,10);
  var html =
    '<p class="muted">当前持有 <b>' + fmtMoney(f.shares) + '</b> 份 · 成本净值 <b>' + f.cost_nav + '</b>。按金额买入，系统自动累计份额并重算成本。</p>' +
    '<input type="hidden" id="buyId" value="' + id + '">' +
    '<label>买入日期</label><input id="buyDate" type="date" value="' + today + '" max="' + today + '">' +
    '<label>买入金额(元)</label><input id="buyAmount" type="number" step="0.01" placeholder="如 1000">' +
    '<label>买入净值（默认按日期自动带出，可改）</label><input id="buyNavInput" type="number" step="0.0001" value="' + (f.current_nav||'') + '">' +
    '<p class="muted" style="font-size:12px;margin-top:4px;">选择今天=实时估算净值；选择历史日=该日单位净值（周末/节假日无数据请手填）。</p>' +
    '<div style="margin-top:12px;"><button class="btn" id="buyConfirm">确认加仓</button> ' +
    '<button class="btn gray" onclick="closeModal()">取消</button></div>';
  openModal('加仓 · ' + f.name + ' (' + f.code + ')', html);
  // 日期变更时自动回填净值: 今天用当前估值, 历史日查 navMap, 无数据清空让用户手填
  var dEl = document.getElementById('buyDate');
  var nEl = document.getElementById('buyNavInput');
  function syncNav(){
    var d = dEl.value;
    if (!d) return;
    if (d === today) { nEl.value = f.current_nav || ''; nEl.placeholder = '当前估值净值'; return; }
    if (navMap[d] != null) { nEl.value = navMap[d]; nEl.placeholder = ''; return; }
    nEl.value = '';
    nEl.placeholder = '该日无净值数据，请手填';
  }
  dEl.addEventListener('change', syncNav);
  document.getElementById('buyConfirm').addEventListener('click', async function(){
    var payload = {
      amount: document.getElementById('buyAmount').value,
      buyNav: document.getElementById('buyNavInput').value || undefined,
      buyDate: document.getElementById('buyDate').value || undefined
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
  if (!requirePushChannels(rcChannelPick)) return;
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
  if (!requirePushChannels(rcChannelPick)) return;
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
      return '<div style="background:var(--surface-2);border-radius:6px;padding:12px;margin-bottom:10px;">' +
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
      '<div style="margin-top:10px;background:var(--surface-3);border-radius:6px;padding:10px;font-size:14px;">' +
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
  catch(e){ if (String(e.message).indexOf('登录')>=0) navTo('/login'); else alertModal(e.message, {ok:false}); }
  finally { _initTotal = 0; hideLoading(); }
  // 绑定筛选（select 在 loadReport 时 DOM 已就绪）
  document.getElementById('profitRange').addEventListener('change', applyProfitFilter);
  // 手动刷新净值: 拉最新估算 + 覆盖今日 fund_profit_daily 快照(修 -本金 类污染)
  // 只刷数据不推送; 如需重发日报, 另点"立即发送日报"按钮
  bindClickBusy(document.getElementById('fRefresh'), async function(){
    var r = await api('/api/fund/refresh', { method:'POST', loadingText:'正在刷新净值并覆盖今日快照…' });
    await loadReport();
    var tip = '刷新完成: 成功 ' + r.refreshed + ' 只' +
      (r.fallback ? '; 缓存兜底 ' + r.fallback + ' 只' : '') +
      (r.missing ? '; 无净值 ' + r.missing + ' 只(按成本价计, 今日收益记 0)' : '');
    alertModal(tip);
  });
  // 初始化投资策略悬浮面板 (独立入口, 不阻塞主流程)
  initStrategyPanel();
})();

// ============ 投资策略: 悬浮按钮 + 可拖拽面板 + 简易 Markdown 渲染 ============
// 已设置(内容非空) -> 显示 📝 圆形悬浮按钮, 点击展开面板; 未设置 -> 显示底部"记录我的投资策略"CTA 按钮.
// 面板可通过标题栏拖动(桌面 mousedown / 移动 touchstart), 位置存 localStorage, 下次打开复原.
// Markdown 渲染: 支持 # 标题 / 列表 / **加粗** / *斜体* / \`code\` / [链接](url) / --- 分割线 / > 引用 / \`\`\`代码块\`\`\`.
var _stratLoaded = null;   // 服务端已保存的内容, 用于取消编辑时回退
function _mdEsc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function renderMarkdown(src){
  if (!src) return '<p class="muted">还没有内容, 点右上"编辑"开始记录你的投资策略</p>';
  var lines = String(src).replace(/\\r\\n/g,'\\n').split('\\n');
  var out = [], i = 0;
  function inline(s){
    // 代码块内不再转义, 其他先转义再替换标记 (转义后 [text](url) 里的 url 仍可用, 因为 & 不影响我们的正则)
    s = _mdEsc(s);
    // 行内代码
    s = s.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
    // 加粗/斜体 (先双星再单星避免嵌套误判)
    s = s.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
    s = s.replace(/\\*([^*]+)\\*/g, '<em>$1</em>');
    // 链接 [text](url) - url 只允许 http/https/相对路径
    s = s.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, function(m, t, u){
      var safe = /^(https?:\\/\\/|\\/|#)/.test(u) ? u : '#';
      return '<a href="' + safe + '" target="_blank" rel="noopener">' + t + '</a>';
    });
    return s;
  }
  while (i < lines.length){
    var line = lines[i];
    // 代码块 \`\`\`
    if (/^\`\`\`/.test(line)) {
      var lang = line.replace(/^\`\`\`\\s*/, '').trim();
      i++;
      var buf = [];
      while (i < lines.length && !/^\`\`\`/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      out.push('<pre><code>' + _mdEsc(buf.join('\\n')) + '</code></pre>');
      continue;
    }
    // 分割线
    if (/^\\s*---+\\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
    // 标题
    var mh = line.match(/^(#{1,3})\\s+(.+)$/);
    if (mh) { var lv = mh[1].length; out.push('<h' + lv + '>' + inline(mh[2]) + '</h' + lv + '>'); i++; continue; }
    // 引用
    if (/^>\\s?/.test(line)) {
      var qb = [];
      while (i < lines.length && /^>\\s?/.test(lines[i])) { qb.push(lines[i].replace(/^>\\s?/, '')); i++; }
      out.push('<blockquote>' + inline(qb.join(' ')) + '</blockquote>');
      continue;
    }
    // 无序列表
    if (/^\\s*[-*+]\\s+/.test(line)) {
      var lb = [];
      while (i < lines.length && /^\\s*[-*+]\\s+/.test(lines[i])) { lb.push(lines[i].replace(/^\\s*[-*+]\\s+/, '')); i++; }
      out.push('<ul>' + lb.map(function(x){ return '<li>' + inline(x) + '</li>'; }).join('') + '</ul>');
      continue;
    }
    // 有序列表
    if (/^\\s*\\d+\\.\\s+/.test(line)) {
      var ob = [];
      while (i < lines.length && /^\\s*\\d+\\.\\s+/.test(lines[i])) { ob.push(lines[i].replace(/^\\s*\\d+\\.\\s+/, '')); i++; }
      out.push('<ol>' + ob.map(function(x){ return '<li>' + inline(x) + '</li>'; }).join('') + '</ol>');
      continue;
    }
    // 空行 -> 段落分隔
    if (/^\\s*$/.test(line)) { i++; continue; }
    // 普通段落 (连续非空行合并)
    var pb = [];
    while (i < lines.length && !/^\\s*$/.test(lines[i])
      && !/^(#{1,3})\\s+/.test(lines[i]) && !/^\\s*[-*+]\\s+/.test(lines[i])
      && !/^\\s*\\d+\\.\\s+/.test(lines[i]) && !/^>\\s?/.test(lines[i])
      && !/^\`\`\`/.test(lines[i]) && !/^\\s*---+\\s*$/.test(lines[i])) {
      pb.push(lines[i]); i++;
    }
    out.push('<p>' + inline(pb.join(' ')) + '</p>');
  }
  return out.join('');
}
function _stratRefreshEntry(content){
  var hasContent = !!(content && content.trim());
  var fab = document.getElementById('stratFab');
  var cta = document.getElementById('stratSetup');
  if (hasContent) { if (fab) fab.style.display = 'inline-block'; if (cta) cta.style.display = 'none'; }
  else { if (fab) fab.style.display = 'none'; if (cta) cta.style.display = 'inline-block'; }
}
function _stratIsMobile(){ return window.matchMedia && window.matchMedia('(max-width: 640px)').matches; }
function _stratOpen(){
  var panel = document.getElementById('stratPanel');
  if (!panel) return;
  panel.style.display = 'flex';
  // 恢复上次位置 + 尺寸(仅桌面; 手机走 CSS 贴底浮层)
  if (!_stratIsMobile()) {
    try {
      var pos = JSON.parse(localStorage.getItem('stratPanelPos') || 'null');
      if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
        // 复原位置前夹一次视口, 防止上次拖到边缘后窗口缩小导致飞出屏外
        var w = (pos.width && pos.width > 0) ? pos.width : panel.offsetWidth;
        var h = (pos.height && pos.height > 0) ? pos.height : panel.offsetHeight;
        var left = Math.max(4, Math.min(window.innerWidth - w - 4, pos.left));
        var top = Math.max(4, Math.min(window.innerHeight - h - 4, pos.top));
        panel.style.left = left + 'px'; panel.style.top = top + 'px';
        panel.style.right = 'auto'; panel.style.bottom = 'auto';
        if (pos.width) panel.style.width = pos.width + 'px';
        if (pos.height) panel.style.height = pos.height + 'px';
      }
    } catch(e){}
  }
  _stratShowView(_stratLoaded);
}
function _stratClose(){
  var panel = document.getElementById('stratPanel');
  if (panel) panel.style.display = 'none';
}
function _stratShowView(content){
  document.getElementById('stratView').innerHTML = renderMarkdown(content || '');
  document.getElementById('stratView').style.display = 'block';
  document.getElementById('stratEditor').style.display = 'none';
  document.getElementById('stratEdit').style.display = 'inline-block';
  document.getElementById('stratSave').style.display = 'none';
  document.getElementById('stratCancel').style.display = 'none';
}
function _stratShowEdit(content){
  var ta = document.getElementById('stratEditor');
  ta.value = content || '';
  document.getElementById('stratView').style.display = 'none';
  ta.style.display = 'block';
  document.getElementById('stratEdit').style.display = 'none';
  document.getElementById('stratSave').style.display = 'inline-block';
  document.getElementById('stratCancel').style.display = 'inline-block';
  setTimeout(function(){ ta.focus(); }, 30);
}
// 保存当前位置+尺寸到 localStorage (仅桌面, 手机端由 CSS 强制布局, 不写)
function _stratPersistBox(panel){
  if (_stratIsMobile()) return;
  try {
    localStorage.setItem('stratPanelPos', JSON.stringify({
      left: parseInt(panel.style.left, 10) || panel.getBoundingClientRect().left,
      top: parseInt(panel.style.top, 10) || panel.getBoundingClientRect().top,
      width: panel.offsetWidth,
      height: panel.offsetHeight
    }));
  } catch(e){}
}
function _stratBindDrag(){
  var panel = document.getElementById('stratPanel');
  var head = document.getElementById('stratHead');
  if (!panel || !head) return;
  var dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
  function down(clientX, clientY){
    if (_stratIsMobile()) return;   // 手机: 面板贴底固定, 禁拖动
    dragging = true;
    var rect = panel.getBoundingClientRect();
    // 切换到 left/top 定位, 释放 right/bottom; 同时锁死当前宽高避免 resize:both 被右侧夹紧改变
    panel.style.left = rect.left + 'px'; panel.style.top = rect.top + 'px';
    panel.style.right = 'auto'; panel.style.bottom = 'auto';
    panel.style.width = rect.width + 'px'; panel.style.height = rect.height + 'px';
    sx = clientX; sy = clientY; ox = rect.left; oy = rect.top;
    document.body.style.userSelect = 'none';
  }
  function move(clientX, clientY){
    if (!dragging) return;
    var nx = ox + (clientX - sx), ny = oy + (clientY - sy);
    var w = panel.offsetWidth, h = panel.offsetHeight;
    nx = Math.max(4, Math.min(window.innerWidth - w - 4, nx));
    ny = Math.max(4, Math.min(window.innerHeight - h - 4, ny));
    panel.style.left = nx + 'px'; panel.style.top = ny + 'px';
  }
  function up(){
    if (!dragging) return;
    dragging = false;
    document.body.style.userSelect = '';
    _stratPersistBox(panel);
  }
  head.addEventListener('mousedown', function(e){
    // 点击按钮/关闭区不触发拖动
    if (e.target.closest('button') || e.target.closest('.strat-close')) return;
    down(e.clientX, e.clientY); e.preventDefault();
  });
  document.addEventListener('mousemove', function(e){ move(e.clientX, e.clientY); });
  document.addEventListener('mouseup', up);
  head.addEventListener('touchstart', function(e){
    if (_stratIsMobile()) return;
    if (e.target.closest('button') || e.target.closest('.strat-close')) return;
    var t = e.touches[0]; down(t.clientX, t.clientY);
    if (e.cancelable) e.preventDefault();   // 屏蔽浏览器边缘手势(返回/翻页)
  }, {passive: false});
  document.addEventListener('touchmove', function(e){
    if (!dragging) return; var t = e.touches[0]; move(t.clientX, t.clientY);
    if (e.cancelable) e.preventDefault();
  }, {passive: false});
  document.addEventListener('touchend', up);
  // 监听 resize:both 拖角落造成的尺寸变化, 持久化 (ResizeObserver 覆盖桌面主流浏览器)
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(function(){
      if (panel.style.display === 'none' || _stratIsMobile()) return;
      _stratPersistBox(panel);
    });
    ro.observe(panel);
  }
}
// FAB 悬浮按钮可拖动: 位移 < 阈值视为点击(打开面板), 否则视为拖动(仅挪位置, 存 localStorage)
// 手机上 CSS 已把 fab 缩到 48px 右下 16px, 但用户仍可能需要挪开避免挡视线
function _stratBindFabDrag(){
  var fab = document.getElementById('stratFab');
  if (!fab) return;
  var DRAG_THRESHOLD = 5;   // 位移 <5px 判定点击
  var dragging = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;
  // 恢复上次 FAB 位置(桌面/手机通用; 一份 storage)
  function _restoreFabPos(){
    try {
      var pos = JSON.parse(localStorage.getItem('stratFabPos') || 'null');
      if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
        var w = fab.offsetWidth || 52, h = fab.offsetHeight || 52;
        var left = Math.max(4, Math.min(window.innerWidth - w - 4, pos.left));
        var top = Math.max(4, Math.min(window.innerHeight - h - 4, pos.top));
        fab.style.left = left + 'px'; fab.style.top = top + 'px';
        fab.style.right = 'auto'; fab.style.bottom = 'auto';
      }
    } catch(e){}
  }
  _restoreFabPos();
  window.addEventListener('resize', _restoreFabPos);   // 屏幕方向/尺寸变化时夹回视口
  function down(clientX, clientY){
    dragging = true; moved = false;
    var rect = fab.getBoundingClientRect();
    fab.style.left = rect.left + 'px'; fab.style.top = rect.top + 'px';
    fab.style.right = 'auto'; fab.style.bottom = 'auto';
    sx = clientX; sy = clientY; ox = rect.left; oy = rect.top;
    document.body.style.userSelect = 'none';
  }
  function move(clientX, clientY){
    if (!dragging) return;
    var dx = clientX - sx, dy = clientY - sy;
    if (!moved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) moved = true;
    if (!moved) return;
    var w = fab.offsetWidth, h = fab.offsetHeight;
    var nx = Math.max(4, Math.min(window.innerWidth - w - 4, ox + dx));
    var ny = Math.max(4, Math.min(window.innerHeight - h - 4, oy + dy));
    fab.style.left = nx + 'px'; fab.style.top = ny + 'px';
  }
  function up(){
    if (!dragging) return;
    dragging = false;
    document.body.style.userSelect = '';
    if (moved) {
      try { localStorage.setItem('stratFabPos', JSON.stringify({ left: parseInt(fab.style.left,10), top: parseInt(fab.style.top,10) })); } catch(e){}
    } else {
      // 未达拖动阈值 -> 视为点击, 打开面板
      _stratOpen();
    }
  }
  fab.addEventListener('mousedown', function(e){ down(e.clientX, e.clientY); e.preventDefault(); });
  document.addEventListener('mousemove', function(e){ move(e.clientX, e.clientY); });
  document.addEventListener('mouseup', up);
  fab.addEventListener('touchstart', function(e){
    var t = e.touches[0]; down(t.clientX, t.clientY);
    // 一按下就 preventDefault, 屏蔽浏览器边缘手势(返回/翻页)与页面滚动
    if (e.cancelable) e.preventDefault();
  }, {passive: false});
  document.addEventListener('touchmove', function(e){
    if (!dragging) return; var t = e.touches[0]; move(t.clientX, t.clientY);
    if (e.cancelable) e.preventDefault();   // 拖动中禁页面滚动 & 手势
  }, {passive: false});
  document.addEventListener('touchend', up);
  fab.addEventListener('touchcancel', up);
  // 阻断浏览器原生 click(手机上 touchend 后仍会补一次), 由我们自己在 up() 里派发"点击=打开"
  fab.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); });
}
function initStrategyPanel(){
  // 拉取当前内容, 决定入口形态; 失败时保持默认 CTA 可见, 不阻塞用户
  api('/api/fund/strategy').then(function(d){
    _stratLoaded = d && d.content || '';
    _stratRefreshEntry(_stratLoaded);
  }).catch(function(err){
    console.warn('[strategy] load failed:', err && err.message);
    _stratRefreshEntry('');   // 兜底: 显示 CTA 按钮, 用户仍可进入编辑并保存
  });
  _stratBindFabDrag();   // FAB 悬浮按钮可拖动(手机端尤其需要, 避免挡视线)
  document.getElementById('stratSetup').addEventListener('click', function(){
    _stratOpen(); _stratShowEdit(_stratLoaded);
  });
  document.getElementById('stratClose').addEventListener('click', _stratClose);
  document.getElementById('stratEdit').addEventListener('click', function(){ _stratShowEdit(_stratLoaded); });
  document.getElementById('stratCancel').addEventListener('click', function(){ _stratShowView(_stratLoaded); });
  bindClickBusy(document.getElementById('stratSave'), async function(){
    var v = document.getElementById('stratEditor').value;
    var r = await api('/api/fund/strategy', { method: 'PUT', body: { content: v }, loadingText: '正在保存投资策略…' });
    if (r && r.success) {
      _stratLoaded = v;
      _stratRefreshEntry(_stratLoaded);
      _stratShowView(_stratLoaded);
    }
  });
  _stratBindDrag();
}
`;

// 免密加仓公开页 JS（无需登录，通过 URL 中的 token 操作）
const PUBLIC_BUY_JS = `
var token = location.pathname.split('/').filter(Boolean).pop();
var msg = document.getElementById('msg');
var profitChartInst = null;
// 加仓选日期时回填净值: 服务端下发的历史净值 map(YYYY-MM-DD -> nav), 与"今天"字符串一并保存
var _navMap = {};
var _todayStr = '';
var _curNavCache = 0;

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

// 日期变更时同步净值输入框: 今天=实时估值, 历史日查 map, 缺失清空让用户手填
function syncBuyNavByDate() {
  var dEl = document.getElementById('buyDate');
  var nEl = document.getElementById('buyNav');
  if (!dEl || !nEl) return;
  var d = dEl.value;
  if (!d) return;
  if (d === _todayStr) { nEl.value = _curNavCache || ''; nEl.placeholder = '当前估值净值'; return; }
  if (_navMap[d] != null) { nEl.value = _navMap[d]; nEl.placeholder = ''; return; }
  nEl.value = '';
  nEl.placeholder = '该日无净值数据，请手填';
}

async function loadInfo() {
  try {
    setLoadingProgress(90);   // 单请求：推进度条爬升，营造实时加载进度感
    var d = await api('/api/public/fund/' + token, { loadingText: '正在加载基金信息与近30天收益曲线…' });
    var f = d.fund;
    _todayStr = d.today || '';
    _curNavCache = f.current_nav || 0;
    _navMap = {};
    (d.navHistory||[]).forEach(function(h){ _navMap[h.date] = h.nav; });
    document.getElementById('fundName').textContent = f.name + ' (' + f.code + ')';
    document.getElementById('curNav').textContent = f.current_nav + ' (' + (f.gszzl>=0?'+':'') + f.gszzl + '%)';
    document.getElementById('curShares').textContent = fmtMoney(f.shares);
    document.getElementById('curCost').textContent = f.cost_nav;
    document.getElementById('buyNav').value = f.current_nav || '';
    var dEl = document.getElementById('buyDate');
    if (dEl && _todayStr) {
      dEl.value = _todayStr;
      dEl.max = _todayStr;
    }
    document.getElementById('content').style.display = 'block';
    drawProfitChart(d.profitSeries);
  } catch(e) {
    document.getElementById('content').innerHTML = '<p class="msg err" style="display:block;">' + esc(e.message) + '</p>';
  }
}
var _bdEl = document.getElementById('buyDate');
if (_bdEl) _bdEl.addEventListener('change', syncBuyNavByDate);
document.getElementById('buyForm').addEventListener('submit', async function(e){
  e.preventDefault();
  var payload = {
    amount: document.getElementById('amount').value,
    buyNav: document.getElementById('buyNav').value || undefined,
    buyDate: (document.getElementById('buyDate')||{}).value || undefined
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
bindLogout();
bindModal();
mountDataSwitcher('weight');
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
  // 曲线/记录表只统计启用成员（停用成员历史数据保留但不展示）
  var active = members.filter(function(m){ return !m.disabled; });
  drawChart(active, filtered);
  renderRecordTable(active, filtered);
}

async function loadAll() {
  var data = await api('/api/weight/chart');
  members = data.members;
  allRecords = data.records;
  unit = data.weight_unit || 'jin';
  var us = document.getElementById('unitSel');
  if (us) us.value = unit;
  renderMembers(data.members);
  // 录入下拉只列启用成员（管理列表 renderMembers 仍显示已停用，灰色可重新启用）
  renderMemberSelect(data.members.filter(function(m){ return !m.disabled; }));
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
    var offTag = m.disabled ? ' <span class="tag" style="background:var(--surface-2);color:var(--muted);padding:0 6px;border-radius:8px;font-size:11px;">已停用</span>' : '';
    var nameStyle = m.disabled ? 'color:var(--muted);text-decoration:line-through;' : 'color:inherit;';
    return '<span class="tag user" style="margin:2px 4px;padding:4px 10px;' + (m.disabled ? 'opacity:.75;' : '') + '">' +
      '<a href="#" onclick="selMember(' + m.id + ');return false;" style="' + nameStyle + 'text-decoration:none;">' + esc(m.name) + '</a>' + sharedTag + offTag +
      ' <a href="#" title="更多操作" onclick="mMenu(' + m.id + ');return false;" style="margin-left:4px;color:var(--muted);font-weight:bold;text-decoration:none;">⋯</a></span>';
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
  if (deltaKg > 0) return '<span style="color:var(--danger);font-weight:700;">↑ +' + d + ' ' + unitLabel() + '</span>';
  if (deltaKg < 0) return '<span style="color:var(--ok);">↓ -' + d + ' ' + unitLabel() + '</span>';
  return '<span class="muted">0</span>';
}

// 成员「⋯ 更多」菜单：改名/链接/上移下移/禁用启用/删除 收进一个弹窗，手机好操作
window.mMenu = function(id){
  var m = members.filter(function(x){ return x.id === id; })[0];
  if (!m) return;
  var own = !m.shared;
  var ownIds = members.filter(function(x){ return !x.shared; }).map(function(x){ return x.id; });
  var oi = ownIds.indexOf(id);
  function btn(label, onclick, cls, disabled){
    if (disabled) return '<button class="btn gray" style="width:100%;margin-bottom:8px;" disabled>' + label + '</button>';
    return '<button class="btn ' + (cls || 'gray') + '" style="width:100%;margin-bottom:8px;" onclick="' + onclick + '">' + label + '</button>';
  }
  var html = btn('✏️ 改名', 'closeModal();mRename(' + id + ')') +
    btn('🔗 分享 / 填写链接', 'closeModal();mShare(' + id + ')');
  if (own) {
    html += btn('⬆️ 上移', 'closeModal();mMove(' + id + ',-1)', 'gray', oi <= 0) +
      btn('⬇️ 下移', 'closeModal();mMove(' + id + ',1)', 'gray', oi < 0 || oi >= ownIds.length - 1) +
      btn(m.disabled ? '▶️ 启用' : '⏸️ 禁用', 'closeModal();mToggleDisable(' + id + ')') +
      btn('🗑️ 删除', 'closeModal();mDel(' + id + ')', 'danger');
  } else {
    html += btn('移除共享（不影响属主数据）', 'closeModal();mDel(' + id + ')', 'danger');
  }
  html += '<button class="btn gray" style="width:100%;" onclick="closeModal()">取消</button>';
  openModal('成员：' + m.name, html);
};
// 上移/下移：仅在自己的成员间调整顺序，提交完整有序 id 列表
window.mMove = async function(id, dir){
  var own = members.filter(function(x){ return !x.shared; });
  var i = own.map(function(x){ return x.id; }).indexOf(id);
  var j = i + dir;
  if (i < 0 || j < 0 || j >= own.length) return;
  var t = own[i]; own[i] = own[j]; own[j] = t;
  try { await api('/api/weight/members/reorder', { method:'PUT', body:{ ids: own.map(function(x){ return x.id; }) } }); await loadAll(); }
  catch(e){ alertModal(e.message, {ok:false}); }
};
// 禁用/启用（仅属主）：停用后曲线/录入/日报隐藏，数据保留
window.mToggleDisable = async function(id){
  var m = members.filter(function(x){ return x.id === id; })[0];
  if (!m) return;
  try { await api('/api/weight/members/' + id, { method:'PUT', body:{ disabled: !m.disabled } }); await loadAll(); }
  catch(e){ alertModal(e.message, {ok:false}); }
};
// 删除：属主可选「仅移除(保留数据,同名可恢复)」或「连数据一起删」；共享方仅解除引用
window.mDel = async function(id){
  var m = members.filter(function(x){ return x.id === id; })[0];
  if (!m) return;
  if (m.shared) {
    confirmModal('移除共享', '移除该共享成员？（不影响属主数据）', async function(){
      try { await api('/api/weight/members/' + id, { method:'DELETE' }); await loadAll(); } catch(e){ alertModal(e.message, {ok:false}); }
    });
    return;
  }
  openModal('删除成员：' + m.name,
    '<p style="line-height:1.6;margin-bottom:14px;">选择删除方式：</p>' +
    '<button class="btn" id="mDelArc" style="width:100%;margin-bottom:8px;">仅移除成员（保留历史数据，以后新建同名可恢复）</button>' +
    '<button class="btn danger" id="mDelPurge" style="width:100%;margin-bottom:8px;">删除成员及其全部体重记录（不可恢复）</button>' +
    '<button class="btn gray" style="width:100%;" onclick="closeModal()">取消</button>');
  document.getElementById('mDelArc').addEventListener('click', async function(){
    try { await api('/api/weight/members/' + id, { method:'DELETE' }); closeModal(); await loadAll(); }
    catch(e){ alertModal(e.message, {ok:false}); }
  });
  document.getElementById('mDelPurge').addEventListener('click', function(){
    closeModal();
    confirmModal('确认删除全部数据', '将永久删除「' + m.name + '」及其所有体重记录，且不可恢复。确认？', async function(){
      try { await api('/api/weight/members/' + id + '?purge=1', { method:'DELETE' }); await loadAll(); }
      catch(e){ alertModal(e.message, {ok:false}); await loadAll(); }
    });
  });
};
window.mRename = function(id){
  var m = members.filter(function(x){ return x.id === id; })[0];
  var curName = m ? m.name : '';
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
    var name = (document.getElementById('mName').value || '').trim();
    if (!name) { alertModal('请填写成员名称', {ok:false}); return; }
    try {
      var d = await api('/api/weight/members', { method:'POST', body:{ name: name } });
      // 命中同名已归档(软删)成员: 确认是否恢复并关联历史数据
      if (d.needConfirm) {
        closeModal();
        confirmModal('恢复历史成员',
          '「' + d.archivedName + '」此前被移除，但其历史体重记录仍保留。恢复该成员并关联历史记录？',
          async function(){
            try { await api('/api/weight/members', { method:'POST', body:{ name: name, restore: true } }); await loadAll(); alertModal('已恢复「' + d.archivedName + '」及其历史记录'); }
            catch(e){ alertModal(e.message, {ok:false}); }
          });
        return;
      }
      closeModal(); await loadAll();
    } catch(e){ alertModal(e.message, {ok:false}); }
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
  if (!requirePushChannels(wPushChannelPick)) return;
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
  if (!requirePushChannels(wPushChannelPick)) return;
  var btn = this; btn.disabled = true; btn.textContent = '推送中...';
  try { setLoadingProgress(90); var r = await api('/api/push/weight/send', { method:'POST', loadingText: '正在发送体重日报…' }); alertModal(r.message || '已推送'); }
  catch(e){ alertModal(e.message, { ok:false }); }
  finally { btn.disabled = false; btn.textContent = '立即推送'; }
});

(async function(){
  try { await loadAll(); initFilter(); await loadPush(); await initCompare(); await initShare(); }
  catch(e){ if (String(e.message).indexOf('登录')>=0) navTo('/login'); else alertModal(e.message, {ok:false}); }
})();
`;

// 体重免密填写公开页 JS
const PUBLIC_WEIGHT_JS = `
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
  var html = '<div style="color:var(--muted);font-size:13px;margin-bottom:6px;">' + mo + ' 月打卡</div><div class="wk-cal-grid">';
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
    var cell = '<span style="color:var(--muted);">—</span>';
    if (i > 0) {
      var delta = r.weight - recent[i-1].weight;
      var v = pDisplay(Math.abs(delta));
      if (delta > 0) cell = '<span style="color:var(--danger);font-weight:700;">↑ +' + v + ' ' + pLabel() + '</span>';
      else if (delta < 0) cell = '<span style="color:var(--ok);">↓ -' + v + ' ' + pLabel() + '</span>';
      else cell = '<span style="color:var(--muted);">0</span>';
    }
    return '<tr><td data-label="日期" style="padding:4px 0;text-align:left;">' + esc(r.record_date) + '</td>' +
      '<td data-label="体重" style="padding:4px 0;text-align:right;">' + pDisplay(r.weight) + ' ' + pLabel() + '</td>' +
      '<td data-label="较上次" style="padding:4px 0;text-align:right;">' + cell + '</td></tr>';
  }).reverse().join('');
  box.innerHTML = '<div style="color:var(--muted);font-size:13px;margin-bottom:4px;">最近记录</div>' +
    '<table style="width:100%;border-collapse:collapse;font-size:13px;color:var(--muted);">' +
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
    var cell = '<span style="color:var(--muted);">—</span>';
    var delta = deltaOf[r.id];
    if (delta != null) {
      var v = disp(Math.abs(delta));
      if (delta > 0) cell = '<span style="color:var(--danger);font-weight:700;">↑ +' + v + ' ' + uLabel + '</span>';
      else if (delta < 0) cell = '<span style="color:var(--ok);">↓ -' + v + ' ' + uLabel + '</span>';
      else cell = '<span style="color:var(--muted);">0</span>';
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
      '<td data-label="更新时间" class="muted">' + fmtDbTime(r.created_at) + '</td></tr>';
  }).join('') || '<tr><td colspan="5" class="muted">暂无记录</td></tr>';
}
bindQuickLogin('asset-report');
`;

// 基金持仓分布免密报告页 JS（doughnut 饼图，无需登录）
const FUND_REPORT_JS = `
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
bindLogout();
bindModal();
mountDataSwitcher('asset');
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
      ' 元 · 当前 ' + fmtMoney(goal.current, {frac:2}) + ' · 还差 <b style="color:var(--danger);">' + fmtMoney(goal.remaining, {frac:2}) + '</b>' +
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
    var netColor = row.net < 0 ? ' style="color:var(--danger);font-weight:bold;"' : '';
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
  // 排序：月度倒序，同月内按创建时间倒序（最新录入在最上）
  var sorted = records.slice().sort(function(a,b){
    if (a.month !== b.month) return b.month < a.month ? -1 : 1;
    return (b.created_at||'').localeCompare(a.created_at||'');
  });
  tb.innerHTML = sorted.map(function(r){
    return '<tr><td data-label="月份">' + r.month + '</td>' +
      '<td data-label="类型">' + (TYPE_LABEL[typeOf[r.wallet_id]] || '') + '</td>' +
      '<td data-label="钱包">' + esc(nameOf[r.wallet_id]||'') + '</td>' +
      '<td data-label="金额">' + fmtMoney(r.balance, {frac:2}) + (r.principal||r.profit ? ' <span class="muted">(本金'+ fmtMoney(r.principal, {frac:2}) +'/收益'+ fmtMoney(r.profit, {frac:2}) +')</span>' : '') + '</td>' +
      '<td data-label="更新时间" class="muted">' + fmtDbTime(r.created_at) + '</td>' +
      '<td data-label="操作"><button class="btn sm gray" onclick="recEditRow(' + r.id + ')">修改</button> ' +
        '<button class="btn sm danger" onclick="recDelRow(' + r.id + ')">删除</button></td></tr>';
  }).join('') || '<tr><td colspan="6" class="muted">暂无记录</td></tr>';
}

// 录入/修改某月记录。preset: 预填 { balance | total, profit }
// editId: 传入=修改该条记录(PUT)；不传=新增一条(POST, 弹窗内可直接选月, 保存后保留弹窗可连续录入)
function openRecModal(id, type, month, preset, editId) {
  var w = wallets.filter(function(x){return x.id===id;})[0];
  preset = preset || {};
  // 新增/修改都显示月份字段：新增时直接选月即录入(替代原"先选月份再录金额"两步)
  var monthField = '<label>月份</label><input id="fMonth" type="month" value="' + month + '">';
  var fields = type === 'investment'
    ? '<label>当前总资产(元)</label><input id="fTotal" type="number" step="0.01" value="' + (preset.total != null ? preset.total : '') + '">' +
      '<label>持有收益(元)</label><input id="fProfit" type="number" step="0.01" value="' + (preset.profit != null ? preset.profit : '') + '">' +
      '<p class="muted" id="principalHint">本金将自动计算 = 总资产 − 收益</p>'
    : '<label>本月余额(元)</label><input id="fBalance" type="number" step="0.01" value="' + (preset.balance != null ? preset.balance : '') + '">';
  // 新增模式三按钮: 保存(提交并关闭) / 连续录入(提交后弹窗保留继续录下一条) / 取消;
  // 修改模式只需 保存 / 取消(修改单条不存在"连续录入"语义)
  var actions = editId
    ? '<div style="margin-top:12px;"><button class="btn" id="recConfirm">保存</button> <button class="btn gray" onclick="closeModal()">取消</button></div>'
    : '<div style="margin-top:12px;"><button class="btn" id="recConfirm">保存</button> <button class="btn gray" id="recContinue">连续录入</button> <button class="btn gray" onclick="closeModal()">取消</button></div>';
  openModal(editId ? '修改 · ' + w.name + ' (' + month + ')' : '录入 · ' + w.name,
    monthField + fields +
    '<p class="msg ok" id="recSavedHint" style="display:none;margin:8px 0 0;">已保存，可继续录入下一条</p>' +
    actions);
  if (type === 'investment') {
    var calc = function(){
      var t = parseFloat(document.getElementById('fTotal').value)||0;
      var p = parseFloat(document.getElementById('fProfit').value)||0;
      document.getElementById('principalHint').textContent = '本金（自动）= ' + Math.round((t-p)*100)/100 + ' 元';
    };
    document.getElementById('fTotal').addEventListener('input', calc);
    document.getElementById('fProfit').addEventListener('input', calc);
  }
  // 提交表单: 校验 + POST(新增)/PUT(修改); 成功返回 true, 失败弹窗提示并返回 false
  async function submitRec() {
    var mm = document.getElementById('fMonth').value;
    if (!mm) { alertModal('请选择月份', {ok:false}); return false; }
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
      return true;
    }
    catch(e){ alertModal(e.message, {ok:false}); return false; }
  }
  // 保存: 提交成功后关闭弹窗并刷新
  document.getElementById('recConfirm').addEventListener('click', async function(){
    if (await submitRec()) { closeModal(); await loadAll(); }
  });
  // 连续录入(仅新增模式): 提交成功后弹窗保留、月份不动, 清空金额并聚焦, 后台刷新数据
  var btnContinue = document.getElementById('recContinue');
  if (btnContinue) btnContinue.addEventListener('click', async function(){
    if (!(await submitRec())) return;
    var hint = document.getElementById('recSavedHint');
    if (hint) hint.style.display = '';
    if (type === 'investment') {
      document.getElementById('fTotal').value = '';
      document.getElementById('fProfit').value = '';
      document.getElementById('principalHint').textContent = '本金将自动计算 = 总资产 − 收益';
      document.getElementById('fTotal').focus();
    } else {
      document.getElementById('fBalance').value = '';
      document.getElementById('fBalance').focus();
    }
    await loadAll();
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
      '<td data-label="更新时间" class="muted">' + fmtDbTime(r.created_at) + '</td></tr>';
  }).join('') || '<tr><td colspan="3" class="muted">该月暂无记录</td></tr>';
  openModal('记录 · ' + w.name + (month ? '（' + month + '）' : ''),
    '<table><thead><tr><th>月份</th><th>金额</th><th>更新时间</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    '<div style="margin-top:12px;"><button class="btn gray" onclick="closeModal()">关闭</button></div>');
};
// 录入本月（新增一条）
window.wRec = function(id, type){ openRecModal(id, type, curMonth(), null); };
// 录入其他月（新增一条）：与录入本月同一弹窗，月份字段直接选月，支持连续录入
window.wRecOther = function(id, type){ openRecModal(id, type, curMonth(), null); };
// 修改某条已有月度记录（按 id, 可改月份）
window.recEditRow = function(recId){
  var rec = fullRecords.filter(function(r){ return r.id===recId; })[0];
  if (!rec) return;
  var w = wallets.filter(function(x){return x.id===rec.wallet_id;})[0];
  if (!w) return;
  var preset = { balance: rec.balance, total: rec.balance, profit: rec.profit };
  openRecModal(rec.wallet_id, w.type, rec.month, preset, recId);
};
// 删除某条月度记录（确认弹窗展示该条内容：月份/类型/钱包/金额）
window.recDelRow = async function(id){
  var rec = fullRecords.filter(function(r){ return r.id===id; })[0];
  var w = rec ? wallets.filter(function(x){return x.id===rec.wallet_id;})[0] : null;
  var info = rec
    ? rec.month + ' · ' + (w ? (TYPE_LABEL[w.type]||w.type) + ' · ' + w.name : '未知钱包') +
      ' · 金额 ' + fmtMoney(rec.balance, {frac:2}) +
      (rec.principal||rec.profit ? '（本金' + fmtMoney(rec.principal, {frac:2}) + '/收益' + fmtMoney(rec.profit, {frac:2}) + '）' : '')
    : '';
  confirmModal('删除月度记录', '确定删除这条记录吗？' + (info ? '\\n' + info : ''), async function(){
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
  if (!requirePushChannels(aPushChannelPick)) return;
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
  if (!requirePushChannels(aPushChannelPick)) return;
  var btn = this; btn.disabled = true; btn.textContent = '推送中...';
  try { setLoadingProgress(90); var r = await api('/api/push/asset/send', { method:'POST', loadingText: '正在发送资产月报…' }); alertModal(r.message || '已推送'); }
  catch(e){ alertModal(e.message, { ok:false }); }
  finally { btn.disabled = false; btn.textContent = '立即推送'; }
});

(async function(){
  try { await loadAll(); initAssetFilter(); await loadPush(); }
  catch(e){ if (String(e.message).indexOf('登录')>=0) navTo('/login'); else alertModal(e.message, {ok:false}); }
})();
`;

// 资产免密录入公开页 JS
const PUBLIC_ASSET_JS = `
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
// opts 回调决定各页能力：{ today, hideDone, onToggle, onEdit, onDel, onAddChildSubmit, onShare, readOnly }
// onAddChildSubmit(node, payload) → Promise: 由业务侧封装 api + reload; 卡片/树/详情页共用同一 submitFn 通道
// 用 createElement + addEventListener，规避模板串内引号转义。
const TODO_TREE_CORE = `
// 视图三态循环: default(带页面 chrome 的默认页) → card(全屏卡片) → tree(全屏完整树) → default
// 初始化统一进全屏(用户诉求): localStorage 记录 'tree' 时沿用完整树全屏, 其他情况一律 'card' 全屏卡片;
// 退出全屏产生的 'default' 只在本会话生效, 下次页面加载再次回到全屏
var _todoView = 'card';
try { var _v = localStorage.getItem('todoView'); if (_v === 'tree') _todoView = 'tree'; } catch(e){}
// 立即给 body 打上 .todo-fs-on 类, CSS 立刻应用全屏样式(隐藏 topbar/card + 显示 #todoFullscreen),
// 避免异步 loadTodos → applyTodoView 之间出现"默认页闪一下"的视觉抖动.
// 注意: DOM 迁移(把 #todoTree 挪进全屏容器)仍在 applyTodoView 里完成, 但那之前 #todoTree 只是空壳, 用户不会察觉.
if (document.body) document.body.classList.add('todo-fs-on');
else document.addEventListener('DOMContentLoaded', function(){ document.body.classList.add('todo-fs-on'); }, { once: true });
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
// 完成祖先剪枝: 已完成的中间节点代表该支已结算, 其下叶子不再计入(整支从进度消失),
//   与 countStats 的 hasDoneAncestor / flattenPending 的 node.done 剪枝同口径
function todoLeafCount(node) {
  if (node.done) return { total: 0, done: 0 }; // 自身已完成: 整支已结算
  var total = 0, done = 0;
  (function walk(n){
    n.children.forEach(function(c){
      if (c.done && c.children.length > 0) return; // 完成的中间层: 整支剔除
      if (c.children.length === 0) { total++; if (c.done) done++; }
      else walk(c);
    });
  })(node);
  return { total: total, done: done };
}
// 前端镜像后端 todo.service.js 的 effDueOf / rootDueOf, 同口径(唯一事实源在后端):
//   todoEffDueRow(flatRow, byId): 沿 parent 链找第一个非空 due_date(自身优先; 旧模式=继承顶层日期)
//   todoRootDue(treeNode): 顶层显示日期 = 自身 due_date 优先, 否则取子树未完成节点有效日期的最小值
//     旧模式下顶层自身必有日期, 恒等于 root.due_date; 新模式(child_due)下取"最早到期的未完成子任务"
function todoEffDueRow(r, byId) {
  var cur = r, seen = {};
  while (cur) {
    if (seen[cur.id]) break;
    seen[cur.id] = 1;
    if (cur.due_date) return cur.due_date;
    cur = (cur.parent_id != null && byId[cur.parent_id]) ? byId[cur.parent_id] : null;
  }
  return null;
}
function todoRootDue(root) {
  if (root.due_date) return root.due_date;
  var min = null;
  (function walk(n, inherited){
    if (n.done) return; // 完成节点整枝不参与(与后端 rootDueOf 一致)
    var own = n.due_date || inherited;
    if (n.children.length > 0) { n.children.forEach(function(c){ walk(c, own); }); return; }
    if (own && (!min || own < min)) min = own;
  })(root, null);
  return min;
}
// 扁平 rows 中沿 parent 链找 node 的顶层主任务行(供表单判断 child_due 模式)
function todoRootRowOf(rows, node) {
  var byId = {}; rows.forEach(function(r){ byId[r.id] = r; });
  var cur = node, seen = {};
  while (cur) {
    if (seen[cur.id]) break;
    seen[cur.id] = 1;
    if (cur.parent_id == null || !byId[cur.parent_id]) return cur;
    cur = byId[cur.parent_id];
  }
  return cur;
}
// 顶层时间过滤(四套页面共享): 按顶层显示日期 todoRootDue 归类
// filter ∈ all | planned(计划中) | cur(今日+逾期) | today | overdue | future | memo | done
function todoRootPassFilter(n, filter, t) {
  var d = todoRootDue(n);
  // 计划中 = 有截止日期的任务(全部 - 备忘录): 用原始字段判断, done 不清空 due_date,
  // 故已完成的有日期任务仍属计划中(受"隐藏已完成"复选框控制显隐); child_due 容器子任务带日期也算
  if (filter === 'planned') return !!(n.due_date || n.child_due);
  if (filter === 'cur')     return !!(d && t && d <= t);
  if (filter === 'today')   return d === t;
  if (filter === 'overdue') return !!(d && t && d < t);
  if (filter === 'future')  return !!(d && t && d > t);
  if (filter === 'memo')    return !d && !n.child_due; // child_due 空容器是分组壳, 不算备忘录
  if (filter === 'done')    return !!n.done;
  return true; // all
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
  return ({ all:'全部', planned:'计划中', today:'今日', overdue:'逾期', future:'未来', memo:'备忘录', done:'已完成', cur:'今日+逾期' })[filter] || filter;
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
//   时间维度以"叶子有效截止日期(todoEffDueRow)"衡量, 不是完成日期(done_at)
//   —— 用户预期是"当月/近30天等区间到期的已完成", 完成时间可能跨月
//   旧模式叶子有效日期=顶层 due_date; 新模式(child_due)叶子用自身 due_date
//   filter 决定空间口径:
//     today          = 有效 due_date === today
//     overdue        = 有效 due_date < today
//     future         = 有效 due_date > today
//     memo           = 无有效 due_date (备忘录; 时间窗对它不适用, 直接豁免)
//     cur            = 有效 due_date <= today (今日+逾期)
//     all / done / planned = 全部有 due_date 的空间 (planned 计划中=有截止日期; 备忘录无有效日期, 被上面 !rdue 排除)
//   range 决定 due_date 时间窗: due_date 必须落在 todoRangeWindow(range, today) 闭区间内
//   memo 分支豁免时间窗(无截止日期不受"当月"约束)
// rows 为扁平数据; 只算叶子(hasChild 排除父任务)
function todoDoneByFilter(rows, filter, today, range) {
  var byId = {}; rows.forEach(function(r){ byId[r.id] = r; });
  var hasChild = {};
  rows.forEach(function(r){ if (r.parent_id != null) hasChild[r.parent_id] = 1; });
  var win = todoRangeWindow(range || 'month', today);
  var count = 0;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (hasChild[r.id]) continue; // 只算叶子
    if (!r.done) continue;
    var rdue = todoEffDueRow(r, byId);
    // memo 语义: 只统计无截止日期的备忘录, 时间窗对它无意义
    if (filter === 'memo') {
      if (rdue) continue;
      if (r.child_due) continue; // child_due 空容器是分组壳, 不算备忘录
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
// 基于可见顶层树重算 pending / overdue / memo(叶子口径, 与后端 countStats 一致)
//   叶子有效日期 = 自身 due_date 优先, 否则继承最近有日期的祖先(旧模式=顶层 due_date)
//   pending: 未完成叶子且有有效 due_date(不含备忘录)
//   overdue: 未完成叶子且有效 due_date < today
//   memo:    未完成叶子且无有效 due_date
// trees: 已按当前 _filter 过滤后的顶层数组
function todoStatsByVisible(trees, today) {
  var pending = 0, overdue = 0, memo = 0;
  function walk(node, inheritedDue) {
    if (node.done) return;
    var own = node.due_date || inheritedDue;
    if (node.children.length > 0) {
      node.children.forEach(function(c){ walk(c, own); });
      return;
    }
    if (!own) { if (!node.child_due) memo++; return; } // child_due 空容器(分组壳)不计备忘录
    pending++;
    if (today && own < today) overdue++;
  }
  trees.forEach(function(root){ walk(root, root.due_date); });
  return { pending: pending, overdue: overdue, memo: memo };
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
// 抽屉分类计数: 仅统计未完成的顶层任务(与时间筛选今日/逾期等未完成口径一致; 已完成不计)
function todoCatCounts(rows) {
  var m = { __all__: 0, __none__: 0 };
  rows.forEach(function(r){
    if (r.parent_id != null) return;
    if (r.shared_cat_id != null) return; // 共享分类任务不计入个人文本分类
    if (r.done) return; // 已完成任务不占分类计数
    m.__all__++;
    if (!r.category) m.__none__++;
    else { m[r.category] = (m[r.category] || 0) + 1; }
  });
  return m;
}
// 从 rows 提取去重排序的分类列表(仅个人文本分类, 不含共享分类)
function todoCatDistinct(rows) {
  var set = {};
  rows.forEach(function(r){ if (r.category && r.shared_cat_id == null) set[r.category] = 1; });
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
  // child_due 勾选框(仅主任务表单存在): 勾选后隐藏主任务截止日期/重复块与备忘录提示, 显示模式说明
  var cd = document.getElementById('tfChildDue');
  if (cd && !cd.__cdBound) {
    cd.__cdBound = 1;
    function syncChildDue(){
      var on = cd.checked;
      var dueWrap = document.getElementById('tfDueWrap');
      var recurWrap = document.getElementById('tfRecurWrap');
      var memoTip = document.getElementById('tfMemoTip');
      var cdTip = document.getElementById('tfChildDueTip');
      if (dueWrap) dueWrap.style.display = on ? 'none' : 'block';
      if (recurWrap) recurWrap.style.display = on ? 'none' : 'block';
      if (memoTip) memoTip.style.display = on ? 'none' : 'block';
      if (cdTip) cdTip.style.display = on ? 'block' : 'none';
    }
    cd.addEventListener('change', syncChildDue);
    syncChildDue();
  }
}
// 弹窗内分类下拉填充: 先清空 sel 里除固定项外的所有 option, 再插入现有分类
// currentValue 为当前任务的分类(编辑时非空); 若不在下拉列表则动态插入并选中
// opts.disableShared: 编辑任务/子任务表单中禁用共享分类选项(归属不可改; 子任务继承父任务分类)
function todoFillCategoryOptions(rows, currentValue, opts) {
  opts = opts || {};
  var sel = document.getElementById('tfCatSel');
  if (!sel) return;
  // 固定两项: '' (无分类) / '__new__' (新建)
  var frag = document.createDocumentFragment();
  var optNone = document.createElement('option'); optNone.value = ''; optNone.textContent = '（无分类）'; frag.appendChild(optNone);
  var cats = todoCatDistinct(rows);
  if (currentValue && currentValue.indexOf('sc:') !== 0 && cats.indexOf(currentValue) < 0) cats.push(currentValue);
  cats.forEach(function(c){
    var o = document.createElement('option'); o.value = c; o.textContent = c; frag.appendChild(o);
  });
  var optNew = document.createElement('option'); optNew.value = '__new__'; optNew.textContent = '➕ 新建分类…'; frag.appendChild(optNew);
  // 共享分类(仅登录态页面有 _sharedCats; 免密页为空不渲染): value='sc:<catId>'
  var scs = (typeof _sharedCats !== 'undefined' && _sharedCats) ? _sharedCats : [];
  if (scs.length) {
    var og = document.createElement('optgroup');
    og.label = '👥 共享分类';
    scs.forEach(function(c){
      var o = document.createElement('option');
      o.value = 'sc:' + c.cat_id;
      o.textContent = '👥 ' + c.name + (c.role === 'owner' ? '' : ' · ' + c.owner_name);
      if (opts.disableShared) o.disabled = true;
      og.appendChild(o);
    });
    frag.appendChild(og);
  }
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
      // 「全部」悬浮明细: 未完成(=计划中数量) / 备忘录 / 已完成; 三项互斥且之和等于全部
      if (key === 'all') {
        it.title = '未完成（计划中）：' + timeCounts.planned +
          '｜备忘录：' + timeCounts.memo +
          '｜已完成：' + timeCounts.done;
      }
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
  // renameFn(key)/delFn(key): 传入时该项尾部渲染 ✎ 改名 / ✕ 删除按钮
  //   (仅登录态页面定义了全局 onTodoRenameCat/onTodoDeleteCat; 免密页无此函数即无入口)
  function addItem(key, label, icon, delFn, renameFn) {
    var it = document.createElement('div');
    it.className = 'todo-drawer__item' + (cur === key ? ' active' : '');
    it.setAttribute('data-key', key);
    var l = document.createElement('span'); l.className = 'todo-drawer__label'; l.textContent = (icon ? icon + ' ' : '') + label;
    var c = document.createElement('span'); c.className = 'todo-drawer__count'; c.textContent = '(' + (counts[key] || 0) + ')';
    it.appendChild(l); it.appendChild(c);
    if (renameFn) {
      var e = document.createElement('button');
      e.className = 'todo-drawer__edit';
      e.type = 'button';
      e.textContent = '✎';
      e.title = '重命名分类';
      e.addEventListener('click', function(ev){ ev.stopPropagation(); renameFn(key); });
      it.appendChild(e);
    }
    if (delFn) {
      var d = document.createElement('button');
      d.className = 'todo-drawer__del';
      d.type = 'button';
      d.textContent = '✕';
      d.title = '删除分类（任务转为未分类）';
      d.addEventListener('click', function(ev){ ev.stopPropagation(); delFn(key); });
      it.appendChild(d);
    }
    it.addEventListener('click', function(){ if (onSelect) onSelect(key); });
    section3.appendChild(it);
  }
  addItem('__all__', '全部', '📋');
  addItem('__none__', '未分类', '📌');
  var catDelFn = (typeof onTodoDeleteCat === 'function') ? onTodoDeleteCat : null;
  var catRenameFn = (typeof onTodoRenameCat === 'function') ? onTodoRenameCat : null;
  cats.forEach(function(c){ addItem(c, c, null, catDelFn, catRenameFn); });
  box.appendChild(section3);

  // 共享分类段(仅登录态页面有 _sharedCats 数据; 免密页为空数组即不渲染)
  // key='sc:<catId>', 由 todoRowsByCategory 按 shared_cat_id 筛选; 计数为该分类下未完成的顶层任务数
  var scs = (typeof _sharedCats !== 'undefined' && _sharedCats) ? _sharedCats : [];
  if (scs.length) {
    // 一次遍历统计各共享分类未完成的顶层任务数与其中的备忘录数, 避免每个分类都 filter 全量 rows
    // 备忘录口径同时间筛选: 未完成 + 无截止日期 + 非 child_due 容器
    var scCount = {};
    var scMemo = {};
    rows.forEach(function(r){
      if (r.parent_id == null && r.shared_cat_id != null && !r.done) {
        scCount[r.shared_cat_id] = (scCount[r.shared_cat_id] || 0) + 1;
        if (!r.due_date && !r.child_due) scMemo[r.shared_cat_id] = (scMemo[r.shared_cat_id] || 0) + 1;
      }
    });
    var section4 = document.createElement('div');
    section4.className = 'todo-drawer__section';
    var title4 = document.createElement('div');
    title4.className = 'todo-drawer__section-title';
    title4.textContent = '👥 共享分类';
    section4.appendChild(title4);
    scs.forEach(function(c){
      var key = 'sc:' + c.cat_id;
      var it = document.createElement('div');
      it.className = 'todo-drawer__item' + (cur === key ? ' active' : '');
      var l = document.createElement('span');
      l.className = 'todo-drawer__label';
      l.textContent = '👥 ' + c.name + (c.role === 'owner' ? '' : ' · ' + c.owner_name);
      var cc = document.createElement('span');
      cc.className = 'todo-drawer__count';
      cc.textContent = '(' + (scCount[c.cat_id] || 0) + ')';
      // 悬浮明细: 计划中(=该分类视图下"计划中"筛选数量) / 备忘录; 两者之和=括号内未完成总数
      it.title = '未完成（计划中）：' + ((scCount[c.cat_id] || 0) - (scMemo[c.cat_id] || 0)) +
        '｜备忘录：' + (scMemo[c.cat_id] || 0);
      it.appendChild(l); it.appendChild(cc);
      it.addEventListener('click', function(){ if (onSelect) onSelect(key); });
      section4.appendChild(it);
    });
    box.appendChild(section4);
  }

  var foot = document.getElementById('drawerFoot');
  if (foot) foot.textContent = '共 ' + cats.length + ' 个分类' + (scs.length ? ' · ' + scs.length + ' 个共享' : '');
}
// 时间维度顶层任务计数(顶层口径, 与 todoFilterTrees 同): 全部/计划中/今日+逾期/今日/逾期/未来/备忘录/已完成
// 只统计顶层任务, 日期取顶层显示日期 todoRootDue(旧模式=自身 due_date; 新模式=最早到期子任务), 不重复计数
// 桶互斥: 已完成任务归入 done, 不再计入 overdue/today/future/memo
// cur = today + overdue (与 filter=cur 的口径一致, 已完成不计入)
// planned = 有截止日期(全部-备忘录), 与 todoRootPassFilter 的 planned 同口径(含已完成有日期任务)
function todoTimeCounts(rows) {
  var today = new Date(Date.now() + 8*3600*1000).toISOString().slice(0,10);
  var m = { all: 0, planned: 0, cur: 0, today: 0, overdue: 0, future: 0, memo: 0, done: 0 };
  todoBuildTree(rows).forEach(function(r){
    m.all++;
    if (r.done) { m.done++; return; } // 已完成仅进 done 桶; 计划中等未完成口径不计
    if (r.due_date || r.child_due) m.planned++; // 计划中(仅未完成): 顶层自身有日期 或 child_due 容器(子任务带日期)
    var due = todoRootDue(r);
    if (!due) { if (!r.child_due) m.memo++; return; } // child_due 空容器(分组壳)不计备忘录
    if (due === today) { m.today++; m.cur++; }
    else if (due < today) { m.overdue++; m.cur++; }
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
// 数据变化(勾选/增删改, loadTodos 收尾)后用最新 rows 重算抽屉计数:
// applyTodoView 仅在切视图/筛选时重算抽屉, 不随 loadTodos 执行, 否则勾选后计数停在旧值(已完成仍被计数)。
// 仅全屏态且抽屉容器存在时重绘内容(不动开合状态); onSelect 复用最近一次 applyTodoView 的上下文。
function refreshTodoDrawer(rows) {
  if (_todoView === 'default') return;
  var box = document.getElementById('drawerList');
  if (!box) return;
  renderTodoDrawer(rows, function(key){
    _todoCategory = key === '__all__' ? null : key;
    if (window.innerWidth <= 640) {
      _todoDrawerOpen = false;
      try { localStorage.setItem('todoDrawer', '0'); } catch(e){}
    }
    applyTodoView(_todoEscCtx.getRows, _todoEscCtx.onDraw);
  });
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
  // 共享分类段: key='sc:<catId>', 整棵任务树(含子孙)都带 shared_cat_id, 直接按值筛
  if (_todoCategory.indexOf('sc:') === 0) {
    var cid = Number(_todoCategory.slice(3));
    return rows.filter(function(r){ return r.shared_cat_id === cid; });
  }
  var pass = {}, out = [];
  // 第一遍: 挑符合的顶层(个人文本分类; 共享分类任务不进个人分类)
  rows.forEach(function(r){
    if (r.parent_id != null) return;
    if (r.shared_cat_id != null) return;
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
  // 给每个节点挂顶层主任务指针 _root, 供渲染徽章/内联添加表单读取 child_due 模式
  // 注意: 必须用函数声明(或具名函数表达式后立即赋值给变量), 不能写 (function tag(){...});
  // 命名函数表达式的名字只在函数自身作用域可见, 外部 forEach 里调 tag 会 ReferenceError
  function tag(n, root) {
    n._root = root;
    n.children.forEach(function(c){ tag(c, root); });
  }
  roots.forEach(function(r){ tag(r, r); });
  // 顶层按显示截止日期倒序（有日期的越晚越靠前，无日期排最后）；同日期或子任务按 sort_order+id
  // 显示日期取 todoRootDue: 旧模式=自身 due_date; 新模式=最早到期的未完成子任务
  roots.sort(function(a, b){
    var ad = todoRootDue(a) || '', bd = todoRootDue(b) || '';
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
// 子树是否仍进行中（完成节点代表整枝结束，后代状态仅保留、不参与未完成展示）
function todoSubtreePending(node){
  return !node.done;
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
    // 有效截止日期：自身 due_date 优先，否则继承祖先（rootDue）。
    // 旧模式子任务自身无日期 → 继承顶层；新模式(child_due)子任务有自身日期 → 显示自身。
    // 详情页（显式传 forcedRootDue）首层是 root 的直接子任务，rootDue 由 forcedRootDue 兜底，
    // 否则 depth=0 取到子任务自身 null 会让孙任务继承到 null 被判成备忘录而不显示勾选框。
    var isDetail = Object.prototype.hasOwnProperty.call(opts, 'forcedRootDue');
    var effDue = node.due_date || rootDue;
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

    // 备忘录子任务（自身与祖先均无有效截止日期）不显示完成按钮
    var isMemoChild = !effDue && (depth > 0 || Object.prototype.hasOwnProperty.call(opts, 'forcedRootDue'));
    if (!isMemoChild) {
      // 圆形勾选框（点击立即禁用防重，onToggle 完成后由重绘替换掉本按钮）
      var check = document.createElement('button');
      check.type = 'button';
      check.className = 'todo-check' + (node.done ? ' done' : '');
      check.title = node.done ? '取消完成' : '标记完成';
      if (opts.onToggle) check.addEventListener('click', async function(e){
        e.stopPropagation();
        if (check.disabled) return;
        // 重复任务从未完成→完成: 由页面侧弹选择器决定 jumpToCurrent
        // 旧模式重复在顶层; 新模式(child_due)重复可在叶子子任务上, 哪个节点有 recurrence 就弹哪个
        if (node.recurrence && !node.done && opts.onToggleRecur) {
          opts.onToggleRecur(node);
          return;
        }
        check.disabled = true;
        check.setAttribute('data-busy', '1');
        try { await opts.onToggle(node, !node.done); }
        finally { check.disabled = false; check.removeAttribute('data-busy'); }
      });
      row.appendChild(check);
    }

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
    // 共享分类任务(顶层行且 shared_cat_id 非空)标题前加 👥; 个人任务不显示
    title.textContent = (depth === 0 && node.shared_cat_id != null ? '👥 ' : '') + node.title;
    if (hasChildren) {
      var lc = todoLeafCount(node);
      // total=0 = 整支已完成结算, 不再显示进度
      if (lc.total > 0) {
        var cnt = document.createElement('span');
        cnt.className = 'todo-count';
        cnt.textContent = '(' + lc.done + '/' + lc.total + ')';
        title.appendChild(cnt);
      }
    }
    main.appendChild(title);
    var meta = document.createElement('div');
    meta.className = 'todo-meta';
    if (node.category) {
      var cc = document.createElement('span'); cc.className = 'todo-chip cat'; cc.textContent = node.category; meta.appendChild(cc);
    }
    // 日期 chip：已完成也显示；逾期(未完成且过期)标红
    // 显示口径: 完整树顶层行(depth 0 且非详情页)展示子树最早到期日 todoRootDue(新模式主任务自身无日期);
    //   其余行展示有效日期 effDue(自身优先, 否则继承祖先自身日期; 继承链不能用兄弟最小日期)
    var chipDue = (depth === 0 && !isDetail) ? todoRootDue(node) : effDue;
    if (chipDue) {
      var over = !node.done && today && chipDue < today;
      var dc = document.createElement('span');
      dc.className = 'todo-chip due' + (over ? ' overdue' : '');
      dc.innerHTML = (over ? (ICONS.warn + '逾期 ') : ICONS.calendar) + esc(todoDateLabel(chipDue, today));
      meta.appendChild(dc);
    }
    // 完成时间 chip：已完成且有完成日期时显示
    if (node.done && node.done_at) {
      var doneC = document.createElement('span');
      doneC.className = 'todo-chip done-at';
      doneC.innerHTML = ICONS.check_circle + '完成于 ' + esc(node.done_at);
      meta.appendChild(doneC);
    }
    // 重复徽章: 哪个节点设了重复就显示在哪个节点(旧模式仅顶层; 新模式可在叶子子任务上)
    if (node.recurrence) {
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
      // 规则: "真顶层任务(顶层清单/完整树的 depth 0)"不给手柄, 但详情页里的 depth 0 其实是 root 的直接子任务
      // 判据: opts.forcedRootDue key 是否显式设置(详情页调用时会设, 无论值是不是 null); 用 hasOwnProperty 严判避免误伤备忘录清单
      var dragHandle = null;
      var isDetailChild = Object.prototype.hasOwnProperty.call(opts, 'forcedRootDue');
      var isRealRoot = depth === 0 && !isDetailChild;
      if (opts.onReorder && !isRealRoot) {
        dragHandle = document.createElement('button');
        dragHandle.type = 'button'; dragHandle.className = 'todo-op todo-drag'; dragHandle.title = '拖动排序';
        dragHandle.innerHTML = ICONS.drag;
        ops.appendChild(dragHandle);
      }
      // 完整树视图内的"添加子任务": 走同一 onAddChildSubmit 通道, 内联在该行下方
      if (opts.onAddChildSubmit) {
        var b1 = mkOp(ICONS.plus, '添加子任务', function(){
          openInlineAddChild(b1, node, function(payload){ return opts.onAddChildSubmit(node, payload); });
        });
        ops.appendChild(b1);
      }
      if (opts.onDetail || opts.onEdit) { var b2 = mkOp(ICONS.view, '查看详情', function(){ (opts.onDetail || opts.onEdit)(node); }); ops.appendChild(b2); }
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
  // 顶层任务的继承日期: 优先 opts.forcedRootDue(详情页明确传入); 否则用顶层自身 due_date
  // 不能传 todoRootDue(子树最小日期): 否则新模式下无自身日期的子任务会错误继承兄弟的日期
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

    // 勾选框：主任务无论有无子任务都显示；readOnly 时始终不显示
    if (!opts.readOnly && opts.onToggle) {
      var check = document.createElement('button');
      check.type = 'button';
      check.className = 'todo-card__check' + (root.done ? ' done' : '');
      check.title = root.done ? '取消完成' : '标记完成';
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

    // 标题（共享分类任务加 👥; 个人任务不显示）
    var title = document.createElement('div');
    title.className = 'todo-card__title';
    title.textContent = (root.shared_cat_id != null ? '👥 ' : '') + root.title;
    head.appendChild(title);
    body.appendChild(head);

    // meta 行：分类 + 日期 + 叶子进度 chip
    var meta = document.createElement('div'); meta.className = 'todo-card__meta';
    if (root.category) {
      var cc = document.createElement('span'); cc.className = 'todo-chip cat'; cc.textContent = root.category; meta.appendChild(cc);
    }
    // 卡片日期: 顶层显示日期 todoRootDue(旧模式=root.due_date; 新模式=最早到期的未完成子任务)
    var rootDue = todoRootDue(root);
    if (rootDue) {
      var over = !root.done && today && rootDue < today;
      var dc = document.createElement('span');
      dc.className = 'todo-chip due' + (over ? ' overdue' : '');
      dc.innerHTML = (over ? (ICONS.warn + '逾期 ') : ICONS.calendar) + esc(todoDateLabel(rootDue, today));
      meta.appendChild(dc);
    }
    if (root.done && root.done_at) {
      var doneC = document.createElement('span');
      doneC.className = 'todo-chip done-at';
      doneC.innerHTML = ICONS.check_circle + '完成于 ' + esc(root.done_at);
      meta.appendChild(doneC);
    }
    // 重复徽章: 主任务自身重复(旧模式)或子树中任一节点重复(新模式叶子重复), 取第一个用于展示
    var recurNode = root.recurrence ? root : null;
    if (!recurNode) {
      (function find(n){
        for (var i = 0; i < n.children.length; i++) {
          var c = n.children[i];
          if (c.recurrence) { recurNode = c; return; }
          find(c);
          if (recurNode) return;
        }
      })(root);
    }
    if (recurNode) {
      var rc = document.createElement('span');
      rc.className = 'todo-chip repeat';
      rc.innerHTML = ICONS.repeat + esc(todoRecurLabel(recurNode.recurrence, recurNode.recur_interval, recurNode.recur_nth, recurNode.recur_weekday));
      meta.appendChild(rc);
    }
    if (hasChildren) {
      var lc = todoLeafCount(root);
      // total=0 = 整支已完成结算, 不再显示进度 chip
      if (lc.total > 0) {
        var pc = document.createElement('span');
        pc.className = 'todo-chip todo-card__count' + (lc.done === lc.total ? ' done' : '');
        pc.textContent = '📋 ' + lc.done + '/' + lc.total;
        meta.appendChild(pc);
      }
    }
    if (meta.childNodes.length) body.appendChild(meta);

    // 备注单行截断（有则显示）
    if (root.note) {
      var noteEl = document.createElement('div');
      noteEl.className = 'todo-card__note';
      noteEl.textContent = root.note;
      body.appendChild(noteEl);
    }

    // 卡片视图只显示主任务（顶层），子任务通过整卡点击进入详情后在树视图中查看/勾选/管理
    card.appendChild(body);

    // 底部操作 + 进入指示
    if (!opts.readOnly || canEnter) {
      var foot = document.createElement('div'); foot.className = 'todo-card__foot';
      var ops = document.createElement('div'); ops.className = 'todo-card__ops';
      if (!opts.readOnly) {
        // 顶层卡片"添加子任务"入口: 点击就地内联输入(卡片下方), 不进详情不弹窗
        if (opts.onAddChildSubmit) {
          var addChildBtn = mkCardOp(ICONS.plus, '添加子任务', function(){
            openInlineAddChild(addChildBtn, root, function(payload){ return opts.onAddChildSubmit(root, payload); });
          });
          ops.appendChild(addChildBtn);
        }
        if (opts.onDetail || opts.onEdit) ops.appendChild(mkCardOp(ICONS.view, '查看详情', function(){ (opts.onDetail || opts.onEdit)(root); }));
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
// 详情页"完成主任务/取消完成"文字链: 优先挂到 #todoTreeHome 后紧邻的 <p class="muted"> 提示文末尾
// 若页面无该提示文(免密页/报告页/全屏视图等), 兜底在 #todoTreeHome 末尾追加独立一行文字链
// 只读页(无 onToggle)不渲染; 未完成的顶层重复任务点击后走 onToggleRecur 弹窗(与卡片勾选框一致)
function todoAttachDoneLinkToTip(container, root, opts) {
  if (!opts.onToggle || opts.readOnly) return;
  var homeBox = container.parentNode;
  if (!homeBox) return;
  // 只找 #todoTreeHome 后紧邻的兄弟节点里第一个 <p class="muted">, 不跨 card 边界
  var tipEl = null, sib = homeBox.nextElementSibling;
  while (sib) {
    if (sib.tagName === 'P' && sib.classList && sib.classList.contains('muted')) { tipEl = sib; break; }
    sib = sib.nextElementSibling;
  }
  var link = document.createElement('button');
  link.type = 'button';
  link.className = 'todo-detail-done';
  link.textContent = root.done ? '↺ 取消完成' : '✓ 完成主任务';
  link.addEventListener('click', async function(e){
    e.stopPropagation();
    if (link.disabled) return;
    if (root.recurrence && root.parent_id == null && !root.done && opts.onToggleRecur) {
      opts.onToggleRecur(root);
      return;
    }
    link.disabled = true;
    link.setAttribute('data-busy', '1');
    try { await opts.onToggle(root, !root.done); }
    finally { link.disabled = false; link.removeAttribute('data-busy'); }
  });
  if (tipEl) {
    // 命中提示文: 追加到文字流末尾, 与提示同段同行
    link.style.cssText = 'background:none;border:0;padding:2px 6px;margin-left:8px;color:var(--muted);font-size:12px;text-decoration:underline;cursor:pointer;';
    tipEl.appendChild(link);
  } else {
    // 无提示文兜底: 独立一行, 靠右轻量文字链(免密页/报告页/全屏视图)
    link.style.cssText = 'background:none;border:0;padding:6px 8px;color:var(--muted);font-size:12px;text-decoration:underline;cursor:pointer;';
    var wrap = document.createElement('div');
    wrap.className = 'todo-detail-done-wrap';
    wrap.style.cssText = 'text-align:right;margin:12px 0 4px;';
    wrap.appendChild(link);
    homeBox.appendChild(wrap);
  }
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

  // 每次渲染先清理详情页"完成主任务"文字链, 由详情分支按需重新挂载
  // 命中提示文时按钮挂在 .card 内的 <p> 里(homeBox.parentNode 范围), 兜底时挂在 homeBox 末尾
  var homeBox = container.parentNode;
  if (homeBox) {
    var scope = homeBox.parentNode || homeBox;
    var oldLink = scope.querySelector('.todo-detail-done');
    if (oldLink) oldLink.parentNode.removeChild(oldLink);
    var oldWrap = scope.querySelector('.todo-detail-done-wrap');
    if (oldWrap) oldWrap.parentNode.removeChild(oldWrap);
  }

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
    // 把"完成主任务"链挂到提示文末尾(命中主页 <p class="muted">); 无提示文时兜底独立一行
    // 无论哪种, 面包屑都不再放该按钮, 顶栏永远只有「← 返回 | 标题 | ➕ 添加子任务」
    todoAttachDoneLinkToTip(container, root, opts);
    if (crumb) {
      crumb.style.display = 'flex';
      crumb.innerHTML = '';
      var back = document.createElement('button');
      back.type = 'button'; back.className = 'todo-crumb__back';
      back.textContent = '← 返回';
      back.addEventListener('click', function(){ if (opts.onExitDetail) opts.onExitDetail(); });
      var t = document.createElement('div');
      t.className = 'todo-crumb__title';
      t.textContent = (root.shared_cat_id != null ? '👥 ' : '') + root.title;
      crumb.appendChild(back);
      crumb.appendChild(t);
      // "完成主任务"入口不放这里(已由 todoAttachDoneLinkToTip 挂到提示文末尾或独立一行)
      // "添加子任务"入口不再放面包屑, 改为详情页子任务列表底部常驻输入行(MS To Do 风格, 见下面 mountDetailAdder)
    }
    // 详情页只渲染 root 的子任务，避免与面包屑标题重复; 首层子任务视作 depth 0 但截止日期继承 root
    // root 无子任务时也保留底部 "添加子任务" 常驻行, 而不是空态提示
    if (root.children.length === 0) {
      container.className = 'todo-tree';
      container.innerHTML = '';
    } else {
      var childOpts = {};
      for (var k in opts) if (Object.prototype.hasOwnProperty.call(opts, k)) childOpts[k] = opts[k];
      childOpts.startDepth = 0;
      // 详情页首层子任务的继承日期: 顶层自身日期(旧模式=root.due_date; 新模式 root 无日期→null,
      // 无自身日期的子任务即备忘录, 与后端 effDueOf 沿祖先链继承的口径一致)
      childOpts.forcedRootDue = root.due_date;
      renderTodoTree(container, root.children, childOpts);
    }
    // 底部常驻"+ 添加子任务": 只在支持添加(非只读)时挂载; 追加在子任务列表末尾
    if (opts.onAddChildSubmit) {
      mountDetailAdder(container, root, function(payload){
        return opts.onAddChildSubmit(root, payload);
      });
    }
    return;
  }
  // 卡片列表
  if (crumb) crumb.style.display = 'none';
  renderTodoCards(container, trees, opts);
}
// 手机键盘弹起时把输入框"上移"到可视视区内(修复添加框被键盘盖住):
// 先 scrollIntoView, 再按 visualViewport 底边补差, 优先滚动最近的可滚动祖先(全屏区/弹窗遮罩), 兜底 window.scrollBy
function todoLiftIntoView(el) {
  if (!el) return;
  try { el.scrollIntoView({ block: 'nearest' }); } catch (e) {}
  var vv = window.visualViewport;
  if (!vv) return;
  var r = el.getBoundingClientRect();
  var delta = r.bottom - (vv.offsetTop + vv.height) + 16; // 可视视口底边(布局坐标) + 16px 余量
  if (delta <= 0) return;
  for (var p = el.parentElement; p; p = p.parentElement) {
    var s = getComputedStyle(p);
    if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && p.scrollHeight > p.clientHeight) {
      p.scrollTop += delta;
      return;
    }
  }
  window.scrollBy(0, delta);
}
// 添加框单例: 同一时刻画面上只允许一个"添加子任务"输入框(内联框 openInlineAddChild 与
// 详情页底部常驻框 mountDetailAdder 互斥); 打开新框时注册, 注册动作先关掉旧框
var _todoAddFormCloser = null;
function todoRegisterAddForm(closeFn) {
  if (_todoAddFormCloser && _todoAddFormCloser !== closeFn) {
    try { _todoAddFormCloser(); } catch (e) {}
  }
  _todoAddFormCloser = closeFn;
}
function todoUnregisterAddForm(closeFn) {
  if (_todoAddFormCloser === closeFn) _todoAddFormCloser = null;
}
// 内联添加框用的自包含"重复规则"控件(与编辑弹窗 todoFormHtml 同口径, 无 id 避免多实例冲突):
// 不重复 / 每日 / 每周 / 每月(按日期) / 每月第 N 个星期 X / 每年, 含"每 N 单位"数字框与 nth/星期双下拉
// 返回 { el, get() }; get() → { recurrence, recur_interval, recur_nth, recur_weekday }(不重复时全 null)
function todoBuildRecurControl() {
  var root = document.createElement('div');
  root.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:4px 0;flex:1 1 100%;';
  var sel = document.createElement('select');
  sel.style.cssText = 'padding:4px 8px;flex:1;min-width:150px;';
  [['', '不重复'], ['daily', '每日'], ['weekly', '每周'], ['monthly', '每月 (按日期, 如每月 5 号)'],
   ['monthly_nth_weekday', '每月第 N 个星期 X'], ['yearly', '每年']].forEach(function(o){
    var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; sel.appendChild(op);
  });
  var nBox = document.createElement('span');
  nBox.style.cssText = 'display:none;align-items:center;gap:4px;color:var(--muted);font-size:13px;';
  var nInput = document.createElement('input');
  nInput.type = 'number'; nInput.min = '1'; nInput.max = '99'; nInput.value = '1';
  nInput.style.cssText = 'width:58px;padding:4px 6px;text-align:center;';
  var unit = document.createElement('span');
  nBox.appendChild(document.createTextNode('每')); nBox.appendChild(nInput); nBox.appendChild(unit);
  var nthWrap = document.createElement('div');
  nthWrap.style.cssText = 'display:none;gap:8px;align-items:center;flex-basis:100%;flex-wrap:wrap;';
  var nthSel = document.createElement('select'); nthSel.style.cssText = 'padding:4px 8px;flex:1;min-width:110px;';
  [['1', '第一个'], ['2', '第二个'], ['3', '第三个'], ['4', '第四个'], ['5', '最后一个']].forEach(function(o){
    var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; nthSel.appendChild(op);
  });
  var wdSel = document.createElement('select'); wdSel.style.cssText = 'padding:4px 8px;flex:1;min-width:110px;';
  [['1', '周一'], ['2', '周二'], ['3', '周三'], ['4', '周四'], ['5', '周五'], ['6', '周六'], ['0', '周日']].forEach(function(o){
    var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; wdSel.appendChild(op);
  });
  nthWrap.appendChild(document.createTextNode('的')); nthWrap.appendChild(nthSel); nthWrap.appendChild(wdSel);
  root.appendChild(sel); root.appendChild(nBox); root.appendChild(nthWrap);
  var UNITS = { daily: '天', weekly: '周', monthly: '月', monthly_nth_weekday: '月', yearly: '年' };
  function sync() {
    var v = sel.value;
    nBox.style.display = v ? 'inline-flex' : 'none';
    if (v) unit.textContent = UNITS[v] || '天';
    nthWrap.style.display = (v === 'monthly_nth_weekday') ? 'flex' : 'none';
  }
  sel.addEventListener('change', sync); sync();
  function get() {
    var v = sel.value;
    if (!v) return { recurrence: null, recur_interval: null, recur_nth: null, recur_weekday: null };
    var iv = parseInt(nInput.value, 10);
    if (!isFinite(iv) || iv < 1) iv = 1;
    if (iv > 99) iv = 99;
    var out = { recurrence: v, recur_interval: iv, recur_nth: null, recur_weekday: null };
    if (v === 'monthly_nth_weekday') {
      out.recur_nth = parseInt(nthSel.value, 10);
      out.recur_weekday = parseInt(wdSel.value, 10);
    }
    return out;
  }
  return { el: root, get: get };
}
// 内联子任务添加输入行(卡片视图 / 完整树视图): 收 标题(必填) + 截止日期(child_due 模式必填, 默认今天)
// + 重复规则(child_due 模式, 与编辑弹窗同口径) + 备注(可选).
// btnEl: 触发按钮 DOM, 用来定位"就近宿主"(优先卡片, 其次树节点行, 输入行插到宿主下方一行)
// parentNode: 数据节点; submitFn(payload)-> Promise (业务侧决定 API endpoint 和 reload)
// 详情页不用此函数, 详情页用 mountDetailAdder 在子任务列表末尾常驻一个输入行(MS To Do 风格)
function openInlineAddChild(btnEl, parentNode, submitFn) {
  if (!btnEl || !parentNode || typeof submitFn !== 'function') return;
  // 就近宿主: 卡片视图 → .todo-card; 完整树视图 → .todo-node
  var host = btnEl.closest ? (btnEl.closest('.todo-card') || btnEl.closest('.todo-node')) : null;
  if (!host || !host.parentNode) return;
  // 幂等: 同宿主下已有活跃输入行则直接聚焦并抬升到键盘上方
  var exist = host.nextElementSibling;
  if (exist && exist.classList && exist.classList.contains('todo-inline-add')) {
    var f0 = exist.querySelector('input, textarea');
    if (f0) { f0.focus(); todoLiftIntoView(exist); }
    return;
  }
  // child_due 新模式主任务下, 子任务可快速设置截止日期与重复(与编辑弹窗同口径, 含高级重复规则)
  var childDueMode = !!(parentNode._root && parentNode._root.child_due);
  var box = document.createElement('div');
  box.className = 'todo-inline-add';
  var titleEl = document.createElement('textarea');
  titleEl.rows = 1; titleEl.placeholder = '子任务标题(支持换行)'; titleEl.className = 'todo-inline-add__title';
  var noteEl = document.createElement('textarea');
  noteEl.rows = 1; noteEl.placeholder = '备注(可选)'; noteEl.className = 'todo-inline-add__note';
  var dueEl = null, recurCtl = null;
  if (childDueMode) {
    var optRow = document.createElement('div');
    optRow.className = 'todo-inline-add__opts';
    optRow.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:4px 0;';
    dueEl = document.createElement('input');
    dueEl.type = 'date'; dueEl.className = 'todo-inline-add__due';
    dueEl.style.cssText = 'padding:4px 8px;';
    dueEl.value = todoTodayStr(); // 与编辑弹窗一致: 截止日期默认今天
    recurCtl = todoBuildRecurControl();
    optRow.appendChild(dueEl); optRow.appendChild(recurCtl.el);
    box.appendChild(optRow);
  }
  var actions = document.createElement('div'); actions.className = 'todo-inline-add__actions';
  var saveBtn = document.createElement('button'); saveBtn.type = 'button'; saveBtn.className = 'btn sm'; saveBtn.textContent = '保存';
  var cancelBtn = document.createElement('button'); cancelBtn.type = 'button'; cancelBtn.className = 'btn sm gray'; cancelBtn.textContent = '取消';
  var hint = document.createElement('span'); hint.className = 'todo-inline-add__hint muted';
  hint.textContent = childDueMode ? '可设置截止日期与重复' : '继承主任务的日期/优先级/分类';
  actions.appendChild(saveBtn); actions.appendChild(cancelBtn); actions.appendChild(hint);
  box.insertBefore(titleEl, box.firstChild); box.appendChild(noteEl); box.appendChild(actions);
  host.parentNode.insertBefore(box, host.nextSibling);
  autoGrowTextarea(titleEl); autoGrowTextarea(noteEl);
  // 单例: 注册关闭动作(打开本框会自动关掉画面上其它添加框); 键盘弹起时把输入框抬到可视区
  function onVV() { if (box.isConnected) todoLiftIntoView(box); }
  function close() {
    if (box.parentNode) box.parentNode.removeChild(box);
    if (window.visualViewport) window.visualViewport.removeEventListener('resize', onVV);
    todoUnregisterAddForm(close);
  }
  todoRegisterAddForm(close);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', onVV);
  setTimeout(function(){ titleEl.focus(); todoLiftIntoView(box); }, 50);

  async function submit() {
    var title = (titleEl.value || '').trim();
    if (!title) { alertModal('请填写子任务标题', { ok: false }); titleEl.focus(); return; }
    // child_due 模式: 截止日期必填(默认今天, 被清空则拦截)
    if (childDueMode && dueEl && !dueEl.value) { alertModal('请选择截止日期（默认今天）', { ok: false }); dueEl.focus(); return; }
    if (saveBtn.disabled) return;
    saveBtn.disabled = true; cancelBtn.disabled = true;
    var payload = { title: title, parent_id: parentNode.id };
    var note = (noteEl.value || '').trim();
    if (note) payload.note = note;
    if (childDueMode) {
      payload.due_date = dueEl.value ? dueEl.value : null;
      var r = recurCtl.get();
      if (r.recurrence) {
        payload.recurrence = r.recurrence;
        payload.recur_interval = r.recur_interval;
        payload.recur_nth = r.recur_nth;
        payload.recur_weekday = r.recur_weekday;
      }
    }
    try {
      await submitFn(payload);
      close();
    } catch (err) {
      saveBtn.disabled = false; cancelBtn.disabled = false;
      if (typeof alertModal === 'function') alertModal((err && err.message) || '保存失败', {ok:false});
    }
  }
  saveBtn.addEventListener('click', submit);
  cancelBtn.addEventListener('click', close);
  // Enter 交给 textarea 默认换行行为, 不再拦截保存; 只保留 Esc 取消
  titleEl.addEventListener('keydown', function(e){ if (e.key === 'Escape') { e.preventDefault(); close(); } });
  noteEl.addEventListener('keydown', function(e){ if (e.key === 'Escape') { e.preventDefault(); close(); } });
}
// 详情页底部常驻"+ 添加子任务"行(MS To Do 风格): 追加在子任务列表末尾, 点击占位符展开为输入框
// 有内容时回车/失焦保存并在同位置继续显示可输入的空行(连续录入); 无内容时 Esc/失焦折回占位符.
// 用 window._todoAdderActive 标记"上次保存后是否处于连续输入态", 重绘后自动展开新 wrap 保持焦点体验.
// container: 详情页 #todoTree 容器; parentNode: 当前详情根任务; submitFn(payload)-> Promise
function mountDetailAdder(container, parentNode, submitFn) {
  if (!container || !parentNode || typeof submitFn !== 'function') return;
  var wrap = document.createElement('div');
  wrap.className = 'todo-detail-adder collapsed';

  var placeholder = document.createElement('button');
  placeholder.type = 'button'; placeholder.className = 'todo-detail-adder__placeholder';
  placeholder.innerHTML = '<span class="todo-detail-adder__plus">＋</span><span>添加子任务</span>';

  // child_due 新模式主任务下, 子任务可快速设置截止日期与重复(与编辑弹窗同口径, 含高级重复规则)
  var childDueMode = !!(parentNode._root && parentNode._root.child_due);
  var editor = document.createElement('div'); editor.className = 'todo-detail-adder__editor';
  var titleEl = document.createElement('textarea');
  titleEl.rows = 1; titleEl.placeholder = '子任务标题(支持换行)'; titleEl.className = 'todo-detail-adder__title';
  var noteEl = document.createElement('textarea');
  noteEl.rows = 1; noteEl.placeholder = '备注(可选)'; noteEl.className = 'todo-detail-adder__note';
  var dueEl = null, recurCtl = null;
  if (childDueMode) {
    var optRow = document.createElement('div');
    optRow.className = 'todo-detail-adder__opts';
    optRow.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:4px 0;';
    dueEl = document.createElement('input');
    dueEl.type = 'date';
    dueEl.style.cssText = 'padding:4px 8px;';
    dueEl.value = todoTodayStr(); // 与编辑弹窗一致: 截止日期默认今天
    recurCtl = todoBuildRecurControl();
    optRow.appendChild(dueEl); optRow.appendChild(recurCtl.el);
    editor.appendChild(optRow);
  }
  var row = document.createElement('div'); row.className = 'todo-detail-adder__row';
  var saveBtn = document.createElement('button'); saveBtn.type = 'button'; saveBtn.className = 'btn sm todo-detail-adder__save'; saveBtn.textContent = '添加';
  var cancelBtn = document.createElement('button'); cancelBtn.type = 'button'; cancelBtn.className = 'btn sm gray todo-detail-adder__cancel'; cancelBtn.textContent = '取消';
  var hint = document.createElement('span'); hint.className = 'todo-detail-adder__hint muted';
  hint.textContent = childDueMode ? '可设置截止日期与重复' : '继承主任务的日期/优先级/分类';
  row.appendChild(saveBtn); row.appendChild(cancelBtn); row.appendChild(hint);
  editor.insertBefore(titleEl, editor.firstChild); editor.appendChild(noteEl); editor.appendChild(row);

  wrap.appendChild(placeholder); wrap.appendChild(editor);
  container.appendChild(wrap);
  autoGrowTextarea(titleEl); autoGrowTextarea(noteEl);
  // 键盘弹起时把输入框抬到可视区(修复手机上被键盘盖住)
  function onVV() { if (wrap.classList.contains('editing')) todoLiftIntoView(wrap); }
  // 若上次保存后处于连续录入态, 重绘后自动展开(与 expand 同口径: 注册单例 + 抬升)
  if (window._todoAdderActive) {
    wrap.classList.remove('collapsed'); wrap.classList.add('editing');
    todoRegisterAddForm(collapse);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', onVV);
    setTimeout(function(){ titleEl.focus(); todoLiftIntoView(wrap); }, 50);
  }

  function expand() {
    wrap.classList.remove('collapsed');
    wrap.classList.add('editing');
    window._todoAdderActive = 1;
    // 单例: 展开本框会自动关掉画面上其它添加框
    todoRegisterAddForm(collapse);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', onVV);
    setTimeout(function(){ titleEl.focus(); todoLiftIntoView(wrap); }, 50);
  }
  function collapse() {
    titleEl.value = ''; noteEl.value = '';
    if (dueEl) dueEl.value = todoTodayStr(); // 复位后截止日期仍默认今天
    // 触发一次 input 让 autoGrow 复位
    titleEl.dispatchEvent(new Event('input')); noteEl.dispatchEvent(new Event('input'));
    saveBtn.disabled = false; cancelBtn.disabled = false; // 收起时恢复按钮, 下次展开可再点
    wrap.classList.remove('editing');
    wrap.classList.add('collapsed');
    window._todoAdderActive = 0;
    if (window.visualViewport) window.visualViewport.removeEventListener('resize', onVV);
    todoUnregisterAddForm(collapse);
  }
  async function submit() {
    var title = (titleEl.value || '').trim();
    if (!title) { alertModal('请填写子任务标题', { ok: false }); titleEl.focus(); return; }
    // child_due 模式: 截止日期必填(默认今天, 被清空则拦截)
    if (childDueMode && dueEl && !dueEl.value) { alertModal('请选择截止日期（默认今天）', { ok: false }); dueEl.focus(); return; }
    if (saveBtn.disabled) return;
    saveBtn.disabled = true; cancelBtn.disabled = true;
    var payload = { title: title, parent_id: parentNode.id };
    var note = (noteEl.value || '').trim();
    if (note) payload.note = note;
    if (childDueMode) {
      payload.due_date = dueEl.value ? dueEl.value : null;
      var r = recurCtl.get();
      if (r.recurrence) {
        payload.recurrence = r.recurrence;
        payload.recur_interval = r.recur_interval;
        payload.recur_nth = r.recur_nth;
        payload.recur_weekday = r.recur_weekday;
      }
    }
    try {
      // 先置 0: submitFn 内部会 loadTodos → 重绘详情, 新挂载的添加框读到 0 即保持折叠(不自动展开).
      // 必须在 await 之前 —— 重绘发生在 submitFn 内部, 晚了新框已按 1 展开.
      window._todoAdderActive = 0;
      await submitFn(payload);
      // 未重绘的极端情况下就地收起(重绘时本闭包持有的是已移除的旧 wrap, 操作无视觉影响)
      collapse();
    } catch (err) {
      saveBtn.disabled = false; cancelBtn.disabled = false;
      if (typeof alertModal === 'function') alertModal((err && err.message) || '保存失败', {ok:false});
    }
  }
  placeholder.addEventListener('click', expand);
  saveBtn.addEventListener('click', submit);
  cancelBtn.addEventListener('click', collapse);
  // Enter 保留 textarea 默认换行行为, 不再拦截提交; Esc 折回占位符(等价点取消)
  titleEl.addEventListener('keydown', function(e){ if (e.key === 'Escape') { e.preventDefault(); collapse(); } });
  noteEl.addEventListener('keydown', function(e){ if (e.key === 'Escape') { e.preventDefault(); collapse(); } });
}
// 子任务拖拽排序（仅同级重排），两个入口共用一套 beginDrag/moveTo/finishDrag:
//   手机(触摸): 长按整行 ~350ms 进入拖拽 —— 长按期间移动 >10px 判定为滚动/左滑手势, 取消, 绝不抢滚动;
//               进入瞬间振动 + 行"抬起"(放大/阴影), 拖动时同父兄弟按位置实时让位, 松手提交, 未移动则回弹;
//               长按只在行主体生效(避开勾选框/操作按钮/输入区), 长按松手不会误触发行展开/折叠.
//   PC(鼠标/笔): 行尾拖拽手柄按住即拖(手柄在窄屏 CSS 隐藏, 手机只走长按).
// handle: 拖拽手柄按钮；wrap: 该节点 .todo-node 容器；node: 数据节点；opts.onReorder(parentId, ids)
function todoBindDrag(handle, wrap, node, opts) {
  var LONG_PRESS_MS = 350, MOVE_CANCEL = 10;
  var dragging = false, parentBox = null;
  var lpTimer = null, lpArmed = false, startX = 0, startY = 0, pulled = false;
  // App 原生壳下拉刷新(SwipeRefreshLayout)在原生层拦截触摸: 长按后拖动会被它抢走(WebView 收 touchcancel),
  // 导致"拖不动 + 触发下拉刷新". JS preventDefault 挡不住原生父容器, 必须经 AppShell 桥在长按手势期间禁用.
  // 禁用走桥的 _appShellPullDisable(同步去重状态), 否则手势结束后的恢复会被 report 的"状态未变"去重跳过.
  function appShellPullDisable() {
    try {
      if (typeof window._appShellPullDisable === 'function') window._appShellPullDisable();
      else if (window.AppShell && typeof window.AppShell.setPullRefresh === 'function') window.AppShell.setPullRefresh(false);
    } catch (e) {}
  }
  function appShellRefresh() {
    try {
      if (typeof window._appShellReport === 'function') window._appShellReport();
      else if (window.AppShell && typeof window.AppShell.setPullRefresh === 'function') window.AppShell.setPullRefresh(true);
    } catch (e) {}
  }

  function siblings() {
    return Array.prototype.filter.call(parentBox.children, function(el){
      return el.classList && el.classList.contains('todo-node');
    });
  }
  // 拖动中按 clientY 在同父兄弟中点定位插入(实时让位)
  function moveTo(y) {
    if (!dragging) return;
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
  // 长按后松手浏览器会补一次合成 click(会展开/折叠子任务), 捕获阶段吞掉这一拍
  function suppressClickOnce() {
    function h(e){ e.stopPropagation(); e.preventDefault(); wrap.removeEventListener('click', h, true); }
    wrap.addEventListener('click', h, true);
    setTimeout(function(){ wrap.removeEventListener('click', h, true); }, 400);
  }
  function beginDrag() {
    if (dragging || !lpArmed) return;
    dragging = true; lpArmed = false;
    parentBox = wrap.parentNode; // .todo-children
    wrap.classList.add('dragging');
    document.body.classList.add('todo-dragging');
    if (navigator.vibrate) { try { navigator.vibrate(15); } catch(err){} }
    suppressClickOnce();
  }
  // 收集同父容器里 .todo-node 的 data-id 顺序(cleanup 不重置 parentBox, 松手后仍可读)
  function collectIds(box) {
    return Array.prototype.filter.call(box.children, function(el){
      return el.classList && el.classList.contains('todo-node');
    }).map(function(el){ return parseInt(el.getAttribute('data-id'), 10); });
  }
  function removePtrListeners() {
    document.removeEventListener('pointermove', onPtrMove, true);
    document.removeEventListener('pointerup', onPtrUp, true);
    document.removeEventListener('pointercancel', onPtrUp, true);
  }
  function removeTouchListeners() {
    document.removeEventListener('touchmove', onTouchMove, { passive: false, capture: true });
    document.removeEventListener('touchend', onTouchEnd, true);
    document.removeEventListener('touchcancel', onTouchEnd, true);
  }
  function cleanup() {
    if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
    lpArmed = false;
    if (dragging) {
      dragging = false;
      wrap.classList.remove('dragging');
      document.body.classList.remove('todo-dragging');
    }
    if (pulled) { pulled = false; appShellRefresh(); } // 手势结束, 按当前滚动/弹窗状态恢复下拉刷新
    removePtrListeners();
    removeTouchListeners();
  }
  // 松手: 位置有变才提交(finishDrag 内按 DOM 顺序收集 ids, onReorder 端会重绘对齐)
  function finishDrag() {
    var wasDragging = dragging;
    var box = parentBox;
    cleanup();
    if (!wasDragging || !box) return;
    var pid = node.parent_id != null ? node.parent_id : null;
    opts.onReorder(pid, collectIds(box));
  }

  // ---- 手柄入口(PC 鼠标/笔; 触摸不走手柄, 窄屏手柄已隐藏) ----
  function onPtrMove(e) { if (!dragging) return; e.preventDefault(); moveTo(e.clientY); }
  function onPtrUp() { finishDrag(); }
  handle.addEventListener('pointerdown', function(e){
    if (e.pointerType === 'touch') return; // 触摸一律走整行长按
    e.preventDefault(); e.stopPropagation();
    parentBox = wrap.parentNode;
    lpArmed = true; beginDrag();
    document.addEventListener('pointermove', onPtrMove, true);
    document.addEventListener('pointerup', onPtrUp, true);
    document.addEventListener('pointercancel', onPtrUp, true);
  });
  // 手柄上点击不触发行展开
  handle.addEventListener('click', function(e){ e.stopPropagation(); });

  // ---- 整行长按入口(手机触摸) ----
  function onTouchStart(e) {
    if (dragging) return;
    if (!e.touches || e.touches.length !== 1) { lpArmed = false; return; }
    var tgt = e.target;
    // 嵌套 .todo-node(父行包含子行): 只处理"最近的任务节点是自己"的触摸, 子行触摸冒泡到父 wrap 不重复 arm.
    // 不调 stopPropagation, 以免挡住 document 上的全局左滑返回手势.
    var nearest = tgt.closest ? tgt.closest('.todo-node') : null;
    if (nearest !== wrap) return;
    // 只在行主体起手: 避开勾选框/操作按钮区/内联添加框/各类交互控件
    if (tgt.closest && (tgt.closest('.todo-check') || tgt.closest('.todo-ops') ||
        tgt.closest('.todo-inline-add') || tgt.closest('.todo-detail-adder') ||
        tgt.closest('input,textarea,select,button,a'))) { lpArmed = false; return; }
    cleanup(); // 清上一组残留监听/计时器
    var t = e.touches[0];
    startX = t.clientX; startY = t.clientY; lpArmed = true;
    lpTimer = setTimeout(function(){ if (lpArmed) beginDrag(); }, LONG_PRESS_MS);
    // touchmove 用 passive:false: 仅在已进入拖拽后 preventDefault 锁滚动; 未成立时不拦截, 滚动/手势正常
    document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
    document.addEventListener('touchend', onTouchEnd, true);
    document.addEventListener('touchcancel', onTouchEnd, true);
    // 长按手势一开始(按住等待期)就禁用原生下拉刷新: 350ms 后进入拖拽, 手指移动时 SwipeRefresh 已关闭,
    // 不会抢走 touch 序列; 抬手/取消时由 cleanup → appShellRefresh 按当前状态恢复
    appShellPullDisable(); pulled = true;
  }
  function onTouchMove(e) {
    if (dragging) {
      e.preventDefault(); // 进入拖拽后锁住页面滚动
      if (e.touches && e.touches.length === 1) moveTo(e.touches[0].clientY);
      return;
    }
    if (!lpArmed) return;
    var t = e.touches && e.touches[0];
    if (!t) return;
    // 长按未成立手指就移动超过阈值 → 让位给页面滚动/左滑返回, 取消本次长按
    if (Math.abs(t.clientX - startX) > MOVE_CANCEL || Math.abs(t.clientY - startY) > MOVE_CANCEL) {
      lpArmed = false;
      if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
    }
  }
  function onTouchEnd() {
    if (dragging) { finishDrag(); return; } // finishDrag 内 cleanup
    // 未进入拖拽的抬手(短按/滚动后抬手): cleanup 清计时器/监听并恢复下拉刷新, 保留原生 click(展开/折叠正常)
    cleanup();
  }
  wrap.addEventListener('touchstart', onTouchStart, { passive: true });
}
// 任务编辑表单 HTML：标题(多行长文本)/优先级/截止/重复/分类/备注
// isNew=true 新建；isChild=true 为子任务
// fopts:
//   childDueMode  (子任务): 所在主任务为 child_due 新模式 → 子任务可各自设日期/重复
//   canRecur      (子任务): false 时隐藏重复块(该子任务已有后代, 仅叶子可重复)
//   lockChildDue  (主任务): true 时不渲染模式勾选框(/t/ 协作页不允许切换模式)
//   forceChildDue (主任务): 与 lockChildDue 配合, 强制按新模式呈现(隐藏主任务日期/重复)
function todoFormHtml(t, isNew, isChild, fopts) {
  t = t || {};
  fopts = fopts || {};
  // 主任务 child_due 模式: 编辑时反映当前 t.child_due; 锁定时按 forceChildDue 呈现
  var childDueOn = !isChild && (fopts.lockChildDue ? !!fopts.forceChildDue : !!t.child_due);
  // 子任务: 仅在 child_due 模式主任务下可设日期; 重复仅叶子(canRecur !== false)
  var childMode = isChild && !!fopts.childDueMode;
  var canRecur = isChild ? (childMode && fopts.canRecur !== false) : !childDueOn;
  var defDue = t.due_date || (isNew ? todoTodayStr() : '');
  // 日期字段: 主任务(非新模式) / 新模式子任务可见; 主任务侧包 #tfDueWrap 供勾选框联动显隐
  var dueField = '';
  if (!isChild) {
    dueField = '<div id="tfDueWrap" style="display:' + (childDueOn ? 'none' : 'block') + ';"><label>截止日期</label><input id="tfDue" type="date" value="' + defDue + '"></div>';
  } else if (childMode) {
    dueField = '<div><label>截止日期</label><input id="tfDue" type="date" value="' + defDue + '"></div>';
  }
  // 重复块(主任务旧模式 / 新模式叶子子任务): 主任务侧包 #tfRecurWrap 供勾选框联动显隐
  var recurInner =
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
        '<span id="tfRecurNBox" style="display:' + (t.recurrence ? 'inline-flex' : 'none') + ';align-items:center;gap:4px;color:var(--muted);font-size:13px;">' +
          '每' +
          '<input id="tfRecurN" type="number" min="1" max="99" value="' + (t.recur_interval && t.recur_interval >= 1 ? t.recur_interval : 1) + '" style="width:58px;padding:4px 6px;text-align:center;">' +
          '<span id="tfRecurUnit">' + (({ daily:'天', weekly:'周', monthly:'月', monthly_nth_weekday:'月', yearly:'年' })[t.recurrence] || '天') + '</span>' +
        '</span>' +
      '</div>' +
      // monthly_nth_weekday 专属两下拉: 位置(第 N 个) + 星期几; 仅在选中该重复时显示
      '<div id="tfNthWrap" style="display:' + (t.recurrence === 'monthly_nth_weekday' ? 'flex' : 'none') + ';gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap;">' +
        '<span style="color:var(--muted);font-size:13px;">的</span>' +
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
      '<p class="muted" style="margin:-4px 0 10px;font-size:12px;">' + ICONS.repeat + '完成后自动生成下一条任务；如"每 2 周"、"每月第一个周一"</p>';
  var recurBlock = canRecur
    ? (isChild ? recurInner : '<div id="tfRecurWrap" style="display:' + (childDueOn ? 'none' : 'block') + ';">' + recurInner + '</div>')
    : '';
  // child_due 勾选框: 仅主任务且未锁定时渲染(/t/ 协作页不允许切换模式)
  var childDueBox = (!isChild && !fopts.lockChildDue) ?
    '<label style="display:flex;align-items:center;gap:8px;margin:2px 0 4px;cursor:pointer;font-weight:normal;white-space:nowrap;">' +
      '<input type="checkbox" id="tfChildDue"' + (childDueOn ? ' checked' : '') + ' style="width:auto;margin:0;flex:none;">' +
      '<span>子任务各自设置截止日期</span>' +
    '</label>' +
    '<p id="tfChildDueTip" class="muted" style="margin:-2px 0 10px;font-size:12px;display:' + (childDueOn ? 'block' : 'none') + ';">' +
      '📌 主任务不设日期；子任务可各自设置截止日期与重复，主任务显示最早到期的子任务日期</p>'
    : '';
  // 日期提示行
  var dueTip = isChild
    ? (childMode
      ? '<p class="muted" style="margin:-4px 0 10px;font-size:12px;">' + ICONS.calendar + '子任务需设置截止日期（默认今天），可设置重复规则；未选日期无法保存</p>'
      : '<p class="muted" style="margin:-4px 0 10px;font-size:12px;">' + ICONS.calendar + '子任务的截止日期跟随主任务</p>')
    : '<p id="tfMemoTip" class="muted" style="margin:-4px 0 10px;font-size:12px;display:' + (childDueOn ? 'none' : 'block') + ';">📌 留空截止日期即作备忘录，不计入日报</p>';
  return '<label>标题</label>' +
    '<textarea id="tfTitle" rows="2" data-autogrow="1" placeholder="要做什么？（支持换行）" style="resize:vertical;">' + esc(t.title || '') + '</textarea>' +
    childDueBox +
    '<div class="row">' +
      '<div><label>优先级</label><select id="tfPri">' +
        '<option value="2"' + (t.priority === 2 ? ' selected' : '') + '>🔴 高</option>' +
        '<option value="1"' + (t.priority == null || t.priority === 1 ? ' selected' : '') + '>🟡 中</option>' +
        '<option value="0"' + (t.priority === 0 ? ' selected' : '') + '>⚪ 低</option>' +
      '</select></div>' +
      dueField +
    '</div>' +
    dueTip +
    recurBlock +
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
  // 共享分类选项 value='sc:<catId>': 归入共享分类(与文本分类互斥, category 置空)
  var sharedCatId = (catVal && catVal.indexOf('sc:') === 0) ? parseInt(catVal.slice(3), 10) : null;
  var out = {
    title: document.getElementById('tfTitle').value.trim(),
    priority: parseInt(document.getElementById('tfPri').value, 10),
    due_date: dueEl ? (dueEl.value || null) : null,
    category: (!sharedCatId && catVal) ? catVal : null,
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
  // child_due 勾选框仅主任务表单存在; 不存在(子任务/协作页锁定)时不输出该键, 后端即不切换模式
  var cdEl = document.getElementById('tfChildDue');
  if (cdEl) out.child_due = cdEl.checked ? 1 : 0;
  // 始终携带: null=无分类/个人分类(编辑共享任务时即"移出共享"), 数字=移入该共享分类
  out.shared_cat_id = sharedCatId;
  return out;
}
function todoTodayStr(){ var d = new Date(Date.now() + 8*3600*1000); return d.toISOString().slice(0,10); }
// 待办趋势三线图（逐天直接计数，恒非负）：
//   总任务=未完成+当天完成(含逾期/完成/未完成全部)；未完成=当天到期+历史逾期；完成=当天勾选完成
var _todoChartInst = null;
function drawTodoChart(canvasId, series) {
  var el = document.getElementById(canvasId);
  if (!el || typeof Chart === 'undefined') return;
  if (_todoChartInst) { _todoChartInst.destroy(); _todoChartInst = null; }
  // 手机无 hover: 图下常驻一行点击提示(仅插一次, canvas 复绘不重复插)
  if (!el.parentNode.querySelector('.todo-chart-hint')) {
    var hint = document.createElement('div');
    hint.className = 'todo-chart-hint muted';
    hint.style.cssText = 'font-size:12px;text-align:center;margin:2px 2px 8px;line-height:1.5;';
    hint.textContent = '💡 点击图上的数据点，可查看当天（按月查看时为当月）的任务明细';
    el.parentNode.insertBefore(hint, el.nextSibling);
  }
  // 轻点判定: 记录按下位置/时间(只绑一次, 复绘不重复), onClick 中排除长按与滑动
  if (!el._todoTapBound) {
    el._todoTapBound = true;
    el._todoTapDown = null;
    el.addEventListener('pointerdown', function(e){
      el._todoTapDown = { x: e.clientX, y: e.clientY, t: Date.now() };
    }, { passive: true });
  }
  _todoChartInst = new Chart(el, {
    type: 'line',
    data: { labels: series.labels, datasets: [
      { label: '总任务', data: series.total, borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,.10)', fill: false, tension: .3, borderWidth: 2, pointHitRadius: 16 },
      { label: '未完成', data: series.open, borderColor: '#4a6cf7', backgroundColor: 'rgba(74,108,247,.12)', fill: true, tension: .3, pointHitRadius: 16 },
      { label: '当天完成', data: series.done, borderColor: '#52c41a', backgroundColor: 'rgba(82,196,26,.10)', fill: false, tension: .3, pointHitRadius: 16 }
    ] },
    options: {
      // 整列命中: 手指点在某天一竖条附近即可(不必精确点中小圆点), 手机触摸友好
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top' },
        // 悬停数字点时提示可点击钻取当天(当月)任务明细，明细与曲线数字同口径
        tooltip: {
          callbacks: {
            footer: function(items) {
              if (!items.length || !series.details) return '';
              var d = series.details[items[0].index];
              if (!d) return '';
              var n = d.done.length + d.open.length;
              return n ? '🖱️ 点击查看' + (d.label.length === 7 ? '当月' : '当天') + ' ' + n + ' 条任务' : '';
            }
          }
        }
      },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      onClick: function(evt, elements) {
        if (!elements.length) return;
        // 触摸: 仅"近似轻点"(位移 ≤12px 且时长 ≤600ms)才钻取; 长按/拖动不弹
        var d0 = el._todoTapDown;
        var n = evt.native || {};
        if (d0 && n.clientX != null && (Math.abs(n.clientX - d0.x) > 12 ||
            Math.abs(n.clientY - d0.y) > 12 || Date.now() - d0.t > 600)) return;
        todoShowChartDetail(series, elements[0].index);
      }
    }
  });
}
// 折线图钻取弹窗：列出某一格(日/月)计入曲线的任务，分「完成 / 未完成」两组，
// 与该格 total/open/done 数字逐条对账（收编条目带"随主任务完成"，逾期条目标红）
function todoShowChartDetail(series, index) {
  var d = series.details && series.details[index];
  if (!d) return;
  var isMonth = d.label.length === 7;
  var title = isMonth
    ? (+d.label.slice(0, 4)) + ' 年 ' + (+d.label.slice(5, 7)) + ' 月任务明细'
    : (+d.label.slice(5, 7)) + ' 月 ' + (+d.label.slice(8, 10)) + ' 日任务明细';
  var today = todayStr();
  function pill(text, color, bg) {
    return '<span style="display:inline-block;border-radius:10px;padding:0 8px;margin-left:6px;font-size:12px;font-weight:600;color:' + color + ';background:' + bg + ';white-space:nowrap;">' + text + '</span>';
  }
  function row(it, kind) {
    var dl = todoDateLabel(it.due, today);
    var tags = it.adopted ? pill('随主任务完成', '#4a6cf7', '#eef1ff') : '';
    if (kind === 'done') {
      if (it.late) tags += pill('逾期补做', '#cf1322', '#fff1f0');
    } else if (it.late) {
      tags += pill('已逾期', '#cf1322', '#fff1f0');
    }
    var icon = kind === 'done' ? '✅' : (it.late ? '⚠️' : '⏳');
    var titleColor = kind === 'done' ? 'var(--muted)' : 'var(--text)';
    var titleDeco = kind === 'done' ? 'text-decoration:line-through;' : '';
    // 默认不展示层级, 仅在有祖先的行尾放「层级」小按钮, 点击在下方展开祖先链(再点收起)
    var hasPath = !!(it.path && it.path.length);
    var lvBtn = hasPath
      ? '<button type="button" class="todo-dtl-lv" style="flex:0 0 auto;border:1px solid var(--border);background:transparent;color:var(--muted);border-radius:10px;padding:0 8px;font-size:11px;line-height:1.8;cursor:pointer;">层级</button>'
      : '';
    var dateHtml = it.due
      ? '📅 ' + esc(dl)
      : '<span title="未设置截止日期，随主任务完成计入">∅ 无日期</span>';
    var rowHtml = '<div class="todo-dtl-row" style="display:flex;align-items:center;gap:6px;padding:7px 2px;">' +
      '<span style="flex:0 0 auto;">' + icon + '</span>' +
      '<span style="flex:1;min-width:0;word-break:break-all;">' +
        '<span style="' + titleDeco + 'color:' + titleColor + ';">' + esc(it.title) + tags + '</span>' +
      '</span>' +
      '<span class="muted" style="flex:0 0 auto;font-size:12px;white-space:nowrap;">' + dateHtml + '</span>' +
      lvBtn +
    '</div>';
    var pathHtml = '';
    if (hasPath) {
      // 阶梯树: 每层缩进 + └ 连接线, 末行为当前任务(加粗 + "本条"徽章), 层级一目了然
      var chainHtml = it.path.map(function(p, i){
        var indent = 10 + i * 14;
        var branch = i === 0 ? '' : '<span style="opacity:.55;margin-right:4px;">└</span>';
        return '<div style="padding:1px 0 1px ' + indent + 'px;color:var(--muted);">' + branch + esc(p) + '</div>';
      }).join('');
      var selfIndent = 10 + it.path.length * 14;
      var selfHtml = '<div style="padding:1px 0 1px ' + selfIndent + 'px;color:var(--text);font-weight:600;">' +
        '<span style="opacity:.55;margin-right:4px;">└</span>' + esc(it.title) +
        '<span style="margin-left:6px;padding:0 7px;border-radius:9px;font-size:11px;font-weight:600;color:#4a6cf7;background:#eef1ff;">本条</span></div>';
      pathHtml = '<div class="todo-dtl-path" style="display:none;margin:0 2px 7px 24px;padding:8px 10px;border-radius:8px;background:rgba(127,127,127,.08);font-size:12px;line-height:1.8;word-break:break-all;">' +
        chainHtml + selfHtml +
      '</div>';
    }
    // 行与展开块包在同一 item 内, 分隔线落在整组底部, 展开内容视觉上仍属于本任务
    return '<div class="todo-dtl-item" style="border-bottom:1px solid var(--border);">' + rowHtml + pathHtml + '</div>';
  }
  function group(heading, list, kind) {
    if (!list.length) return '';
    var h = '<h4 style="margin:14px 0 6px;font-size:14px;">' + heading + '（' + list.length + '）</h4>';
    return h + list.map(function(it){ return row(it, kind); }).join('');
  }
  var doneWord = isMonth ? '当月完成' : '当天完成';
  var openWord = isMonth ? '月末仍未完成' : '当天未完成（含历史逾期）';
  var total = d.done.length + d.open.length;
  var body = total
    ? group('✅ ' + doneWord, d.done, 'done') + group('⏳ ' + openWord, d.open, 'open')
    : '<p class="muted" style="line-height:1.7;">该' + (isMonth ? '月' : '天') + '没有计入曲线的任务。<br>未来到期的任务在到期/完成前不计入任何一格。</p>';
  openModal(title, body);
  // 「层级」按钮: 在所属任务下方展开/收起祖先链(弹窗 innerHTML 每次重建, 直接绑新元素)
  Array.prototype.forEach.call(document.querySelectorAll('#modalBody .todo-dtl-lv'), function(btn){
    btn.addEventListener('click', function(){
      var item = btn.closest('.todo-dtl-item');
      var p = item ? item.querySelector('.todo-dtl-path') : null;
      if (!p) return;
      var open = p.style.display !== 'none';
      p.style.display = open ? 'none' : 'block';
      btn.textContent = open ? '层级' : '收起';
    });
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
// 共享：趋势图手动刷新按钮，点击调 fn() 重拉图重绘；加载中转 ⏳ 并禁用防重点
function bindTodoChartRefresh(fn) {
  Array.prototype.forEach.call(document.querySelectorAll('.todo-chart-refresh'), function(btn){
    if (btn.__bound) return;
    btn.__bound = 1;
    btn.addEventListener('click', async function(){
      if (btn.disabled) return;
      btn.disabled = true;
      btn.classList.add('loading'); // SVG 旋转, 不替换内容(保留图标)
      // 最短 500ms 可视时长: 请求太快完成时也能清楚看到"刷新中"
      var minShown = new Promise(function(r){ setTimeout(r, 500); });
      try { await Promise.all([fn(), minShown]); }
      finally { btn.disabled = false; btn.classList.remove('loading'); }
    });
  });
}
// 指标卡「?」说明：纯白话，每个都带例子
function taExplain(key) {
  var T = {
    streak: { t: '连续达标是什么', h:
      '从昨天开始往前数，连续多少天「当天到期的任务都按时做完了」。\\n\\n' +
      '• 当天没有到期任务：空一天，不打断连续；\\n' +
      '• 当天有任务过了当天还没做完：连续中断；\\n' +
      '• 今天还没过完，不计入。\\n\\n' +
      '卡片下方的小字是历史上最长的一次连续天数。' },
    win: { t: '最终做完比例是什么', h:
      '这段时间（近30/60天）内到期的任务，最后到底做没做完的比例。\\n\\n' +
      '哪怕过了截止日才补做，也算做完。\\n\\n' +
      '例：9月2日到期的任务，9月9日才做完 → 这个比例算它做完，但日历里9月2日仍标红（当天没按时做完）。' },
    ontime: { t: '按时做完比例是什么', h:
      '在截止日当天或之前就做完的任务，占到期任务的比例。\\n\\n' +
      '过期后才补做的不算按时；提前把主任务勾完成、连带收掉的未到期子任务算按时。\\n\\n' +
      '和「最终做完比例」的差别：补做的任务进前者的分子，不进这个的分子。' },
    over: { t: '逾期比例是什么', h:
      '任务到了截止日当天结束时还没做完，就算一次逾期。这个比例 = 逾期任务数 ÷ 到期任务数。\\n\\n' +
      '之后补做了也仍然算逾期（日历上那天还是红色）。\\n\\n' +
      '今天还没过完，可能还有任务会在今天做完，所以今天不计入。' },
    heat: { t: '达标日历怎么看', h:
      '每个方块代表一天，颜色看当天到期任务的完成情况：\\n\\n' +
      '🟩 绿色：当天到期的任务全部按时做完；\\n' +
      '🟥 红色：有任务到当天结束还没做完（后来补做也仍标红）；\\n' +
      '⬜ 灰色：当天没有到期任务，这种日子不打断连续达标；\\n' +
      '🔲 紫色虚线方框：今天，还没过完，暂时不评定。\\n\\n' +
      '手机上点一下方块（电脑上鼠标悬停）能看到当天到期几件、完成几件。' },
    trend: { t: '每日完成走势怎么看', h:
      '每天一组柱子加一条线：\\n\\n' +
      '• 灰柱＝当天到期几件任务；\\n' +
      '• 绿柱＝最后做完几件（过期补做也算）；\\n' +
      '• 蓝线＝完成率（看右边百分比）；\\n' +
      '• 黄色虚线＝这段时间的平均完成率。\\n\\n' +
      '没有到期任务的日子柱子为 0、蓝线断开，不是出错——所以只在有任务的日子（比如 9/6）看得到线。\\n' +
      '点柱子（电脑上悬停）能看到当天明细。\\n\\n' +
      '例：9月2日到期 1 件、9月9日才补做 → 图上 9月2日灰柱 1、绿柱 1、完成率 100%，但上面日历的 9月2日仍是红色。' }
  };
  var x = T[key];
  if (!x) return;
  // 独立浮层(同 alertModal 模式): 不替换 #modalMask 内容, 关掉说明后分析弹窗仍在
  var mask = document.createElement('div');
  mask.className = 'modal-mask show';
  mask.style.zIndex = '10001';
  mask.innerHTML =
    '<div class="modal-box"><div class="modal-head"><span>' + esc(x.t) + '</span></div>' +
    '<div class="modal-body">' +
      '<p style="line-height:1.9;white-space:pre-line;word-break:break-all;margin:0;">' + esc(x.h) + '</p>' +
      '<div style="text-align:right;margin-top:14px;"><button type="button" class="btn ta-explain-ok">知道了</button></div>' +
    '</div></div>';
  document.body.appendChild(mask);
  var close = function(){ mask.remove(); };
  mask.querySelector('.ta-explain-ok').addEventListener('click', close);
  mask.addEventListener('click', function(e){ if (e.target === mask) close(); });
}
// 任务分析弹窗：连续达标 / 最终做完比例 / 按时做完比例 / 逾期比例 + 7列日历热力图 + 日完成率曲线
// buildUrl(days) 由调用页提供：登录态 /api/todo/analyze，公开页 /api/public/todo-analyze/:token
var _taChartInst = null;
var _taDays = 30;
function openTodoAnalysis(buildUrl) {
  _taDays = 30;
  var body =
    '<h3 class="ta-h ta-h-first">核心指标</h3>' +
    '<div class="ta-stats">' +
      '<div class="ta-stat" id="taStreakCard"><div class="n"><span id="taStreak">-</span><small>天</small></div><div class="l">连续达标 <button type="button" class="ta-help" data-help="streak">?</button></div><div class="s" id="taBest"></div></div>' +
      '<div class="ta-stat good"><div class="n" id="taWinRate">-</div><div class="l">最终做完比例 <button type="button" class="ta-help" data-help="win">?</button></div><div class="s">过期补做也算</div></div>' +
      '<div class="ta-stat good"><div class="n" id="taOnTimeRate">-</div><div class="l">按时做完比例 <button type="button" class="ta-help" data-help="ontime">?</button></div><div class="s">补做的不算</div></div>' +
      '<div class="ta-stat" id="taOverCard"><div class="n" id="taOverRate">-</div><div class="l">逾期比例 <button type="button" class="ta-help" data-help="over">?</button></div><div class="s">不含今天</div></div>' +
    '</div>' +
    '<div class="ta-head"><h3 class="ta-h">达标日历 <button type="button" class="ta-help" data-help="heat">?</button></h3>' +
      '<div class="todo-range" id="taRange"><button data-days="30" class="active">近30天</button><button data-days="60">近60天</button></div>' +
    '</div>' +
    '<div class="ta-heat-wrap">' +
      '<div class="ta-dow"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div>' +
      '<div class="ta-heat" id="taHeat"></div>' +
    '</div>' +
    '<div class="ta-legend"><span><i class="lg-win"></i>达标</span><span><i class="lg-fail"></i>有逾期</span><span><i class="lg-idle"></i>无任务</span><span><i class="lg-pending"></i>今天</span></div>' +
    '<h3 class="ta-h">每日完成走势 <button type="button" class="ta-help" data-help="trend">?</button></h3>' +
    '<canvas id="taChart" style="max-height:220px;"></canvas>' +
    '<p class="muted" style="font-size:12px;margin:12px 0 0;line-height:1.6;">怎么看：绿色=当天到期的任务都按时做完了；红色=当天有任务没按时做完（后来补做也仍标红）；灰色=当天没有到期任务，不打断连续；紫色虚线方框=今天还没过完。各标题旁的 ？ 里有详细说明；点日历方块或下方柱子能看当天明细。</p>';
  openModal('📊 任务分析', body, 'modal-mask--lg');
  // 走势 canvas 是弹窗内动态生成的, 手动挂放大按钮(与主页趋势图同一套横屏全屏);
  // 必须在首次 new Chart 前包好壳, data-fs-ready 保证 30/60 天切换重绘不重复包裹
  initChartFullscreen();
  // 指标卡/标题「?」说明按钮(弹窗 innerHTML 每次重建, 直接绑新元素)
  Array.prototype.forEach.call(document.querySelectorAll('#modalBody .ta-help'), function(btn){
    btn.addEventListener('click', function(){ taExplain(btn.getAttribute('data-help')); });
  });

  function pct(v) { return v == null ? '—' : Math.round(v * 100) + '%'; }
  // YYYY-MM-DD（北京日期）按 UTC 解析取星期，返回周一起算 0..6
  function weekdayMon(dateStr) { return (new Date(dateStr + 'T00:00:00Z').getUTCDay() + 6) % 7; }

  function render(a) {
    document.getElementById('taStreak').textContent = a.currentStreak;
    document.getElementById('taBest').textContent = a.longestStreak ? '最长 ' + a.longestStreak + ' 天' : '';
    document.getElementById('taWinRate').textContent = pct(a.winRate);
    document.getElementById('taOnTimeRate').textContent = pct(a.onTimeRate);
    document.getElementById('taOverRate').textContent = pct(a.overdueRate);
    // 连续 0 天中性色；逾期率 0 用正向绿，大于 0 用红
    document.getElementById('taStreakCard').classList.toggle('good', a.currentStreak > 0);
    document.getElementById('taOverCard').classList.toggle('bad', a.overdueRate > 0);
    document.getElementById('taOverCard').classList.toggle('good', !(a.overdueRate > 0));

    var heat = document.getElementById('taHeat');
    heat.innerHTML = '';
    var lead = weekdayMon(a.daily[0].date);
    for (var i = 0; i < lead; i++) heat.appendChild(document.createElement('span'));
    a.daily.forEach(function(item){
      var c = document.createElement('div');
      c.className = 'ta-cell ' + item.mark;
      var label = item.date.slice(5).replace('-', '/');
      if (item.mark === 'idle') c.title = label + ' 无到期任务';
      else if (item.mark === 'pending') c.title = label + ' 今天未收官：到期 ' + item.planned + ' / 已完成 ' + item.done;
      else c.title = label + ' 到期 ' + item.planned + ' / 完成 ' + item.done + ' / 新增逾期 ' + item.overdue;
      // 有任务日 / 今天格内显示日期（日），无任务日留空
      if (item.mark !== 'idle') c.textContent = item.date.slice(8);
      heat.appendChild(c);
    });

    if (typeof Chart !== 'undefined') {
      if (_taChartInst) { _taChartInst.destroy(); _taChartInst = null; }
      var rateData = a.daily.map(function(x){ return x.rate == null ? null : Math.round(x.rate * 100); });
      var avg = a.winRate == null ? null : Math.round(a.winRate * 100);
      // 混合图: 灰柱=当天到期件数, 绿柱=最终完成件数(含逾期补做), 蓝线=完成率(右轴), 黄虚线=区间平均
      // 无到期任务的日子柱子为 0、蓝线断开(spanGaps), 配合 tooltip 文案避免"只有一个点"的困惑
      var datasets = [
        { type: 'bar', label: '到期(件)', data: a.daily.map(function(x){ return x.planned; }),
          backgroundColor: '#c3ccdb', yAxisID: 'y1', order: 3, barPercentage: .8, categoryPercentage: .9, borderRadius: 2 },
        { type: 'bar', label: '完成(件)', data: a.daily.map(function(x){ return x.done; }),
          backgroundColor: '#52c41a', yAxisID: 'y1', order: 2, barPercentage: .8, categoryPercentage: .9, borderRadius: 2 },
        { type: 'line', label: '完成率', data: rateData,
          borderColor: '#4a6cf7', backgroundColor: 'rgba(74,108,247,.10)',
          tension: .3, spanGaps: false, pointRadius: 2, yAxisID: 'y2', order: 1 }
      ];
      if (avg != null) datasets.push({
        type: 'line', label: '平均 ' + avg + '%', data: a.daily.map(function(){ return avg; }),
        borderColor: '#faad14', borderDash: [5, 4], pointRadius: 0, borderWidth: 1.5, fill: false, yAxisID: 'y2', order: 1
      });
      _taChartInst = new Chart(document.getElementById('taChart'), {
        type: 'bar',
        data: { labels: a.daily.map(function(x){ return x.date.slice(5); }), datasets: datasets },
        options: {
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'top', align: 'end', labels: { boxWidth: 14, font: { size: 11 } } },
            tooltip: {
              // 平均虚线不进 tooltip
              filter: function(item){ return item.datasetIndex <= 2; },
              callbacks: {
                label: function(item){
                  var d = a.daily[item.dataIndex];
                  if (item.datasetIndex === 0) return '到期 ' + d.planned + ' 件';
                  if (item.datasetIndex === 1) return '完成 ' + d.done + ' 件';
                  return d.rate == null ? '完成率：当天无到期任务' : '完成率 ' + Math.round(d.rate * 100) + '%';
                },
                afterBody: function(items){
                  var d = a.daily[items[0].dataIndex];
                  if (d.overdue > 0 && d.mark !== 'pending') return '其中 ' + d.overdue + ' 件没按时完成（日历标红）';
                  return '';
                }
              }
            }
          },
          scales: {
            y1: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 } }, grid: { color: 'rgba(127,127,127,.12)' } },
            y2: { beginAtZero: true, max: 100, position: 'right',
              ticks: { callback: function(v){ return v + '%'; }, font: { size: 10 } },
              grid: { drawOnChartArea: false } },
            x: { ticks: { maxTicksLimit: 10, autoSkip: true, font: { size: 10 } } }
          }
        }
      });
    }
  }

  async function load() {
    try {
      var d = await api(buildUrl(_taDays));
      render(d.analysis);
    } catch(e) { alertModal(e.message, { ok: false }); }
  }

  document.getElementById('taRange').addEventListener('click', function(e){
    var b = e.target.closest('button[data-days]');
    if (!b) return;
    this.querySelectorAll('button').forEach(function(x){ x.classList.remove('active'); });
    b.classList.add('active');
    _taDays = parseInt(b.getAttribute('data-days'), 10);
    load();
  });
  load();
}
// 庆祝数量：叶子口径，完成父任务代表整枝结束，其后代不再计入
// datedOnly=true 时排除无截止日期的备忘录，与主页面/报告页的“未完成”统计一致
// child_due 新模式: 统计 node 子树中「带截止日期且未完成」的叶子数(只数后代不含 node 自身;
// 已完成分支整支跳过)。无日期的备忘录子任务不计入, 与"备忘录不二次提醒"的约定一致。
function todoPendingDatedLeaves(node) {
  var n = 0;
  function walk(x) {
    if (x.done) return;
    if (x.children && x.children.length) { x.children.forEach(walk); return; }
    if (x.due_date) n++;
  }
  (node.children || []).forEach(walk);
  return n;
}
// 勾选未完成→完成前的二次提醒: 仅当 node 所在主任务为 child_due 模式(子任务各自设截止时间),
// 且其下仍有带截止时间的未完成叶子时弹窗; 旧模式(子任务日期继承主任务)/无未完成子任务直接放行。
// 返回 Promise: true=继续提交, false=用户取消
function todoConfirmDoneIfPending(node, done) {
  if (!done) return Promise.resolve(true);
  var root = node._root || node;
  if (!root.child_due) return Promise.resolve(true);
  var pending = todoPendingDatedLeaves(node);
  if (!pending) return Promise.resolve(true);
  return new Promise(function(resolve){
    var msg = '该主任务下还有 ' + pending + ' 个带截止时间的子任务未完成。\\n仍要标记为已完成吗？\\n确认后这些子任务将随主任务一并视为完成。';
    openModal('确认完成主任务',
      '<p style="line-height:1.7;word-break:break-all;white-space:pre-line;">' + esc(msg) + '</p>' +
      '<div style="text-align:right;margin-top:18px;"><button type="button" class="btn gray" id="cdCancel">取消</button> <button type="button" class="btn danger" id="cdConfirm">仍要完成</button></div>');
    document.getElementById('cdCancel').addEventListener('click', function(){ closeModal(); resolve(false); });
    bindClickBusy(document.getElementById('cdConfirm'), async function(){ closeModal(); resolve(true); });
  });
}
function todoCelebrationCount(trees, datedOnly) {
  var total = 0, done = 0;
  function walk(node, inheritedDue) {
    if (node.done && node.children.length > 0) return;
    var own = node.due_date || inheritedDue;
    if (node.children.length > 0) {
      node.children.forEach(function(c){ walk(c, own); });
      return;
    }
    if (datedOnly && !own) return;
    total++;
    if (node.done) done++;
  }
  (trees || []).forEach(function(root){ walk(root, root.due_date); });
  return { remaining: total - done, total: total };
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
// 文件大小格式化
function fmtSize(n) {
  n = Number(n) || 0;
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(1) + ' MB';
}
// 只读任务详情：md 备注渲染 + 附件列表；opts={today,editable,onEdit,listAttachments}
async function openTodoDetail(node, opts) {
  opts = opts || {};
  var today = opts.today || '';
  var due = node.due_date || '';
  var meta = [];
  if (due) meta.push('<span class="td-chip">' + ICONS.calendar + esc(todoDateLabel(due, today)) + '</span>');
  if (node.recurrence) meta.push('<span class="td-chip">' + ICONS.repeat + esc(todoRecurLabel(node.recurrence, node.recur_interval, node.recur_nth, node.recur_weekday)) + '</span>');
  if (node.category) meta.push('<span class="td-chip">〔' + esc(node.category) + '〕</span>');
  if (node.shared_cat_id != null) meta.push('<span class="td-chip">👥 共享</span>');
  var priName = ['⚪ 低', '🟡 中', '🔴 高'][node.priority == null ? 1 : node.priority];
  meta.push('<span class="td-chip">⭐ ' + esc(priName) + '</span>');
  var body =
    '<div class="td-title">' + esc(node.title) + '</div>' +
    '<div class="td-meta">' + meta.join('') + '</div>' +
    (node.note
      ? '<div class="md-body" id="tdNote">' + renderTodoNote(node.note) + '</div>'
      : '<p class="muted" style="font-size:13px;margin:4px 0 0;">无备注</p>') +
    '<div class="td-att-title">附件 <span id="tdAttCount" class="muted"></span></div>' +
    '<div class="td-att-list" id="tdAttList"><div class="muted" style="font-size:13px;">加载中…</div></div>';
  var headActions = opts.editable
    ? '<button type="button" class="btn sm" id="tdEditBtn">' + ICONS.edit + ' 编辑</button>'
    : '';
  openModal('📝 任务详情', headActions + body, 'modal-mask--lg');
  mdTaskToBoxes(document.getElementById('tdNote'));
  if (opts.editable) {
    document.getElementById('tdEditBtn').addEventListener('click', function(){
      closeModal();
      if (opts.onEdit) opts.onEdit(node);
    });
  }
  var box = document.getElementById('tdAttList');
  try {
    var atts = opts.listAttachments ? await opts.listAttachments(node.id) : [];
    document.getElementById('tdAttCount').textContent = atts.length ? '(' + atts.length + ')' : '';
    if (!atts.length) { box.innerHTML = '<div class="muted" style="font-size:13px;">暂无附件</div>'; return; }
    box.innerHTML = atts.map(function(a) {
      var inner = a.is_image
        ? '<img class="td-att-img" src="' + esc(a.url) + '" alt="' + esc(a.origin_name) + '" loading="lazy">'
        : '<span class="td-att-ph">' + ICONS.paperclip + '</span>';
      return '<a class="td-att" href="' + esc(a.url) + '" target="_blank" rel="noopener noreferrer">' +
        inner + '<span class="td-att-nm">' + esc(a.origin_name) + '</span><span class="td-att-sz muted">' + fmtSize(a.size) + '</span></a>';
    }).join('');
  } catch (e) {
    box.innerHTML = '<div class="muted" style="font-size:13px;">附件加载失败</div>';
  }
}
// 在已存在的 #tfNote textarea 原地挂载 md 编辑器（写/预览分段 + 工具条 + 附件上传）。
// 保留原 textarea 的 id 与值，todoFormRead() 取值链路零改动。opts={upload:async(file)=>attachmentJson, maxMb}
function mountTodoMdEditor(textarea, opts) {
  opts = opts || {};
  var maxMb = opts.maxMb || 5;
  var root = document.createElement('div');
  root.className = 'mde';
  root.innerHTML =
    '<div class="mde-seg"><button type="button" data-m="write" class="on">✏️ 写</button><button type="button" data-m="preview">👁 预览</button></div>' +
    '<div class="mde-bar">' +
      '<button type="button" class="mde-btn" data-a="bold" title="加粗 Ctrl+B"><b>B</b></button>' +
      '<button type="button" class="mde-btn" data-a="italic" title="斜体 Ctrl+I"><i>i</i></button>' +
      '<button type="button" class="mde-btn" data-a="strike" title="删除线"><s>S</s></button>' +
      '<span class="mde-sep"></span>' +
      '<button type="button" class="mde-btn" data-a="quote" title="引用">“</button>' +
      '<button type="button" class="mde-btn" data-a="ul" title="无序列表">≡</button>' +
      '<button type="button" class="mde-btn" data-a="task" title="待办项">☑</button>' +
      '<span class="mde-sep"></span>' +
      '<button type="button" class="mde-btn" data-a="img" title="上传图片">' +
        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.5-3.5L9 20"/></svg></button>' +
      '<button type="button" class="mde-btn" data-a="file" title="添加附件">📎</button>' +
      '<input type="file" class="mde-file" hidden>' +
    '</div>' +
    '<div class="mde-panes"><div class="mde-write"></div><div class="mde-preview md-body"></div></div>' +
    '<div class="mde-chips"></div>';
  textarea.parentNode.insertBefore(root, textarea.nextSibling);
  var writeWrap = root.querySelector('.mde-write');
  writeWrap.appendChild(textarea);
  textarea.classList.add('mde-text');
  textarea.removeAttribute('data-autogrow');
  textarea.setAttribute('rows', '7');
  // openModal 的 autoGrowTextarea 可能已绑定并写了内联 overflow/height（会压过 CSS 导致框内不能滚）：
  // 禁用其后续撑开，并清掉内联样式，改由 .mde-text 的固定高度 + overflow:auto 接管滚动
  textarea.__agDisabled = 1;
  textarea.style.overflowY = '';
  textarea.style.height = '';
  textarea.style.minHeight = '';
  var pv = root.querySelector('.mde-preview');
  var fileInput = root.querySelector('.mde-file');
  var chips = root.querySelector('.mde-chips');

  function renderPv() {
    pv.innerHTML = renderTodoNote(textarea.value);
    mdTaskToBoxes(pv);
  }
  function setMode(m) {
    root.dataset.mode = m;
    Array.prototype.forEach.call(root.querySelectorAll('.mde-seg button'), function(b){ b.classList.toggle('on', b.dataset.m === m); });
    if (m === 'preview') { textarea.blur(); renderPv(); }
  }
  function wrapLine(pre) {
    var s = textarea.selectionStart, e = textarea.selectionEnd, v = textarea.value, ls = v.lastIndexOf('\\n', s - 1) + 1;
    var next = v.slice(ls, e).split('\\n').map(function(l){ return pre + l; }).join('\\n');
    textarea.value = v.slice(0, ls) + next + v.slice(e);
    textarea.focus(); textarea.selectionStart = ls + pre.length; textarea.selectionEnd = ls + next.length;
    renderPv();
  }
  function wrapSel(pre, post) {
    var s = textarea.selectionStart, e = textarea.selectionEnd, v = textarea.value, sel = v.slice(s, e) || '文字';
    textarea.value = v.slice(0, s) + pre + sel + post + v.slice(e);
    textarea.focus(); textarea.selectionStart = s + pre.length; textarea.selectionEnd = s + pre.length + sel.length;
    renderPv();
  }
  function insert(txt) {
    var s = textarea.selectionStart;
    textarea.value = textarea.value.slice(0, s) + txt + textarea.value.slice(textarea.selectionEnd);
    textarea.focus(); textarea.selectionStart = textarea.selectionEnd = s + txt.length;
    renderPv();
  }
  function addChip(att, uploading) {
    var c = document.createElement('span');
    c.className = 'mde-chip' + (uploading ? ' up' : '');
    c.innerHTML = (att.is_image ? '<img alt="">' : '📎') +
      '<span class="mde-chip-nm"></span>' +
      (uploading ? '<span class="mde-chip-st">上传中…</span>' : '<span class="mde-chip-ok">✓</span>');
    c.querySelector('.mde-chip-nm').textContent = att.origin_name;
    if (att.is_image && att.url) c.querySelector('img').src = att.url;
    chips.appendChild(c);
    return c;
  }
  function pickAndUpload(accept) {
    fileInput.value = '';
    fileInput.accept = accept;
    fileInput.click();
  }
  fileInput.addEventListener('change', async function() {
    var file = fileInput.files && fileInput.files[0];
    if (!file || !opts.upload) return;
    if (file.size > maxMb * 1048576) { alertModal('文件超过 ' + maxMb + 'MB 上限', { ok: false }); return; }
    var chip = addChip({ origin_name: file.name, is_image: file.type.indexOf('image/') === 0, url: '' }, true);
    try {
      var att = await opts.upload(file);
      chip.classList.remove('up');
      var st = chip.querySelector('.mde-chip-st'); if (st) st.remove();
      if (att.is_image) {
        var im = chip.querySelector('img'); if (im) im.src = att.url;
        insert('\\n![' + att.origin_name + '](' + att.url + ')\\n');
      } else {
        insert('\\n[' + att.origin_name + '](' + att.url + ')\\n');
      }
    } catch (e) {
      chip.remove();
      alertModal(e.message || '上传失败', { ok: false });
    }
  });
  Array.prototype.forEach.call(root.querySelectorAll('.mde-btn'), function(b) {
    b.addEventListener('mousedown', function(e){ e.preventDefault(); });
    b.addEventListener('click', function() {
      var a = b.dataset.a;
      if (a === 'bold') wrapSel('**', '**');
      else if (a === 'italic') wrapSel('_', '_');
      else if (a === 'strike') wrapSel('~~', '~~');
      else if (a === 'quote') wrapLine('> ');
      else if (a === 'ul') wrapLine('- ');
      else if (a === 'task') wrapLine('- [ ] ');
      else if (a === 'img') pickAndUpload('image/*');
      else if (a === 'file') pickAndUpload('');
    });
  });
  Array.prototype.forEach.call(root.querySelectorAll('.mde-seg button'), function(b) {
    b.addEventListener('click', function(){ setMode(b.dataset.m); });
  });
  textarea.addEventListener('input', renderPv);
  textarea.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); wrapSel('**', '**'); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); wrapSel('_', '_'); }
  });
  root.dataset.mode = 'write';
  renderPv();
  return { getValue: function(){ return textarea.value; } };
}
`;

// ============ 待办清单页（登录态） ============
const TODO_JS = `
bindLogout();
bindModal();
mountDataSwitcher('todo');
var _rows = [];
var _stats = { pending:0, overdue:0, done:0, total:0 };
function todayStr(){ var d = new Date(Date.now() + 8*3600*1000); return d.toISOString().slice(0,10); }

async function loadTodos() {
  var data = await api('/api/todo/list');
  // 共享分类列表不在此刷新: 首屏由初始化并行加载, 成员变动(加入/退出/踢人/解散)后显式刷新,
  // 避免每次勾选/新建都多一个串行请求
  _rows = data.todos || [];
  var s = data.stats || { pending:0, overdue:0, done:0, total:0, memo:0 };
  _stats = s;
  renderPendingStats();
  document.getElementById('stDone').textContent = todoDoneByFilter(_rows, _filter, todayStr(), _curRange);
  updateStatsHint(_filter, _curRange);
  drawTree();
  // 同步重算抽屉计数(勾选/增删改后数字立即更新, 避免已完成任务仍占计数)
  refreshTodoDrawer(_rows);
  // App 原生壳: 列表已与服务端同步(增删改/勾选/排序/共享分类变动的统一收尾),
  // 通知立即刷新桌面小组件, 不等 15 分钟周期 Worker; 普通浏览器无此函数, no-op.
  if (typeof window._appShellTodoChanged === 'function') window._appShellTodoChanged();
}
var _filter = 'planned'; // all | planned | cur | today | overdue | future | memo | done ; 默认计划中(有截止日期)
// 程序化切换时间筛选 tab: 触发对应按钮 click, 复用现有 handler(active 态/统计/图表联动/drawTree 全套)
function switchTodoFilter(f) {
  if (_filter === f) return;
  var btn = document.querySelector('#todoFilter button[data-filter="' + f + '"]');
  if (btn) btn.click();
}
// 按筛选归类顶层任务（日期取顶层显示日期 todoRootDue: 旧模式=自身 due_date; 新模式=最早到期子任务）
function todoFilterTrees(trees) {
  var t = todayStr();
  return trees.filter(function(n){ return todoRootPassFilter(n, _filter, t); });
}
// 按当前 _filter 过滤后的可见顶层树重算 未完成/已逾期/备忘录 三项统计
// 与已完成一栏保持一致的联动风格; 已完成节点(整枝)不计入
function renderPendingStats() {
  var trees = todoFilterTrees(todoBuildTree(todoRowsByCategory(_rows)));
  var s = todoStatsByVisible(trees, todayStr());
  document.getElementById('stPending').textContent = s.pending;
  document.getElementById('stOverdue').textContent = s.overdue;
  document.getElementById('stMemo').textContent = s.memo;
}
// 视图 3 态循环需要的一对回调: 取当前 rows / 触发树重绘
function _todoGetRows() { return _rows; }
// 打开任务编辑弹窗（卡片操作与小组件 ?edit=<id> 深链共用）
function openTodoEdit(node) {
  var isChild = node.parent_id != null;
  // 子任务: 按所在主任务的 child_due 模式决定是否可设日期/重复; 重复仅叶子(无子任务)
  var fopts = isChild
    ? { childDueMode: !!(node._root && node._root.child_due), canRecur: node.children.length === 0 }
    : {};
  // 子任务弹窗标题带所属主任务名(组件深链 ?edit 与卡片/树编辑共用), 明确当前在编辑哪个清单下的任务
  var _rootTitle = isChild && node._root ? node._root.title : '';
  var _modalTitle = isChild
    ? (_rootTitle ? '编辑子任务 · ' + _rootTitle : '编辑子任务')
    : '编辑任务';
  openModal(_modalTitle, todoFormHtml(node, false, isChild, fopts) +
    '<div style="margin-top:12px;"><button class="btn" id="tfSave">保存</button> <button class="btn gray" onclick="closeModal()">取消</button></div>');
  // 仅编辑已有任务挂 markdown 编辑器（新建/新建子任务不挂）；multipart 直连，随数据源带头
  (async function(){
    var noteEl = document.getElementById('tfNote');
    if (!noteEl) return;
    var lim = await api('/api/public/attach-max-mb').catch(function(){ return { max_mb: 5 }; });
    mountTodoMdEditor(noteEl, {
      maxMb: lim.max_mb || 5,
      upload: async function(file) {
        var fd = new FormData();
        fd.append('todo_id', node.id);
        fd.append('file', file);
        var headers = {};
        var asUid = dataShareGet('todo');
        if (asUid) headers['X-Data-As'] = asUid;
        var res = await fetch('/api/todo/attachments', { method: 'POST', headers: headers, body: fd });
        var d = await res.json().catch(function(){ return {}; });
        if (!res.ok || !d.success) throw new Error(d.message || '上传失败');
        return d.attachment;
      }
    });
  })();
  // 编辑时分类归属规则:
  //   个人顶层任务 → 共享分类可选(移入); 共享顶层任务 → 共享选项灰显回显, 选"无分类"/个人分类即移出(仅分类 owner);
  //   非 owner 成员(editor) → 整个分类下拉禁用(别人创建的共享任务不可移入/移出); 子任务 → 归属继承父任务, 共享选项禁用
  var _catPref = node.shared_cat_id != null ? ('sc:' + node.shared_cat_id) : (node.category || '');
  var _isSharedRoot = !isChild && node.shared_cat_id != null;
  var _myCatRole = null;
  if (_isSharedRoot) {
    var _mc = _sharedCats.filter(function(c){ return c.cat_id === node.shared_cat_id; })[0];
    _myCatRole = _mc ? _mc.role : null;
  }
  todoFillCategoryOptions(_rows, _catPref, { disableShared: !(!isChild && node.shared_cat_id == null) });
  if (_isSharedRoot && _myCatRole !== 'owner') {
    var _catSelEl = document.getElementById('tfCatSel');
    if (_catSelEl) _catSelEl.disabled = true;
  }
  var _doSave = async function(body){
    await api('/api/todo/' + node.id, { method:'PUT', body: body });
    closeModal(); await loadTodos(); await loadChart();
    // 主任务切到"子任务各自设日期"后自身无日期, 空容器在"今日+逾期"等筛选下会消失 → 自动跳到"全部"
    if (!isChild && body.child_due === 1) switchTodoFilter('all');
  };
  bindClickBusy(document.getElementById('tfSave'), async function(){
    var body = todoFormRead();
    if (!body.title) { alertModal('请填写标题', {ok:false}); return; }
    // child_due 模式下子任务截止日期必填(与快捷添加框同口径)
    if (isChild && fopts.childDueMode && !body.due_date) { alertModal('请选择截止日期（默认今天）', {ok:false}); return; }
    // 归属变更(移入/移出共享分类)影响整棵任务树可见性, 二次确认(复用 confirmModal; 取消即放弃本次编辑)
    var _fromCat = node.shared_cat_id != null ? node.shared_cat_id : null;
    var _toCat = body.shared_cat_id ? parseInt(body.shared_cat_id, 10) : null;
    if (!isChild && _toCat !== _fromCat && (_toCat != null || _fromCat != null)) {
      var _movingIn = _toCat != null;
      var _scName = _movingIn
        ? ((_sharedCats.filter(function(c){ return c.cat_id === _toCat; })[0] || {}).name || '共享分类')
        : '';
      confirmModal(
        _movingIn ? '移入共享分类' : '移出共享分类',
        _movingIn
          ? '该任务及其全部子任务将移入「' + _scName + '」，分类全体成员可见、可编辑（仅创建者可删除）。确认移入？'
          : '该任务及其全部子任务将移回你的个人清单，其他分类成员将不再可见。确认移出？',
        function(){ return _doSave(body); }
      );
      return;
    }
    await _doSave(body);
  });
}
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
    onDetail: function(node){
      openTodoDetail(node, {
        today: todayStr(),
        editable: true,
        onEdit: function(n){ openTodoEdit(n); },
        listAttachments: async function(id){
          var r = await api('/api/todo/' + id + '/attachments');
          return r.attachments || [];
        }
      });
    },
    onToggleRecur: function(node){
      var dueDate = node.due_date || todayStr();
      var defaultNext = shiftDateLocal(dueDate, node.recurrence, false, todayStr(), node.recur_interval, node.recur_nth, node.recur_weekday);
      var jumpNext = shiftDateLocal(dueDate, node.recurrence, true, todayStr(), node.recur_interval, node.recur_nth, node.recur_weekday);
      var sameDate = defaultNext === jumpNext;
      var _t = todayStr();
      var html =
        '<p style="margin:6px 0;">📝 ' + esc(node.title) + '（' + todoRecurLabel(node.recurrence, node.recur_interval, node.recur_nth, node.recur_weekday) + '）</p>' +
        '<p class="muted" style="margin:4px 0 14px;">本次截止：' + esc(todoDateLabel(dueDate, _t)) + ' <span style="color:var(--faint);">(' + dueDate + ')</span></p>' +
        '<p style="margin:6px 0;">完成后自动生成下一条任务，日期：</p>' +
        '<label style="display:block;padding:8px 4px;"><input type="radio" name="rjump" value="0" checked style="width:auto;margin-right:8px;"> ' + todoDateLabel(defaultNext, _t) + ' <span style="color:var(--faint);font-size:12px;">(' + defaultNext + ')</span>（下一周期，默认）</label>' +
        (sameDate ? '' :
          '<label style="display:block;padding:8px 4px;"><input type="radio" name="rjump" value="1" style="width:auto;margin-right:8px;"> ' + todoDateLabel(jumpNext, _t) + ' <span style="color:var(--faint);font-size:12px;">(' + jumpNext + ')</span>（跳到当前周期）</label>') +
        '<div style="text-align:right;margin-top:14px;"><button type="button" class="btn gray" onclick="closeModal()">取消</button> <button type="button" class="btn" id="rrConfirm">完成并生成</button></div>';
      openModal('✅ 完成重复任务', html);
      bindClickBusy(document.getElementById('rrConfirm'), async function(){
        var jr = document.querySelector('input[name="rjump"]:checked');
        var jumpToCurrent = !!(jr && jr.value === '1');
        await api('/api/todo/' + node.id + '/done', { method:'PUT', body:{ done: true, jumpToCurrent: jumpToCurrent } });
        closeModal();
        await loadTodos(); await loadChart();
        var cc = todoCelebrationCount(todoBuildTree(_rows), true);
        todoCelebrate(cc.remaining, cc.total);
      });
    },
    onToggle: async function(node, done){
      if (!(await todoConfirmDoneIfPending(node, done))) return;
      try {
        await api('/api/todo/' + node.id + '/done', { method:'PUT', body:{ done: done } });
        await loadTodos(); await loadChart();
        if (done) {
          var cc = todoCelebrationCount(todoBuildTree(_rows), true);
          todoCelebrate(cc.remaining, cc.total);
        }
      }
      catch(e){ alertModal(e.message, {ok:false}); }
    },
    onEdit: function(node){ openTodoEdit(node); },
    onAddChildSubmit: async function(node, payload){
      await api('/api/todo', { method:'POST', body: payload });
      await loadTodos(); await loadChart();
    },
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
  // 子任务: 按所在主任务的 child_due 模式决定表单(新建即为叶子, canRecur=true)
  var fopts = {};
  if (parentId != null) {
    var pRow = _rows.filter(function(r){ return r.id === parentId; })[0];
    if (pRow) fopts = { childDueMode: !!todoRootRowOf(_rows, pRow).child_due, canRecur: true };
  }
  openModal(title, todoFormHtml({}, true, !!isChild, fopts) +
    '<div style="margin-top:12px;"><button class="btn" id="tfCreate">创建</button> <button class="btn gray" onclick="closeModal()">取消</button></div>');
  // 新建时若抽屉选中了分类则预填下拉(文本分类或共享分类 sc:<id>), 便于连续录入
  // 子任务分类继承父任务(后端处理), 表单中共享分类选项禁用
  var pref = (_todoCategory && _todoCategory !== '__none__') ? _todoCategory : '';
  todoFillCategoryOptions(_rows, pref, { disableShared: parentId != null });
  bindClickBusy(document.getElementById('tfCreate'), async function(){
    var body = todoFormRead();
    if (!body.title) { alertModal('请填写标题', {ok:false}); return; }
    if (parentId != null) body.parent_id = parentId;
    await api('/api/todo', { method:'POST', body: body });
    closeModal(); await loadTodos(); await loadChart();
    // 新建"子任务各自设日期"的主任务后, 空容器在"今日+逾期"等筛选下不显示 → 自动跳到"全部"
    if (body.child_due === 1) switchTodoFilter('all');
  });
}
// ==================== 共享分类（登录账号 + 邀请码协作）====================
// 我参与的共享分类缓存(mine 接口): [{cat_id, name, role, owner_name, member_count, code}]
// 定义在共享核心里, 免密页面不填充(为空), 抽屉渲染时空数组即不显示该段
var _sharedCats = [];
async function loadSharedCats() {
  try { var d = await api('/api/todo/shared-cats/mine'); _sharedCats = d.cats || []; }
  catch(e) { _sharedCats = []; }
}
// 复制到剪贴板: 优先 Clipboard API(需安全上下文), 降级 execCommand; 不依赖设置页的 dsFallbackCopy
function scCopy(text, okMsg) {
  function ok(){ todoToast(okMsg || '已复制到剪贴板'); }
  function fallback() {
    var t = document.createElement('textarea');
    t.value = text;
    t.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    document.body.appendChild(t);
    t.focus(); t.select();
    var copied = false;
    try { copied = document.execCommand('copy'); } catch (e) { copied = false; }
    document.body.removeChild(t);
    if (copied) ok();
    else alertModal('复制失败，请手动复制：' + text, { ok: false });
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(ok, fallback);
  } else fallback();
}
// 共享分类主面板：新建/加入 + 我参与的分类列表
function openSharedCatPanel() {
  api('/api/todo/shared-cats/mine').then(function(d){
    _sharedCats = d.cats || [];
    var rows = _sharedCats.map(function(c){
      var roleTag = c.role === 'owner'
        ? '<span class="todo-chip cat">创建者</span>'
        : '<span class="todo-chip" style="background:var(--surface-2);color:var(--muted);">成员</span>';
      var ops;
      if (c.role === 'owner') {
        ops = '<button class="btn sm gray" onclick="scInvite(' + c.cat_id + ')">邀请</button> '
            + '<button class="btn sm gray" onclick="scMembers(' + c.cat_id + ')">成员(' + c.member_count + ')</button> '
            + '<button class="btn sm danger" onclick="scDissolve(' + c.cat_id + ')">解散</button>';
      } else {
        ops = '<button class="btn sm danger" onclick="scLeave(' + c.cat_id + ')">退出</button>';
      }
      return '<div style="padding:10px 0;border-bottom:1px solid #eef0f4;">'
        + '<div style="font-weight:600;margin-bottom:6px;">👥 ' + esc(c.name) + ' ' + roleTag
        + '<span class="muted" style="font-size:12px;font-weight:normal;">' + (c.role === 'owner' ? '' : '来自 ' + esc(c.owner_name) + ' · ') + c.member_count + ' 人</span></div>'
        + '<div style="text-align:right;">' + ops + '</div>'
        + '</div>';
    }).join('');
    openModal('👥 共享分类',
      '<div style="margin-bottom:12px;">'
      + '<button class="btn sm" onclick="scCreate()" style="margin-right:6px;">➕ 新建共享分类</button>'
      + '<button class="btn sm gray" onclick="scJoin()">🔗 加入分类</button>'
      + '</div>'
      + (rows || '<p class="muted">还没有共享分类。新建一个，或凭家人的邀请码加入。</p>')
      + '<div style="text-align:right;margin-top:12px;"><button class="btn gray" onclick="closeModal()">关闭</button></div>');
  }).catch(function(e){ alertModal(e.message, {ok:false}); });
}
function scCreate() {
  openModal('新建共享分类',
    '<p class="muted" style="margin:0 0 8px;">创建一个共享分类（如「家庭」），家人凭邀请码加入后，分类下的待办对大家可见可协作，也会出现在每位成员的日报中。</p>' +
    '<input id="scNewName" placeholder="分类名称，如：家庭" style="width:100%;padding:8px;border:1px solid #d4d8e0;border-radius:6px;box-sizing:border-box;">' +
    '<div style="text-align:right;margin-top:14px;"><button class="btn gray" onclick="closeModal()">取消</button> <button class="btn" id="scCreateOk">创建</button></div>');
  bindClickBusy(document.getElementById('scCreateOk'), async function(){
    var name = (document.getElementById('scNewName').value || '').trim();
    if (!name) { alertModal('请填写分类名称', {ok:false}); return; }
    var r = await api('/api/todo/shared-cats', { method:'POST', body:{ name: name } });
    closeModal();
    await loadSharedCats(); await loadTodos();
    openCatInvite(r.id, r.code, r.link, true);
  });
}
function scJoin() {
  openModal('加入共享分类',
    '<p class="muted" style="margin:0 0 8px;">输入家人分享的 8 位邀请码（或直接打开家人发的邀请链接）。</p>' +
    '<input id="scJoinCode" placeholder="邀请码" style="width:100%;padding:8px;border:1px solid #d4d8e0;border-radius:6px;box-sizing:border-box;letter-spacing:2px;">' +
    '<div style="text-align:right;margin-top:14px;"><button class="btn gray" onclick="closeModal()">取消</button> <button class="btn" id="scJoinOk">加入</button></div>');
  bindClickBusy(document.getElementById('scJoinOk'), async function(){
    var code = (document.getElementById('scJoinCode').value || '').trim();
    if (!code) { alertModal('请输入邀请码', {ok:false}); return; }
    var r = await api('/api/todo/shared-cats/join', { method:'POST', body:{ code: code } });
    closeModal();
    await loadSharedCats(); await loadTodos(); await loadChart();
    todoToast(r.message || '已加入共享分类');
    openSharedCatPanel();
  });
}
// 邀请码/链接（owner）；code/link 缺省时拉取
async function openCatInvite(id, code, link, justCreated) {
  if (!code) {
    var d = await api('/api/todo/shared-cats/' + id + '/invite');
    code = d.code; link = d.link;
  }
  openModal(justCreated ? '共享分类已创建' : '邀请家人',
    '<p style="margin:0 0 8px;">把邀请链接发给家人，家人登录后打开链接即可加入；也可在「加入分类」中手动输入 8 位邀请码。</p>' +
    '<div style="background:var(--surface-2);border-radius:6px;padding:10px;margin-bottom:10px;">' +
      '<div style="font-size:22px;font-weight:700;letter-spacing:3px;text-align:center;">' + esc(code) + '</div></div>' +
    '<input readonly value="' + esc(link || '') + '" onfocus="this.select()" style="width:100%;padding:8px;border:1px solid #d4d8e0;border-radius:6px;box-sizing:border-box;margin-bottom:10px;">' +
    '<div style="text-align:right;"><button class="btn gray" id="scInvReset">重置邀请码</button> <button class="btn gray" id="scInvCopy">复制链接</button> <button class="btn" onclick="closeModal()">完成</button></div>');
  document.getElementById('scInvCopy').addEventListener('click', function(){ scCopy(link); });
  document.getElementById('scInvReset').addEventListener('click', function(){
    confirmModal('重置邀请码', '重置后旧邀请码立即失效（已加入的成员不受影响）。确认？', async function(){
      var r = await api('/api/todo/shared-cats/' + id + '/invite/reset', { method:'POST' });
      todoToast('邀请码已重置，旧码已失效');
      openCatInvite(id, r.code, null, false);
    });
  });
}
function scInvite(id) {
  openCatInvite(id, null, null, false).catch(function(e){ alertModal(e.message, {ok:false}); });
}
function scMembers(id) {
  api('/api/todo/shared-cats/' + id + '/members').then(function(d){
    var rows = d.members.map(function(m){
      var tag = m.role === 'owner'
        ? '<span class="todo-chip cat">创建者</span>'
        : '<span class="todo-chip" style="background:var(--surface-2);color:var(--muted);">成员</span>';
      var kick = (m.role !== 'owner')
        ? ' <button class="btn sm gray" onclick="scKick(' + id + ',' + m.user_id + ')">移出</button>' : '';
      return '<div style="padding:8px 0;border-bottom:1px solid #eef0f4;display:flex;justify-content:space-between;align-items:center;">'
        + '<span>👤 ' + esc(m.nickname) + ' ' + tag + '</span>' + kick + '</div>';
    }).join('');
    openModal('成员管理 · ' + d.name,
      rows + '<div style="text-align:right;margin-top:12px;"><button class="btn gray" onclick="closeModal()">关闭</button></div>');
  }).catch(function(e){ alertModal(e.message, {ok:false}); });
}
function scKick(catId, uid) {
  confirmModal('移出成员', '确定把该成员移出分类？移出后其将看不到该分类的待办（不影响已录入的数据）。', async function(){
    await api('/api/todo/shared-cats/' + catId + '/members/' + uid, { method:'DELETE' });
    await loadSharedCats();
    todoToast('已移出该成员');
    openSharedCatPanel();
  });
  return false;
}
function scLeave(id) {
  confirmModal('退出共享分类', '退出后你将不再看到该分类的待办与日报内容（可凭邀请码重新加入）。确认？', async function(){
    await api('/api/todo/shared-cats/' + id + '/leave', { method:'POST' });
    closeModal();
    await loadSharedCats(); await loadTodos(); await loadChart();
    todoToast('已退出共享分类');
    openSharedCatPanel();
  });
}
function scDissolve(id) {
  confirmModal('解散共享分类', '解散后分类下的任务保留为你的个人待办（摘掉共享标签），所有成员失去访问权。确认解散？', async function(){
    await api('/api/todo/shared-cats/' + id, { method:'DELETE' });
    closeModal();
    await loadSharedCats(); await loadTodos(); await loadChart();
    todoToast('已解散，任务保留为个人待办');
    openSharedCatPanel();
  });
}
// 删除个人文本分类(抽屉「📂 分类」段 ✕): 仅摘掉分类标签, 任务全部保留为未分类;
// 免密页(public/report/collab)未定义此函数, 抽屉自动不渲染删除按钮
function onTodoDeleteCat(name) {
  var n = 0;
  _rows.forEach(function(r){ if (r.parent_id == null && r.shared_cat_id == null && r.category === name) n++; });
  confirmModal('删除分类', '删除后分类「' + name + '」下的 ' + n + ' 个顶层任务将转为「未分类」，任务本身不会被删除。确认删除？', async function(){
    await api('/api/todo/categories?name=' + encodeURIComponent(name), { method: 'DELETE' });
    if (_todoCategory === name) _todoCategory = null;
    await loadTodos();
    if (_todoView !== 'default') applyTodoView(_todoGetRows, drawTree);
    todoToast('分类已删除，任务已转为未分类');
  });
}
// 重命名个人文本分类(抽屉「📂 分类」段 ✎): 弹窗输入新名, 该分类下任务批量改挂; 重名由后端拒绝
function onTodoRenameCat(name) {
  openModal('重命名分类',
    '<p class="muted" style="margin:0 0 8px;">输入新的分类名称，该分类下所有任务将同步改挂新名称。</p>' +
    '<input id="catRenameInput" value="' + esc(name) + '" placeholder="分类名称" style="width:100%;padding:8px;border:1px solid #d4d8e0;border-radius:6px;box-sizing:border-box;">' +
    '<div style="text-align:right;margin-top:14px;"><button class="btn gray" onclick="closeModal()">取消</button> <button class="btn" id="catRenameOk">保存</button></div>');
  var input = document.getElementById('catRenameInput');
  if (input) {
    input.focus(); input.select();
    input.addEventListener('keydown', function(e){ if (e.key === 'Enter') document.getElementById('catRenameOk').click(); });
  }
  bindClickBusy(document.getElementById('catRenameOk'), async function(){
    var newName = (input.value || '').trim();
    if (!newName) { alertModal('请填写分类名称', {ok:false}); return; }
    if (newName === name) { closeModal(); return; }
    await api('/api/todo/categories', { method: 'PUT', body: { old: name, name: newName } });
    closeModal();
    if (_todoCategory === name) _todoCategory = newName;
    await loadTodos();
    if (_todoView !== 'default') applyTodoView(_todoGetRows, drawTree);
    todoToast('分类已重命名');
  });
}
bindClickBusy(document.getElementById('tListBtn'), function(){ openSharedCatPanel(); return Promise.resolve(); });
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
  // 未完成/已逾期/备忘录 按当前筛选后的可见顶层树重算
  renderPendingStats();
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
bindTodoChartRefresh(loadChart);
// 任务分析弹窗（登录态，随 X-Data-As 数据源切换）
document.getElementById('todoAnalyzeBtn').addEventListener('click', function(){
  openTodoAnalysis(function(days){ return '/api/todo/analyze?days=' + days; });
});

// 推送配置（待办日报）
var tPushHourPick = null, tPushChannelPick = null;
async function loadPush() {
  // 两个请求互不依赖, 并行发出省一个往返(高 RTT 环境明显)
  var _rs = await Promise.all([api('/api/notify/channels'), api('/api/push/todo')]);
  var chs = _rs[0], d = _rs[1];
  var items = chs.channels.map(function(c){ return { value: c.id, label: c.name + ' [' + c.type + ']' }; });
  tPushChannelPick = initListPick(document.getElementById('pushCh'), items, d.config.channel_ids || []);
  document.getElementById('pushFmt').value = d.config.format || 'text';
  tPushHourPick = initMultiPick(document.getElementById('pushHour'), 0, 23, d.config.hours || [9], function(n){ return n + '点'; });
  document.getElementById('pushEn').checked = !!d.config.enabled;
}
bindClickBusy(document.getElementById('pushSave'), async function(){
  if (!requirePushChannels(tPushChannelPick)) return;
  await api('/api/push/todo', { method:'PUT', body:{
    channel_ids: tPushChannelPick ? tPushChannelPick.getValues() : [],
    format: document.getElementById('pushFmt').value,
    hours: tPushHourPick ? tPushHourPick.getString() : '9',
    enabled: document.getElementById('pushEn').checked
  }});
  alertModal('推送配置已保存');
});
bindClickBusy(document.getElementById('pushSend'), async function(){
  if (!requirePushChannels(tPushChannelPick)) return;
  setLoadingProgress(90);
  var r = await api('/api/push/todo/send', { method:'POST', loadingText: '正在发送待办日报…' });
  alertModal(r.message || '已推送');
});

(async function(){
  try {
    // 先解析深链: ?root=<id> 在首次渲染前就锁定详情视图, 避免先闪列表再进详情
    var _q = new URLSearchParams(location.search);
    var _deepRoot = _q.get('root');
    if (_deepRoot) { _todoDetailRootId = Number(_deepRoot); }
    // 首屏请求全部并行发出(互不依赖, DOM 元素均在静态 HTML 中), 等待总时长取最慢者而非累加
    var _catsReady = loadSharedCats();
    var _chartReady = loadChart();
    var _pushReady = loadPush();
    await loadTodos();
    await _catsReady; await _chartReady; await _pushReady;
    // 应用视图状态: localStorage 里可能已有 'card'/'tree', 首次进入直接全屏
    // （?root 已在加载前解析为 _todoDetailRootId, 首帧直接渲染详情, 不闪列表）
    applyTodoView(_todoGetRows, drawTree);
    // ?join=<code>: 邀请链接落地, 确认后加入共享分类(加入成功会刷新列表, 抽屉出现该分类)
    var _joinCode = _q.get('join');
    if (_joinCode) {
      history.replaceState(null, '', location.pathname);
      confirmModal('加入共享分类', '确认加入该共享分类？加入后，分类下待办会出现在你的待办页（左侧抽屉「共享分类」）与每日日报中。', async function(){
        try {
          var r = await api('/api/todo/shared-cats/join', { method:'POST', body:{ code: _joinCode } });
          await loadSharedCats();
          await loadTodos(); await loadChart();
          alertModal(r.message || '已加入');
        } catch(e) { alertModal(e.message, {ok:false}); }
      });
    }
    // 深链消费过参数后清地址, 避免刷新重复弹窗（_deepRoot 时连 root 一起清）
    if (_deepRoot || _q.get('add') || _q.get('addChild') || _q.get('edit') || _q.get('join')) history.replaceState(null, '', location.pathname);
    // 小组件「新增」入口: ?add=1 新建主任务(顶层, 不进详情)
    if (_q.get('add') === '1') {
      history.replaceState(null, '', location.pathname);
      openAddForm(null, '新建任务', false);
    }
    // ?addChild: 在详情画面上弹该主任务的添加子任务表单
    var _addChildId = _q.get('addChild');
    if (_addChildId) {
      history.replaceState(null, '', location.pathname);
      var _addParent = (_rows || []).filter(function(r){ return String(r.id) === String(_addChildId); })[0];
      openAddForm(Number(_addChildId), _addParent && _addParent.title ? '添加子任务 · ' + _addParent.title : '添加子任务', true);
    }
    // ?edit: 在详情画面上弹该任务编辑弹窗。必须从 todoBuildTree 树节点取(openTodoEdit 读
    // node.children/node._root, 扁平 _rows 节点无 children 会抛 undefined.length)
    var _editId = _q.get('edit');
    if (_editId) {
      history.replaceState(null, '', location.pathname);
      var _node = (function(){
        var found = null;
        (function walk(list){
          list.forEach(function(n){
            if (found) return;
            if (String(n.id) === String(_editId)) { found = n; return; }
            walk(n.children || []);
          });
        })(todoBuildTree(_rows || []));
        return found;
      })();
      if (_node) openTodoEdit(_node);
    }
  }
  catch(e){ if (String(e.message).indexOf('登录')>=0) navTo('/login'); else alertModal(e.message, {ok:false}); }
})();
`;

// ============ 待办免密协作公开页 ============
const PUBLIC_TODO_JS = `
bindModal();
bindQuickLogin('todo');
var _token = location.pathname.split('/').filter(Boolean).pop();
var _rows = [], _rootId = null, _today = '';
var _curRange = 'month';

// 单清单协作页编辑任务（仅编辑已有任务挂 md 编辑器；附件走清单 share_token）
function openPublicEdit(node) {
  var isChild = node.id !== _rootId;
  var fopts = isChild
    ? { childDueMode: !!(node._root && node._root.child_due), canRecur: node.children.length === 0 }
    : { lockChildDue: true, forceChildDue: !!node.child_due };
  openModal('编辑任务', todoFormHtml(node, false, isChild, fopts) +
    '<div style="margin-top:12px;"><button class="btn" id="tfSave">保存</button> <button class="btn gray" onclick="closeModal()">取消</button></div>');
  todoFillCategoryOptions(_rows, node.category || '');
  (async function(){
    var noteEl = document.getElementById('tfNote'); if (!noteEl) return;
    var lim = await api('/api/public/attach-max-mb').catch(function(){ return { max_mb: 5 }; });
    mountTodoMdEditor(noteEl, {
      maxMb: lim.max_mb || 5,
      upload: async function(file) {
        var fd = new FormData();
        fd.append('todo_id', node.id);
        fd.append('file', file);
        var res = await fetch('/api/public/todo-att/' + _token, { method: 'POST', body: fd });
        var d = await res.json().catch(function(){ return {}; });
        if (!res.ok || !d.success) throw new Error(d.message || '上传失败');
        return d.attachment;
      }
    });
  })();
  bindClickBusy(document.getElementById('tfSave'), async function(){
    var body = todoFormRead();
    if (!body.title) { alertModal('请填写标题', {ok:false}); return; }
    await api('/api/public/todo/' + _token + '/' + node.id, { method:'PUT', body: body });
    closeModal(); await loadPublic();
  });
}
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
// 可见树：免密协作页只覆盖一棵指定子树(被分享的顶层任务本身), 无论其 due_date
// 直接返回 todoBuildTree(_rows) 即可, 不做日期过滤(否则备忘录/未来任务会被误藏)
function visibleTrees() {
  return todoBuildTree(_rows);
}
// 统计（口径同日报 statsOfReport）：基于可见树，叶子有效日期=自身 due_date 优先否则继承祖先
// 已完成一栏改为"当月完成"(免密单链接页无 filter, 默认按月)
function renderStats(trees) {
  var pending = 0, overdue = 0;
  function walk(node, inheritedDue){
    // 完成节点代表该分支已结束，后代状态保留但不计入未完成/逾期
    if (node.done) return;
    var own = node.due_date || inheritedDue;
    if (node.children.length > 0) {
      // 有子任务：父不计入，仅递归统计子任务（叶子口径，与后端 countStats 一致）
      node.children.forEach(function(c){ walk(c, own); });
      return;
    }
    if (node.child_due) return; // child_due 新模式空容器(此页即被分享的根任务本身)是分组壳, 不计待办
    if (!node.done) {
      pending++;
      if (own && _today && own < _today) overdue++;
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
  // 若已切到 tree/card 全屏, 用扁平 rows 按分类过滤后重建树; 默认页面沿用传入的 visibleTrees
  // 免密协作页范围本就限定在该子树, 不再叠加日期过滤(与 visibleTrees 一致)
  var effectiveTrees = trees;
  if (_todoView !== 'default' && _todoCategory != null && _todoCategory !== '__all__') {
    effectiveTrees = todoBuildTree(todoRowsByCategory(_rows));
  }
  // 免密单链接页只覆盖一个顶层子树, 时间筛选无意义; 仅支持"隐藏已完成"
  var hideBox = document.getElementById('hideDone');
  var hideDone = hideBox ? hideBox.checked : false;
  todoRenderView(container, effectiveTrees, {
    view: _todoView === 'default' ? 'card' : _todoView,
    detailRootId: _todoDetailRootId,
    crumbEl: crumb,
    today: _today, hideDone: hideDone,
    onExitDetail: function(){ _todoDetailRootId = null; drawTree(visibleTrees()); },
    onEnter: function(node){ _todoDetailRootId = node.id; drawTree(visibleTrees()); },
    onDetail: function(node){
      openTodoDetail(node, {
        today: _today,
        editable: true,
        onEdit: function(n){ openPublicEdit(n); },
        listAttachments: async function(id){
          var r = await api('/api/public/todo-att/' + _token + '?todo_id=' + id);
          return r.attachments || [];
        }
      });
    },
    onToggle: async function(node, done){
      if (!(await todoConfirmDoneIfPending(node, done))) return;
      try {
        await api('/api/public/todo/' + _token + '/' + node.id + '/done', { method:'PUT', body:{ done: done } });
        await loadPublic();
        if (done) {
          // 庆祝口径与可见列表一致：完成父任务后整枝不再计入
          var cc = todoCelebrationCount(visibleTrees());
          todoCelebrate(cc.remaining, cc.total);
        }
      }
      catch(e){ alertModal(e.message, {ok:false}); }
    },
    onEdit: openPublicEdit,
    onAddChildSubmit: async function(node, payload){
      await api('/api/public/todo/' + _token, { method:'POST', body: payload });
      await loadPublic();
    },
    onReorder: async function(parentId, ids){
      try { await api('/api/public/todo/' + _token + '/reorder', { method:'PUT', body:{ parent_id: parentId, ids: ids } }); await loadPublic(); }
      catch(e){ alertModal(e.message, {ok:false}); await loadPublic(); }
    }
  });
}
function openAddForm(parentId, title) {
  // 单清单页恒为子任务: 按根任务 child_due 模式决定日期/重复控件(新建即为叶子)
  var rootRow = _rows.filter(function(r){ return r.id === _rootId; })[0];
  var fopts = { childDueMode: !!(rootRow && rootRow.child_due), canRecur: true };
  openModal(title, todoFormHtml({}, true, true, fopts) +
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
bindTodoChartRefresh(loadChart);
// hideDone 复选框: 变化时仅重绘可见树, 不重拉数据
var _hb = document.getElementById('hideDone');
if (_hb) _hb.addEventListener('change', function(){ drawTree(visibleTrees()); });
loadPublic();
`;

// ============ 待办免密报告查看页（只读） ============
const TODO_REPORT_JS = `
bindModal();
bindQuickLogin('todo-report');
var _token = location.pathname.split('/').filter(Boolean).pop();
var _curRange = 'month';
var _rows = [], _trees = [], _today = '';
var _filter = 'cur'; // all | cur | today | overdue | future | memo | done ; 默认今日+逾期
function _todoGetRows() { return _rows; }
async function loadChart() {
  try { var c = await api('/api/public/todo-chart/' + _token + '?range=' + _curRange); drawTodoChart('todoChart', c.series); }
  catch(e){ /* 图表失败不阻断 */ }
}
// 任务分析弹窗（免密报告页，report_token 用户级口径）
(function(){
  var btn = document.getElementById('todoAnalyzeBtn');
  if (btn) btn.addEventListener('click', function(){
    openTodoAnalysis(function(days){ return '/api/public/todo-analyze/' + _token + '?days=' + days; });
  });
})();
// 按当前 _filter 过滤后的可见顶层树重算 未完成/已逾期 两项统计(此页无 memo 卡片)
function renderPendingStats() {
  var trees = _trees.filter(function(n){ return todoRootPassFilter(n, _filter, _today); });
  var s = todoStatsByVisible(trees, _today);
  document.getElementById('stPending').textContent = s.pending;
  document.getElementById('stOverdue').textContent = s.overdue;
}
function drawTree() {
  // 时间筛选 tab: 与登录态 TODO_JS 逻辑一致(顶层显示日期 todoRootDue 口径)
  var filtered = _trees.filter(function(n){ return todoRootPassFilter(n, _filter, _today); });
  // 全屏态下按抽屉选中的分类过滤扁平 rows 重新建树
  var trees = filtered;
  if (_todoView !== 'default' && _todoCategory != null && _todoCategory !== '__all__') {
    var byCat = todoBuildTree(todoRowsByCategory(_rows));
    // 分类过滤后再按当前 filter 过滤一次(保持两者协同)
    trees = byCat.filter(function(n){ return todoRootPassFilter(n, _filter, _today); });
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
    onDetail: function(node){
      openTodoDetail(node, {
        today: _today,
        editable: true,
        onEdit: function(n){ openReportEdit(n); },
        listAttachments: async function(id){
          var r = await api('/api/public/todo-att/' + _token + '?todo_id=' + id);
          return r.attachments || [];
        }
      });
    },
    // 顶层重复任务勾选前弹窗选下一日期(与 TODO_COLLAB_JS 同口径)
    onToggleRecur: function(node){
      var dueDate = node.due_date || _today;
      var defaultNext = shiftDateLocal(dueDate, node.recurrence, false, _today, node.recur_interval, node.recur_nth, node.recur_weekday);
      var jumpNext = shiftDateLocal(dueDate, node.recurrence, true, _today, node.recur_interval, node.recur_nth, node.recur_weekday);
      var sameDate = defaultNext === jumpNext;
      var html =
        '<p style="margin:6px 0;">📝 ' + esc(node.title) + '（' + todoRecurLabel(node.recurrence, node.recur_interval, node.recur_nth, node.recur_weekday) + '）</p>' +
        '<p class="muted" style="margin:4px 0 14px;">本次截止：' + esc(todoDateLabel(dueDate, _today)) + ' <span style="color:var(--faint);">(' + dueDate + ')</span></p>' +
        '<p style="margin:6px 0;">完成后自动生成下一条任务，日期：</p>' +
        '<label style="display:block;padding:8px 4px;"><input type="radio" name="rjump" value="0" checked style="width:auto;margin-right:8px;"> ' + todoDateLabel(defaultNext, _today) + ' <span style="color:var(--faint);font-size:12px;">(' + defaultNext + ')</span>（下一周期，默认）</label>' +
        (sameDate ? '' :
          '<label style="display:block;padding:8px 4px;"><input type="radio" name="rjump" value="1" style="width:auto;margin-right:8px;"> ' + todoDateLabel(jumpNext, _today) + ' <span style="color:var(--faint);font-size:12px;">(' + jumpNext + ')</span>（跳到当前周期）</label>') +
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
      if (!(await todoConfirmDoneIfPending(node, done))) return;
      try {
        await api('/api/public/todo-all/' + _token + '/' + node.id + '/done', { method:'PUT', body:{ done: done } });
        await reloadReport();
        if (done) {
          // 庆祝口径与当前任务树一致：完成父任务后整枝不再计入
          var cc = todoCelebrationCount(_trees, true);
          todoCelebrate(cc.remaining, cc.total);
        }
      }
      catch(e){ alertModal(e.message, {ok:false}); }
    },
    onEdit: function(node){ openReportEdit(node); },
    onAddChildSubmit: async function(node, payload){
      await api('/api/public/todo-all/' + _token, { method:'POST', body: payload });
      await reloadReport();
    },
    onReorder: async function(parentId, ids){
      try { await api('/api/public/todo-all/' + _token + '/reorder', { method:'PUT', body:{ parent_id: parentId, ids: ids } }); await reloadReport(); }
      catch(e){ alertModal(e.message, {ok:false}); await reloadReport(); }
    }
  });
}
// 编辑任务弹窗(报告页 /tr/, 走 todo-all API); opts.onEdit 与组件 ?edit 深链共用
function openReportEdit(node) {
  var isChild = node.parent_id != null;
  // 报告页(所有者本人): 主任务可切 child_due; 子任务按根模式显示日期/重复(仅叶子)
  var fopts = isChild
    ? { childDueMode: !!(node._root && node._root.child_due), canRecur: node.children.length === 0 }
    : {};
  var _rootTitle = isChild && node._root ? node._root.title : '';
  openModal(isChild ? (_rootTitle ? '编辑子任务 · ' + _rootTitle : '编辑子任务') : '编辑任务',
    todoFormHtml(node, false, isChild, fopts) +
    '<div style="margin-top:12px;"><button class="btn" id="tfSave">保存</button> <button class="btn gray" onclick="closeModal()">取消</button></div>');
  todoFillCategoryOptions(_rows, node.category || '');
  (async function(){
    var noteEl = document.getElementById('tfNote'); if (!noteEl) return;
    var lim = await api('/api/public/attach-max-mb').catch(function(){ return { max_mb: 5 }; });
    mountTodoMdEditor(noteEl, {
      maxMb: lim.max_mb || 5,
      upload: async function(file) {
        var fd = new FormData();
        fd.append('todo_id', node.id);
        fd.append('file', file);
        var res = await fetch('/api/public/todo-att/' + _token, { method: 'POST', body: fd });
        var d = await res.json().catch(function(){ return {}; });
        if (!res.ok || !d.success) throw new Error(d.message || '上传失败');
        return d.attachment;
      }
    });
  })();
  bindClickBusy(document.getElementById('tfSave'), async function(){
    var body = todoFormRead();
    if (!body.title) { alertModal('请填写标题', {ok:false}); return; }
    await api('/api/public/todo-all/' + _token + '/' + node.id, { method:'PUT', body: body });
    closeModal(); await reloadReport();
  });
}
// 新建任务/子任务弹窗: parentId=null → 顶层主任务(可设日期/重复/独立截止模式); 传 id → 子任务
// 与 TODO_COLLAB_JS 同口径, 走 report_token 的 /api/public/todo-all/:token API
function openAddForm(parentId, title, isChild) {
  // 子任务: 按所在主任务的 child_due 模式决定表单(新建即为叶子, canRecur=true)
  var fopts = {};
  if (parentId != null) {
    var pRow = _rows.filter(function(r){ return r.id === parentId; })[0];
    if (pRow) fopts = { childDueMode: !!todoRootRowOf(_rows, pRow).child_due, canRecur: true };
  }
  openModal(title, todoFormHtml({}, true, !!isChild, fopts) +
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
  _rows = d.todos || [];
  _trees = todoBuildTree(_rows);
  _today = d.today || '';
  renderPendingStats();
  document.getElementById('stDone').textContent = todoDoneByFilter(_rows, _filter, _today, _curRange);
  updateStatsHint(_filter, _curRange);
  drawTree();
  loadChart();
}
(async function(){
  try {
    // 先解析深链: ?root=<id> 在首帧渲染前就锁定详情视图, 避免先闪列表再进详情
    var _rq = new URLSearchParams(location.search);
    var _deepRoot = _rq.get('root');
    if (_deepRoot) _todoDetailRootId = Number(_deepRoot);
    var d = await api('/api/public/todo-report/' + _token);
    document.getElementById('content').style.display = 'block';
    _rows = d.todos || [];
    _trees = todoBuildTree(_rows);
    _today = d.today || '';
    // 未完成/已逾期: 按当前 _filter 过滤后的可见顶层树重算
    renderPendingStats();
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
      // 未完成/已逾期: 按当前筛选后的可见顶层树重算
      renderPendingStats();
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
    bindTodoChartRefresh(loadChart);
    // ?root 已在加载前解析(_todoDetailRootId), 首帧即详情, 不再在此 drawTree
    if (_deepRoot || _rq.get('add') || _rq.get('addChild') || _rq.get('edit')) history.replaceState(null, '', location.pathname);
    // ?add=1 新建主任务(顶层, 不进详情)
    if (_rq.get('add') === '1') {
      history.replaceState(null, '', location.pathname);
      openAddForm(null, '新建任务', false);
    }
    // ?addChild: 在详情画面上弹添加子任务表单
    var _addChildId = _rq.get('addChild');
    if (_addChildId) {
      history.replaceState(null, '', location.pathname);
      var _addParent = (_rows || []).filter(function(r){ return String(r.id) === String(_addChildId); })[0];
      openAddForm(Number(_addChildId), _addParent && _addParent.title ? '添加子任务 · ' + _addParent.title : '添加子任务', true);
    }
    // ?edit: 在详情画面上弹编辑弹窗(须从树节点取, 带 children/_root)
    var _editId = _rq.get('edit');
    if (_editId) {
      history.replaceState(null, '', location.pathname);
      var _enode = (function(){
        var found = null;
        (function walk(list){
          list.forEach(function(n){
            if (found) return;
            if (String(n.id) === String(_editId)) { found = n; return; }
            walk(n.children || []);
          });
        })(_trees || []);
        return found;
      })();
      if (_enode) openReportEdit(_enode);
    }
  } catch(e) { document.body.innerHTML = '<div class="todo-empty" style="margin-top:60px;">' + esc(e.message || '链接无效') + '</div>'; }
})();
`;

// ============ 待办免密汇总协作页（跨全部清单，今天+逾期，可写） ============
const TODO_COLLAB_JS = `
bindModal();
bindQuickLogin('todo-report');
var _token = location.pathname.split('/').filter(Boolean).pop();
var _rows = [], _today = '';
var _curRange = 'month';
// 汇总协作页时间筛选: 默认 'cur' (今日+逾期, 与日报口径一致); 其它取值与登录态一致
var _filter = 'cur';

// 汇总协作页编辑任务（仅编辑已有任务挂 md 编辑器；附件走 report_token 用户级口径）
function openPublicEdit(node) {
  var isChild = node.parent_id != null;
  var fopts = isChild
    ? { childDueMode: !!(node._root && node._root.child_due), canRecur: node.children.length === 0 }
    : {};
  openModal('编辑任务', todoFormHtml(node, false, isChild, fopts) +
    '<div style="margin-top:12px;"><button class="btn" id="tfSave">保存</button> <button class="btn gray" onclick="closeModal()">取消</button></div>');
  todoFillCategoryOptions(_rows, node.category || '');
  (async function(){
    var noteEl = document.getElementById('tfNote'); if (!noteEl) return;
    var lim = await api('/api/public/attach-max-mb').catch(function(){ return { max_mb: 5 }; });
    mountTodoMdEditor(noteEl, {
      maxMb: lim.max_mb || 5,
      upload: async function(file) {
        var fd = new FormData();
        fd.append('todo_id', node.id);
        fd.append('file', file);
        var res = await fetch('/api/public/todo-att/' + _token, { method: 'POST', body: fd });
        var d = await res.json().catch(function(){ return {}; });
        if (!res.ok || !d.success) throw new Error(d.message || '上传失败');
        return d.attachment;
      }
    });
  })();
  bindClickBusy(document.getElementById('tfSave'), async function(){
    var body = todoFormRead();
    if (!body.title) { alertModal('请填写标题', {ok:false}); return; }
    await api('/api/public/todo-all/' + _token + '/' + node.id, { method:'PUT', body: body });
    closeModal(); await loadCollab();
  });
}
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
  // 顶层显示日期 todoRootDue 口径(旧模式=自身 due_date; 新模式=最早到期子任务)
  return todoBuildTree(_rows).filter(function(n){ return todoRootPassFilter(n, _filter, _today); });
}
// 统计（口径同后端 countStats）：基于可见树, 叶子任务; 备忘录(顶层无 due_date)不计入 pending/overdue
// 已完成一栏按 _filter 联动: cur→今日+逾期完成, today→今日, overdue/future/memo→各自类别, all/done→当月
function renderStats(trees) {
  var s = todoStatsByVisible(trees, _today);
  document.getElementById('stPending').textContent = s.pending;
  document.getElementById('stOverdue').textContent = s.overdue;
  document.getElementById('stDone').textContent = todoDoneByFilter(_rows, _filter, _today, _curRange);
  updateStatsHint(_filter, _curRange);
}
async function loadChart() {
  try { var c = await api('/api/public/todo-chart/' + _token + '?range=' + _curRange); drawTodoChart('todoChart', c.series); }
  catch(e){ /* 图表失败不阻断 */ }
}
function _todoGetRows() { return _rows; }
function drawTree(trees) {
  // 全屏态下按抽屉选中的分类过滤扁平 rows 重新建可见树(遵从 _filter, 顶层显示日期口径)
  var effectiveTrees = trees;
  if (_todoView !== 'default' && _todoCategory != null && _todoCategory !== '__all__') {
    var byCat = todoBuildTree(todoRowsByCategory(_rows));
    effectiveTrees = byCat.filter(function(n){ return todoRootPassFilter(n, _filter, _today); });
  }
  // 已完成 tab 强制显示, 其它遵从复选框
  var hideBox = document.getElementById('hideDone');
  var hideDone = (_filter === 'done') ? false : (hideBox ? hideBox.checked : false);
  todoRenderView(document.getElementById('todoTree'), effectiveTrees, {
    view: _todoView === 'default' ? 'card' : _todoView,
    detailRootId: _todoDetailRootId,
    crumbEl: document.getElementById('todoCrumb'),
    today: _today, hideDone: hideDone,
    onExitDetail: function(){ _todoDetailRootId = null; drawTree(visibleTrees()); },
    onEnter: function(node){ _todoDetailRootId = node.id; drawTree(visibleTrees()); },
    onDetail: function(node){
      openTodoDetail(node, {
        today: _today,
        editable: true,
        onEdit: function(n){ openPublicEdit(n); },
        listAttachments: async function(id){
          var r = await api('/api/public/todo-att/' + _token + '?todo_id=' + id);
          return r.attachments || [];
        }
      });
    },
    onToggleRecur: function(node){
      var dueDate = node.due_date || _today;
      var defaultNext = shiftDateLocal(dueDate, node.recurrence, false, _today, node.recur_interval, node.recur_nth, node.recur_weekday);
      var jumpNext = shiftDateLocal(dueDate, node.recurrence, true, _today, node.recur_interval, node.recur_nth, node.recur_weekday);
      var sameDate = defaultNext === jumpNext;
      var html =
        '<p style="margin:6px 0;">📝 ' + esc(node.title) + '（' + todoRecurLabel(node.recurrence, node.recur_interval, node.recur_nth, node.recur_weekday) + '）</p>' +
        '<p class="muted" style="margin:4px 0 14px;">本次截止：' + esc(todoDateLabel(dueDate, _today)) + ' <span style="color:var(--faint);">(' + dueDate + ')</span></p>' +
        '<p style="margin:6px 0;">完成后自动生成下一条任务，日期：</p>' +
        '<label style="display:block;padding:8px 4px;"><input type="radio" name="rjump" value="0" checked style="width:auto;margin-right:8px;"> ' + todoDateLabel(defaultNext, _today) + ' <span style="color:var(--faint);font-size:12px;">(' + defaultNext + ')</span>（下一周期，默认）</label>' +
        (sameDate ? '' :
          '<label style="display:block;padding:8px 4px;"><input type="radio" name="rjump" value="1" style="width:auto;margin-right:8px;"> ' + todoDateLabel(jumpNext, _today) + ' <span style="color:var(--faint);font-size:12px;">(' + jumpNext + ')</span>（跳到当前周期）</label>') +
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
      if (!(await todoConfirmDoneIfPending(node, done))) return;
      try {
        await api('/api/public/todo-all/' + _token + '/' + node.id + '/done', { method:'PUT', body:{ done: done } });
        await loadCollab();
        if (done) {
          // datedOnly=true 排除备忘录, 与画面未完成栏(todoStatsByVisible)口径一致
          var cc = todoCelebrationCount(visibleTrees(), true);
          todoCelebrate(cc.remaining, cc.total);
        }
      }
      catch(e){ alertModal(e.message, {ok:false}); }
    },
    onEdit: openPublicEdit,
    onAddChildSubmit: async function(node, payload){
      await api('/api/public/todo-all/' + _token, { method:'POST', body: payload });
      await loadCollab();
    },
    onReorder: async function(parentId, ids){
      try { await api('/api/public/todo-all/' + _token + '/reorder', { method:'PUT', body:{ parent_id: parentId, ids: ids } }); await loadCollab(); }
      catch(e){ alertModal(e.message, {ok:false}); await loadCollab(); }
    }
  });
}
function openAddForm(parentId, title, isChild) {
  // 主任务: 汇总页为所有者本人, 可勾选 child_due 独立截止模式(fopts={});
  // 子任务: 按所在主任务的 child_due 模式决定表单(新建即为叶子, canRecur=true)
  var fopts = {};
  if (parentId != null) {
    var pRow = _rows.filter(function(r){ return r.id === parentId; })[0];
    if (pRow) fopts = { childDueMode: !!todoRootRowOf(_rows, pRow).child_due, canRecur: true };
  }
  openModal(title, todoFormHtml({}, true, !!isChild, fopts) +
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
bindTodoChartRefresh(loadChart);
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
  // 未完成/已逾期/已完成 三项均按当前筛选后的可见顶层树重算
  var trees = visibleTrees();
  renderStats(trees);
  updateStatsHint(_filter, _curRange);
  syncChartRangeToFilter(_filter);
  drawTree(trees);
});
loadCollab();
`;

export {
  COMMON_JS, LOGIN_JS, DASHBOARD_JS, ADMIN_JS, SETUP_JS, MONITOR_JS, FUND_JS,
  PUBLIC_BUY_JS, WEIGHT_JS, PUBLIC_WEIGHT_JS, SETTINGS_JS, ASSET_JS, PUBLIC_ASSET_JS, CHANNELS_JS,
  WEIGHT_REPORT_JS, ASSET_REPORT_JS, FUND_REPORT_JS,
  TODO_TREE_CORE, TODO_JS, PUBLIC_TODO_JS, TODO_REPORT_JS, TODO_COLLAB_JS
};
