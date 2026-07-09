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

export { buildTree, flattenPending, countStats };
