/**
 * 待办纯计算服务（无副作用、不碰存储）
 *
 * 职责：把 storage 取出的扁平 todos 行组装成嵌套树、提取未完成项、统计概览。
 * 数据取用仍在 api 层经 getStorage 调用。
 */

// ============ 日期 label（网页 UI 与日报共用的显示语义） ============
// 语义: 今天/昨天/明天 → 中文; 本周内(ISO 周, 周一为首) → 本周一~本周日; 否则 MM/DD
// 输入均为 YYYY-MM-DD 北京日历串; 空/非法返回 ''
// 与前端 COMMON_JS 里的同名函数逻辑必须保持一致(唯一事实源)
const CN_WEEKDAY = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
function todoDateLabel(dueDate, today) {
  if (!dueDate || dueDate.length < 10) return '';
  if (!today || today.length < 10) return `${dueDate.slice(5, 7)}/${dueDate.slice(8, 10)}`;
  const dMs = Date.UTC(+dueDate.slice(0, 4), +dueDate.slice(5, 7) - 1, +dueDate.slice(8, 10));
  const tMs = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  const diff = Math.round((dMs - tMs) / 86400000);
  if (diff === 0) return '今天';
  if (diff === -1) return '昨天';
  if (diff === 1) return '明天';
  // ISO 周: 周一为首。today 的周一距 today 的天数 = (dow+6)%7, dow: 0=周日..6=周六
  const tDow = new Date(tMs).getUTCDay();
  const monOff = (tDow + 6) % 7;
  const monMs = tMs - monOff * 86400000;
  const sunMs = monMs + 6 * 86400000;
  if (dMs >= monMs && dMs <= sunMs) {
    return '本' + CN_WEEKDAY[new Date(dMs).getUTCDay()];
  }
  return `${dueDate.slice(5, 7)}/${dueDate.slice(8, 10)}`;
}

/**
 * 日期徽章: 未逾期 → "📅 <label>"; 逾期 → "⚠️ 逾期 <label>"
 * kind: 'ui' | 'text' | 'markdown' | 'html' 只影响是否加粗/HTML 转义(html 由调用方自行 wrap 样式);
 *       返回纯文本内容; html 层的红/蓝背景外壳仍由 report.service.js 保留
 * @param {string} dueDate - YYYY-MM-DD
 * @param {string} today - YYYY-MM-DD
 * @param {boolean} overdue - 是否已逾期(未完成 + dueDate < today)
 * @returns {string}
 */
function todoDateBadge(dueDate, today, overdue) {
  const label = todoDateLabel(dueDate, today);
  if (!label) return '';
  return overdue ? `⚠️ 逾期 ${label}` : `📅 ${label}`;
}

/**
 * 扁平行 → 嵌套树
 * 按 parent_id 归组，同级按 sort_order + id 顺序，顶层为 parent_id 为空的节点
 * @param {Array} rows - todos 行（含 id/parent_id/sort_order 等）
 * @returns {Array} 顶层节点数组，每个节点带 children 字段（递归）
 */
function buildTree(rows) {
  const byId = new Map();
  for (const r of rows) byId.set(r.id, { ...r, children: [] });
  const roots = [];
  for (const node of byId.values()) {
    const pid = node.parent_id;
    if (pid != null && byId.has(pid)) {
      byId.get(pid).children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortFn = (a, b) => (a.sort_order - b.sort_order) || (a.id - b.id);
  const sortRec = list => {
    list.sort(sortFn);
    for (const n of list) sortRec(n.children);
  };
  sortRec(roots);
  return roots;
}

/**
 * 从树中提取仍有未完成任务的顶层子树（推送用）
 * 完成节点视为整棵子树已结束；其后代状态保留，但不再进入未完成任务树
 * @param {Array} trees - buildTree 结果
 * @returns {Array} 过滤后的树（新对象，不改原树）
 */
function flattenPending(trees) {
  function prune(node) {
    if (node.done) return null;
    const hadChildren = node.children.length > 0;
    const keptChildren = node.children.map(prune).filter(Boolean);
    // 叶子未完成才保留；原本有子任务但后代已全部结束时，父任务不单独计为未完成
    if (hadChildren && keptChildren.length === 0) return null;
    return { ...node, children: keptChildren };
  }
  return trees.map(prune).filter(Boolean);
}

/**
 * 统计概览（叶子口径）
 * 有子任务的父任务不计入，只统计最末端叶子任务；子任务逾期继承顶层祖先的截止日期
 * 备忘录（无截止日期的未完成叶子）单独计入 memo，不算进 pending
 * @param {Array} rows - todos 扁平行
 * @param {string} today - 北京时区当天 YYYY-MM-DD，用于逾期判断
 * @returns {Object} { total, done, pending, overdue, memo }
 */
function countStats(rows, today) {
  const byId = new Map();
  for (const r of rows) byId.set(r.id, r);
  // 有子任务的父 id 集合：这些父不是叶子，不计入统计
  const hasChild = new Set();
  for (const r of rows) if (r.parent_id != null) hasChild.add(r.parent_id);
  // 是否存在已完成祖先：已结束任务下的后代保留原状态，但不计入未完成/逾期/备忘录
  const hasDoneAncestor = (r) => {
    let cur = r;
    while (cur.parent_id != null && byId.has(cur.parent_id)) {
      cur = byId.get(cur.parent_id);
      if (cur.done) return true;
    }
    return false;
  };
  // 有效截止日期：顶层用自身，子任务继承顶层祖先（与树渲染 effDue 口径一致）
  const effDue = (r) => {
    let cur = r;
    while (cur.parent_id != null && byId.has(cur.parent_id)) cur = byId.get(cur.parent_id);
    return cur.due_date;
  };
  let total = 0, done = 0, overdue = 0, memo = 0, pending = 0;
  for (const r of rows) {
    if (hasChild.has(r.id)) continue; // 非叶子（父任务）跳过
    if (hasDoneAncestor(r)) continue;
    total++;
    if (r.done) { done++; continue; }
    const due = effDue(r);
    if (!due) { memo++; continue; }        // 无日期未完成 = 备忘录，不计入 pending
    pending++;
    if (today && due < today) overdue++;
  }
  return { total, done, pending, overdue, memo };
}

/** range → { unit: 'day'|'month'|'month-current', span } 天数或月数
 *  month-current: 特殊分支, 从 today 所在月 1 号起到 today 每天一格(span 运行时按 today 推)
 */
const CHART_RANGES = {
  'month': { unit: 'month-current' },
  '7d': { unit: 'day', span: 7 },
  '30d': { unit: 'day', span: 30 },
  '60d': { unit: 'day', span: 60 },
  '6m': { unit: 'month', span: 6 },
  '1y': { unit: 'month', span: 12 },
  '3y': { unit: 'month', span: 36 }
};

/** 从 YYYY-MM-DD 解析为 UTC 毫秒（仅用于日期算术，不涉及时区显示） */
function dayMs(dateStr) {
  return Date.UTC(+dateStr.slice(0, 4), +dateStr.slice(5, 7) - 1, +dateStr.slice(8, 10));
}
/** UTC 毫秒 → YYYY-MM-DD */
function msDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * 构造图表序列：按 range 决定按天/按月，产出连续标签与对应创建/完成计数
 * ≤60 天按天，半年/1年/3年按月
 * @param {Object} raw - storage.chartRaw 结果 { created:[{d,c}], done:[{d,c}] }
 * @param {string} range - 7d|30d|60d|6m|1y|3y
 * @param {string} today - 北京时区当天 YYYY-MM-DD（区间末点）
 * @returns {Object} { range, unit, labels[], created[], done[] }
 */
function buildChartSeries(raw, range, today) {
  const cfg = CHART_RANGES[range] || CHART_RANGES['7d'];
  const createdMap = {}, doneMap = {};
  (raw.created || []).forEach(r => { if (r.d) createdMap[r.d] = r.c; });
  (raw.done || []).forEach(r => { if (r.d) doneMap[r.d] = r.c; });

  const labels = [], created = [], done = [];
  if (cfg.unit === 'month-current') {
    // 当月: 从 today 所在月 1 号起, 到 today 为止, 每天一格
    const d = +today.slice(8, 10);
    const endMs = dayMs(today);
    for (let i = d - 1; i >= 0; i--) {
      const day = msDay(endMs - i * 86400000);
      labels.push(day.slice(5)); // MM-DD
      created.push(createdMap[day] || 0);
      done.push(doneMap[day] || 0);
    }
  } else if (cfg.unit === 'day') {
    const endMs = dayMs(today);
    for (let i = cfg.span - 1; i >= 0; i--) {
      const day = msDay(endMs - i * 86400000);
      labels.push(day.slice(5)); // MM-DD
      created.push(createdMap[day] || 0);
      done.push(doneMap[day] || 0);
    }
  } else {
    // 按月：聚合当月所有天的计数
    const y = +today.slice(0, 4), m = +today.slice(5, 7) - 1;
    for (let i = cfg.span - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(y, m - i, 1));
      const ym = d.toISOString().slice(0, 7); // YYYY-MM
      labels.push(ym);
      let cc = 0, dc = 0;
      for (const k in createdMap) if (k.slice(0, 7) === ym) cc += createdMap[k];
      for (const k in doneMap) if (k.slice(0, 7) === ym) dc += doneMap[k];
      created.push(cc);
      done.push(dc);
    }
  }
  return { range, unit: cfg.unit, labels, created, done };
}

/**
 * 计算重复任务的下次截止日期
 * 顶层任务勾选完成时用: 从旧 dueDate 推出新一条实例的 dueDate
 * @param {string} dueDate - 旧任务的 YYYY-MM-DD
 * @param {string} recurrence - 'daily' | 'weekly' | 'monthly' | 'yearly' | 'monthly_nth_weekday'
 * @param {boolean} jumpToCurrent - true 时以 todayStr 为基准找该周期下一个未来日
 * @param {string} todayStr - 今天 YYYY-MM-DD（北京日历）；仅 jumpToCurrent=true 时用
 * @param {number} interval - 每隔 N 个周期; 缺省或 <1 归一为 1
 * @param {number} nth - 仅 monthly_nth_weekday 用: 1..5, 5=最后一个
 * @param {number} weekday - 仅 monthly_nth_weekday 用: 0=周日..6=周六
 * @returns {string} 新 YYYY-MM-DD
 */
function shiftDate(dueDate, recurrence, jumpToCurrent, todayStr, interval, nth, weekday) {
  const step = (interval != null && interval >= 1) ? Math.floor(interval) : 1;
  const [y, m, d] = dueDate.split('-').map(Number);
  const clamp = (year, month, day) => {
    // 该月最后一天(month 从 1 起)
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return Math.min(day, last);
  };
  const fmt = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  // 从 (year, month) 向后跨 k 个月, 返回 [newYear, newMonth]; month 从 1 起
  const addMonths = (year, month, k) => {
    const idx = (year * 12 + (month - 1)) + k;
    return [Math.floor(idx / 12), (idx % 12) + 1];
  };
  // 该月第 n 个 weekday 的日号; n=5 或该月不足 n 个时取该月最后一个 weekday 的日号
  // month 从 1 起, weekday 0..6
  const nthWeekdayOf = (year, month, n, wd) => {
    const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const firstOffset = ((wd - first) + 7) % 7; // 该月第 1 个 wd 的日号偏移
    const first1 = 1 + firstOffset;
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (n >= 5) {
      // 取月内最后一个 wd
      const lastWd = new Date(Date.UTC(year, month - 1, last)).getUTCDay();
      const lastOff = ((lastWd - wd) + 7) % 7;
      return last - lastOff;
    }
    const cand = first1 + (n - 1) * 7;
    if (cand > last) {
      // 不存在, 回退到最后一个
      const lastWd = new Date(Date.UTC(year, month - 1, last)).getUTCDay();
      const lastOff = ((lastWd - wd) + 7) % 7;
      return last - lastOff;
    }
    return cand;
  };

  // ============ monthly_nth_weekday: 独立分支 ============
  // nth/weekday 缺省则回退成 monthly(day-of-month) 逻辑, 保护脏数据
  if (recurrence === 'monthly_nth_weekday') {
    const n = (nth != null && nth >= 1 && nth <= 5) ? Math.floor(nth) : null;
    const wd = (weekday != null && weekday >= 0 && weekday <= 6) ? Math.floor(weekday) : null;
    if (n == null || wd == null) return dueDate;
    if (!jumpToCurrent) {
      const [ny, nm] = addMonths(y, m, step);
      return fmt(ny, nm, nthWeekdayOf(ny, nm, n, wd));
    }
    const today = todayStr || new Date().toISOString().slice(0, 10);
    const [ty, tm, td] = today.split('-').map(Number);
    // 从 today 所在月出发, 找 nthWeekday > today; 不满足则每次跨 step 个月
    let cy = ty, cm = tm;
    for (let i = 0; i < 240; i++) { // 20 年上限, 防死循环
      const day = nthWeekdayOf(cy, cm, n, wd);
      if (cy > ty || (cy === ty && (cm > tm || (cm === tm && day > td)))) {
        return fmt(cy, cm, day);
      }
      const [ny2, nm2] = addMonths(cy, cm, step);
      cy = ny2; cm = nm2;
    }
    return fmt(cy, cm, nthWeekdayOf(cy, cm, n, wd));
  }

  if (!jumpToCurrent) {
    if (recurrence === 'daily') {
      const t = Date.UTC(y, m - 1, d) + step * 86400000;
      return new Date(t).toISOString().slice(0, 10);
    }
    if (recurrence === 'weekly') {
      const t = Date.UTC(y, m - 1, d) + step * 7 * 86400000;
      return new Date(t).toISOString().slice(0, 10);
    }
    if (recurrence === 'monthly') {
      const [ny, nm] = addMonths(y, m, step);
      return fmt(ny, nm, clamp(ny, nm, d));
    }
    if (recurrence === 'yearly') {
      const ny = y + step;
      return fmt(ny, m, clamp(ny, m, d));
    }
    return dueDate;
  }

  // jumpToCurrent: 以 todayStr 为基准, 找不早于今天的下一次
  //   interval > 1 时: 从旧 dueDate 起按 step 累加, 直到 >= today; 保持"从原始锚点等间隔"
  const today = todayStr || new Date().toISOString().slice(0, 10);
  const [ty, tm, td] = today.split('-').map(Number);
  if (recurrence === 'daily') {
    if (step === 1) {
      // 今天 + 1
      const t = Date.UTC(ty, tm - 1, td) + 86400000;
      return new Date(t).toISOString().slice(0, 10);
    }
    // 从旧 due 起累加 step 直到 > today
    let ms = Date.UTC(y, m - 1, d);
    const targetMs = Date.UTC(ty, tm - 1, td);
    while (ms <= targetMs) ms += step * 86400000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  if (recurrence === 'weekly') {
    if (step === 1) {
      // 今天所在自然周同 dueDate 的星期几; 若已过则下周
      const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      const todayMs = Date.UTC(ty, tm - 1, td);
      const tdow = new Date(todayMs).getUTCDay();
      let deltaDays = (dow - tdow + 7) % 7;
      if (deltaDays === 0) deltaDays = 7;
      return new Date(todayMs + deltaDays * 86400000).toISOString().slice(0, 10);
    }
    // step > 1: 保持"从原始锚点每 step 周", 找 > today 的第一个
    let ms = Date.UTC(y, m - 1, d);
    const targetMs = Date.UTC(ty, tm - 1, td);
    while (ms <= targetMs) ms += step * 7 * 86400000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  if (recurrence === 'monthly') {
    if (step === 1) {
      // 今月同 d, 若已过则下月; 溢出取月末
      if (td < d) return fmt(ty, tm, clamp(ty, tm, d));
      const nm = tm === 12 ? 1 : tm + 1;
      const ny = tm === 12 ? ty + 1 : ty;
      return fmt(ny, nm, clamp(ny, nm, d));
    }
    // step > 1: 从旧 (y, m) 起每次 +step 个月, 直到 > today
    let cy = y, cm = m;
    while (cy < ty || (cy === ty && (cm < tm || (cm === tm && clamp(cy, cm, d) <= td)))) {
      const [ny, nm] = addMonths(cy, cm, step);
      cy = ny; cm = nm;
    }
    return fmt(cy, cm, clamp(cy, cm, d));
  }
  if (recurrence === 'yearly') {
    if (step === 1) {
      // 今年同 m/d, 若已过则明年; 2/29 遇平年取当月末
      if (tm < m || (tm === m && td < d)) return fmt(ty, m, clamp(ty, m, d));
      return fmt(ty + 1, m, clamp(ty + 1, m, d));
    }
    // step > 1: 从旧 y 起每次 +step 年, 直到 > today
    let cy = y;
    while (cy < ty || (cy === ty && (m < tm || (m === tm && clamp(cy, m, d) <= td)))) {
      cy += step;
    }
    return fmt(cy, m, clamp(cy, m, d));
  }
  return dueDate;
}

export { buildTree, flattenPending, countStats, buildChartSeries, CHART_RANGES, shiftDate, todoDateLabel, todoDateBadge };
