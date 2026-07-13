/**
 * 待办纯计算服务（无副作用、不碰存储）
 *
 * 职责：把 storage 取出的扁平 todos 行组装成嵌套树、提取未完成项、统计概览。
 * 数据取用仍在 api 层经 getStorage 调用。
 */

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
 * 保留结构，仅剪掉"整棵已完成"的分支；节点自身或其任一后代未完成即保留
 * @param {Array} trees - buildTree 结果
 * @returns {Array} 过滤后的树（新对象，不改原树）
 */
function flattenPending(trees) {
  function prune(node) {
    const keptChildren = node.children.map(prune).filter(Boolean);
    // 自身未完成，或有未完成后代 → 保留
    if (!node.done || keptChildren.length > 0) {
      return { ...node, children: keptChildren };
    }
    return null;
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
  // 有效截止日期：顶层用自身，子任务继承顶层祖先（与树渲染 effDue 口径一致）
  const effDue = (r) => {
    let cur = r;
    while (cur.parent_id != null && byId.has(cur.parent_id)) cur = byId.get(cur.parent_id);
    return cur.due_date;
  };
  let total = 0, done = 0, overdue = 0, memo = 0, pending = 0;
  for (const r of rows) {
    if (hasChild.has(r.id)) continue; // 非叶子（父任务）跳过
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
 * @param {string} recurrence - 'daily' | 'weekly' | 'monthly' | 'yearly'
 * @param {boolean} jumpToCurrent - true 时以 todayStr 为基准找该周期下一个未来日
 * @param {string} todayStr - 今天 YYYY-MM-DD（北京日历）；仅 jumpToCurrent=true 时用
 * @returns {string} 新 YYYY-MM-DD
 */
function shiftDate(dueDate, recurrence, jumpToCurrent, todayStr) {
  const [y, m, d] = dueDate.split('-').map(Number);
  const clamp = (year, month, day) => {
    // 该月最后一天(month 从 1 起)
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return Math.min(day, last);
  };
  const fmt = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  if (!jumpToCurrent) {
    if (recurrence === 'daily') {
      const t = Date.UTC(y, m - 1, d) + 86400000;
      return new Date(t).toISOString().slice(0, 10);
    }
    if (recurrence === 'weekly') {
      const t = Date.UTC(y, m - 1, d) + 7 * 86400000;
      return new Date(t).toISOString().slice(0, 10);
    }
    if (recurrence === 'monthly') {
      const nm = m === 12 ? 1 : m + 1;
      const ny = m === 12 ? y + 1 : y;
      return fmt(ny, nm, clamp(ny, nm, d));
    }
    if (recurrence === 'yearly') {
      const ny = y + 1;
      return fmt(ny, m, clamp(ny, m, d));
    }
    return dueDate;
  }

  // jumpToCurrent: 以 todayStr 为基准, 找不早于今天的下一次
  const today = todayStr || new Date().toISOString().slice(0, 10);
  const [ty, tm, td] = today.split('-').map(Number);
  if (recurrence === 'daily') {
    // 今天 + 1
    const t = Date.UTC(ty, tm - 1, td) + 86400000;
    return new Date(t).toISOString().slice(0, 10);
  }
  if (recurrence === 'weekly') {
    // 今天所在自然周同 dueDate 的星期几; 若已过则下周
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const todayMs = Date.UTC(ty, tm - 1, td);
    const tdow = new Date(todayMs).getUTCDay();
    let deltaDays = (dow - tdow + 7) % 7;
    if (deltaDays === 0) deltaDays = 7;
    return new Date(todayMs + deltaDays * 86400000).toISOString().slice(0, 10);
  }
  if (recurrence === 'monthly') {
    // 今月同 d, 若已过则下月; 溢出取月末
    if (td < d) return fmt(ty, tm, clamp(ty, tm, d));
    const nm = tm === 12 ? 1 : tm + 1;
    const ny = tm === 12 ? ty + 1 : ty;
    return fmt(ny, nm, clamp(ny, nm, d));
  }
  if (recurrence === 'yearly') {
    // 今年同 m/d, 若已过则明年; 2/29 遇平年取当月末
    if (tm < m || (tm === m && td < d)) return fmt(ty, m, clamp(ty, m, d));
    return fmt(ty + 1, m, clamp(ty + 1, m, d));
  }
  return dueDate;
}

export { buildTree, flattenPending, countStats, buildChartSeries, CHART_RANGES, shiftDate };
