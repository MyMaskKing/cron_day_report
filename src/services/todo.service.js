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
 * 统计概览
 * @param {Array} rows - todos 扁平行
 * @param {string} today - 北京时区当天 YYYY-MM-DD，用于逾期判断
 * @returns {Object} { total, done, pending, overdue }
 */
function countStats(rows, today) {
  let done = 0, overdue = 0;
  for (const r of rows) {
    if (r.done) done++;
    else if (r.due_date && today && r.due_date < today) overdue++;
  }
  return { total: rows.length, done, pending: rows.length - done, overdue };
}

/** range → { unit: 'day'|'month', span } 天数或月数 */
const CHART_RANGES = {
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
  if (cfg.unit === 'day') {
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

export { buildTree, flattenPending, countStats, buildChartSeries, CHART_RANGES };
