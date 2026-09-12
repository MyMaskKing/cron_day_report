/**
 * 待办纯计算服务（无副作用、不碰存储）
 *
 * 职责：把 storage 取出的扁平 todos 行组装成嵌套树、提取未完成项、统计概览。
 * 数据取用仍在 api 层经 getStorage 调用。
 */

// ============ 日期 label（网页 UI 与日报共用的显示语义） ============
// 语义: 今天/昨天/明天 → 中文; 本周内(ISO 周, 周一为首) → 本周一~本周日;
//       范围外: 本年 MM/DD, 跨年 yy/MM/DD(2 位年, 如 26/08/01)
// 输入均为 YYYY-MM-DD 北京日历串; 空/非法返回 ''
// 与前端 COMMON_JS 里的同名函数逻辑必须保持一致(唯一事实源)
const CN_WEEKDAY = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
function todoDateLabel(dueDate, today) {
  if (!dueDate || dueDate.length < 10) return '';
  const md = `${dueDate.slice(5, 7)}/${dueDate.slice(8, 10)}`;
  if (!today || today.length < 10) return md;
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
  // 范围外: 本年 MM/DD; 跨年 yy/MM/DD(2 位年)
  if (dueDate.slice(0, 4) !== today.slice(0, 4)) return `${dueDate.slice(2, 4)}/${md}`;
  return md;
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
 * 任务的有效截止日期：自身 due_date 优先；为空则沿 parent 链继承最近祖先的 due_date
 * 旧模式下子任务自身恒为空，一路继承到顶层主任务，与历史口径完全一致；
 * child_due 新模式下子任务自身有日期即用自身，否则继承最近的有日期中间父任务
 * @param {Object} row - todos 扁平行
 * @param {Map<number,Object>} byId - id → 扁平行
 * @returns {string|null} YYYY-MM-DD
 */
function effDueOf(row, byId) {
  let cur = row;
  const guard = new Set();
  while (cur) {
    if (cur.due_date) return cur.due_date;
    if (cur.parent_id == null) break;
    if (guard.has(cur.parent_id)) break; // 防御异常环
    guard.add(cur.parent_id);
    cur = byId.get(cur.parent_id);
  }
  return null;
}

/**
 * 顶层主任务的显示日期：
 * - 自身有 due_date（旧模式 / 显式日期）→ 自身
 * - 自身无日期（child_due 新模式）→ 子树中未完成节点有效日期的最小值
 *   （逾期的最早、最紧迫；已完成整枝跳过；无任何日期 → null，按备忘录处理）
 * 输入为 buildTree 产出的树节点（带 children）
 * @param {Object} root - 顶层树节点
 * @returns {string|null} YYYY-MM-DD
 */
function rootDueOf(root) {
  if (root.due_date) return root.due_date;
  let min = null;
  const walk = (node, inheritedDue) => {
    if (node.done) return; // 完成枝整枝跳过
    const own = node.due_date || inheritedDue;
    // 仅叶子(可完成项)参与显示日期; 中间层父任务的日期只作其下无日期叶子的继承默认值,
    // 不单独代表到期项(与前端 assets.js todoRootDue 同口径)
    // 勾了 child_due 的空壳(任意层级, 暂无下级)是分组容器, 不用继承来的日期冒充到期叶子
    if (node.children.length === 0 && !node.child_due && own && (!min || own < min)) min = own;
    for (const c of node.children) walk(c, node.due_date || inheritedDue);
  };
  walk(root, null);
  return min;
}

/**
 * 统计概览（叶子口径）
 * 有子任务的父任务不计入，只统计最末端叶子任务；叶子有效日期按 effDueOf（自身优先，否则继承最近祖先）
 * 备忘录（无有效截止日期的未完成叶子）单独计入 memo，不算进 pending
 * @param {Array} rows - todos 扁平行
 * @param {string} today - 北京时区当天 YYYY-MM-DD，用于逾期判断
 * @returns {Object} { total, done, pending, overdue, memo, today }
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
  let total = 0, done = 0, overdue = 0, memo = 0, pending = 0, dueToday = 0;
  for (const r of rows) {
    if (hasChild.has(r.id)) continue; // 非叶子（父任务）跳过
    if (hasDoneAncestor(r)) continue;
    // 勾了"子任务各自设日期"的空壳是分组容器(日期由下一级决定), 自身无日期是结构使然,
    // 任意层级均不算备忘录/待办/总数; 待其添加子任务后由叶子后代计入
    if (r.child_due) continue;
    total++;
    if (r.done) { done++; continue; }
    const due = effDueOf(r, byId);
    if (!due) { memo++; continue; }        // 无日期未完成 = 备忘录，不计入 pending
    pending++;
    if (today && due < today) overdue++;
    else if (today && due === today) dueToday++; // 今日到期的未完成叶子（小组件标题栏统计用）
  }
  return { total, done, pending, overdue, memo, today: dueToday };
}

/**
 * 构造小组件用的「顶层分组」数据（无副作用，不碰存储）
 * 口径与 countStats / 前端过滤一致：未完成叶子才计入；
 * 主任务显示日期走 rootDueOf（自身日期优先，否则取子树未完成任务有效日期最小值）；
 * 叶子有效日期自身优先、否则继承最近祖先（child_due 新模式下子任务可各自带日期）
 * @param {Array} rows - storage.todo.listByUser 的扁平行
 * @param {string} today - YYYY-MM-DD（北京时区）
 * @param {'cur'|'today'|'overdue'|'all'} scope - 顶层过滤口径
 * @param {number} limit - 返回顶层分组数量上限
 * @returns {Array<{id:number,title:string,due_label:string,overdue:boolean,recurring:boolean,collapsible:boolean,children:Array<{id:number,title:string,path:Array<string>,due_label:string,overdue:boolean}>}>}
 */
function buildWidgetGroups(rows, today, scope, limit) {
  const trees = buildTree(rows);
  const pending = flattenPending(trees); // 仅保留仍有未完成叶子的顶层子树（已完成祖先整棵剔除）

  // 收集某顶层子树下全部未完成叶子（flattenPending 已剪掉完成枝，保留下来的叶子均未完成），
  // 中间层级父任务不单列成行，只通过叶子的 path 小文字面包屑体现层级；根节点除外（根由分组标题承载）。
  // 每项带 path：从 root 直接子节点到该叶子父级的标题链（不含 root、不含自身），
  // 用于小组件在叶子标题上方渲染祖先面包屑；root 的直接子叶子 path 为空。
  // 每项带 due_label/overdue：叶子自身日期优先，否则继承最近有日期的祖先（旧模式即主任务日期）。
  // 同时返回 hasRecur：子树内是否存在重复任务（主任务或任一叶子）。
  // 若该根本身是叶子（无后代），回退为根自身，保证至少有一条可勾选。
  // 组件时间口径统一为"组内按子任务有效日期过滤"(仅小组件, 网页/日报不走这里):
  //   today   = 仅今日到期的叶子;  cur = 今日+逾期(有效日期<=今天);  overdue = 仅逾期(<今天);
  //   all     = 全部叶子(含无日期备忘录)。主任务只要有一个符合口径的叶子就显示该组、组内只列这些叶子。
  const leafPass = (ownDue) => {
    if (scope === 'today') return ownDue === today;
    if (scope === 'cur') return !!(ownDue && today && ownDue <= today);
    if (scope === 'overdue') return !!(ownDue && today && ownDue < today);
    return true; // all
  };
  const itemsOf = (node) => {
    const out = [];
    let hasRecur = false;
    const walk = (n, ancestors, isRoot, inheritedDue) => {
      if (n.recurrence) hasRecur = true;
      const ownDue = n.due_date || inheritedDue;
      // child_due 空壳(任意层级)是分组容器, 不作为可勾选叶子下发
      if (!isRoot && n.children.length === 0 && !n.child_due && leafPass(ownDue)) {
        const over = !!(today && ownDue && ownDue < today);
        out.push({
          id: n.id, title: n.title, path: ancestors,
          due_label: ownDue ? todoDateBadge(ownDue, today, over) : '',
          overdue: over
        });
      }
      for (const c of n.children) {
        walk(c, isRoot ? [] : [...ancestors, n.title], false, n.due_date || inheritedDue);
      }
    };
    walk(node, [], true, null);
    if (out.length === 0 && leafPass(node.due_date)) {
      // 无符合叶子时回退根自身(旧模式主任务自身=叶子); child_due 空容器 node.due_date 为 null,
      // cur/overdue/today 下 leafPass(null)=false 不回退 → 组因 items 为空被跳过
      const over = !!(today && node.due_date && node.due_date < today);
      out.push({
        id: node.id, title: node.title, path: [],
        due_label: node.due_date ? todoDateBadge(node.due_date, today, over) : '',
        overdue: over
      });
      if (node.recurrence) hasRecur = true;
    }
    return { items: out, hasRecur };
  };

  const groups = [];
  for (const root of pending) {
    const due = rootDueOf(root);
    const overdue = !!(today && due && due < today);
    // 时间口径统一由 itemsOf 组内过滤(leafPass): 不再按主任务显示日期整组跳过——
    // 主任务有符合 today/cur/overdue 的叶子才显示该组、组内只列这些叶子; all 收全部。
    const { items, hasRecur } = itemsOf(root);
    if (items.length === 0) continue; // 无符合口径叶子的组整组隐藏
    // child_due 空容器(分组壳, 尚未添加子任务): 回退出来的唯一一行是容器自身,
    // 小组件上没有可勾选的子任务, 且该行易被误勾成"完成整个容器"; 全部范围也隐藏,
    // 待其添加子任务后 items 变为子任务叶子(首项 id ≠ root.id)自然出现。
    // 普通无日期主任务(备忘录) child_due 为假, 不受影响, 仍照常显示。
    if (root.child_due && items.length === 1 && items[0].id === root.id) continue;
    groups.push({
      id: root.id,
      title: root.title,
      due_label: due ? todoDateBadge(due, today, overdue) : '',
      overdue,
      recurring: !!root.recurrence || hasRecur,
      // 共享分类任务(shared_cat_id 非空)标记; groups 结构其余不变, Android 旧版本自动忽略该字段
      shared: root.shared_cat_id != null,
      collapsible: items.length > 1 || items[0].id !== root.id,
      children: items
    });
  }

  // 排序与浏览器 /todo 页一致（assets.js todoBuildTree）：顶层按显示日期倒序
  // （有日期的越晚越靠前，无日期排最后）；同日期按 sort_order, id 升序。
  // 叶子（children）顺序沿用 buildTree 的 sort_order+id 升序，与浏览器子任务排序同口径。
  const byId = new Map(rows.map(r => [r.id, r]));
  const rootDueById = new Map(pending.map(r => [r.id, rootDueOf(r)]));
  const sortKey = (g) => {
    const r = byId.get(g.id) || {};
    return [r.sort_order || 0, r.id || 0];
  };
  groups.sort((a, b) => {
    const ad = rootDueById.get(a.id) || '';
    const bd = rootDueById.get(b.id) || '';
    if (ad !== bd) {
      if (!ad) return 1;
      if (!bd) return -1;
      return ad < bd ? 1 : -1;
    }
    const [as0, as1] = sortKey(a), [bs0, bs1] = sortKey(b);
    return as0 - bs0 || as1 - bs1;
  });

  const n = (limit != null && limit > 0) ? Math.min(Math.floor(limit), groups.length) : groups.length;
  return groups.slice(0, n);
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
 * 构造"有效完成态"解析器：主任务勾选完成后，其下即使未逐个勾选的子任务也视为已完成
 * （child_due 新模式下子任务各自带截止日；与列表 countStats / 日报 statsOfReport
 *   的"已完成祖先剪枝"同口径：主任务完成即整支结束，不论子任务是否逐个勾选）。
 * 依据 raw.tree（同范围全量行，含无日期的容器主任务）沿 parent 链找最近的已完成祖先，
 * 取其完成日；缺 raw.tree（旧调用方）时退化为只看任务自身。
 * @param {Object} raw - storage.chartRaw 结果
 * @returns {(t:Object)=>{done:boolean, day:string|null}}
 *   done: 最终是否完成（自身完成 或 存在已完成祖先）；
 *   day: 最终完成日北京日（自身完成日优先，否则最近已完成祖先的完成日；缺 done_at 的历史完成行为 null=早已完成）
 */
function buildEffDoneResolver(raw) {
  const byId = new Map();
  (raw.tree || []).forEach(r => { if (r && r.id != null) byId.set(r.id, r); });
  return function effDone(t) {
    if (t.done === 1) return { done: true, day: t.done10 || null };
    let cur = t, guard = 0;
    while (cur.parent_id != null && byId.has(cur.parent_id) && guard++ < 100) {
      cur = byId.get(cur.parent_id);
      if (cur.done === 1) return { done: true, day: cur.done10 || null };
    }
    return { done: false, day: null };
  };
}

/**
 * 从 chartRaw 的全量 tree 派生「计入图表的叶子任务」：
 * 仅末端叶子参与（与 countStats 叶子口径一致，逐级门控下父与子不会重复计数）；
 * 勾了 child_due 的空壳跳过；有效截止日 = 自身 due 优先，否则沿 parent 链继承最近祖先 due；
 * 无任何有效日期的叶子（备忘录）不返回。
 * @param {Object} raw - storage.chartRaw 结果 { tree: [{id,parent_id,due,child_due,done,done10,title}] }
 * @returns {Array<{id,parent_id,due,done,done10,title}>}
 */
function buildEffLeafTasks(raw) {
  const byId = new Map();
  (raw.tree || []).forEach(r => { if (r && r.id != null) byId.set(r.id, r); });
  const parentIds = new Set();
  byId.forEach(r => { if (r.parent_id != null) parentIds.add(r.parent_id); });
  const out = [];
  byId.forEach(r => {
    if (parentIds.has(r.id)) return;     // 非叶子（父任务）跳过
    if (r.child_due) return;            // 独立截止空壳跳过
    let due = r.due || null, cur = r, guard = 0;
    if (!due) {
      // 自身无日期 → 沿链继承最近祖先的日期（与 effDueOf 同口径，tree 缺行时终止）
      while (cur.parent_id != null && byId.has(cur.parent_id) && guard++ < 100) {
        cur = byId.get(cur.parent_id);
        if (cur.due) { due = cur.due; break; }
      }
    }
    if (!due) return;
    out.push({ id: r.id, parent_id: r.parent_id, due, done: r.done, done10: r.done10, title: r.title });
  });
  return out;
}

/**
 * 构造图表序列：按 range 决定按天/按月，产出连续标签与 总任务/未完成/完成 三条序列
 * ≤60 天按天，半年/1年/3年按月。
 * 对轴上每一天 d，直接按定义逐任务计数（不做历史反推，结果恒非负）：
 *   open(d)  —— 当天未完成：due<=d 且（最终未完成，或最终完成日晚于 d）；
 *                即「当天到期未完成 + 历史逾期」，未来任务与无日期备忘录不计
 *   done(d)  —— 当天完成：自身在 d 完成，或未勾选但被 d 当天完成的主任务收编
 *               （done=1 缺完成日的脏数据不计）
 *   total(d) —— 当天总任务 = open(d) + done(d)（含完成、逾期、未完成全部）
 * 月格：完成数为当月每日之和；未完成取月末水位（当月取 today）；
 *       总任务 = 月末未完成 + 当月完成数。
 * 每格同时产出 details（与数字同一次遍历，逐条可对账），供折线图点击钻取：
 *   details[i] = { label(日格 YYYY-MM-DD / 月格 YYYY-MM), done:[{id,title,due,path,adopted,late}], open:[...] }
 *   path=祖先标题(根在前,不含自身,旧模式顶层行为空数组); adopted=1 表示自身未勾选、随已完成主任务收编;
 *   late=1 表示逾期补做(完成组)/逾期挂账(未完成组)
 * @param {Object} raw - storage.chartRaw 结果 { tree:[{id,parent_id,due,child_due,done,done10,title}] }
 * @param {string} range - month|7d|30d|60d|6m|1y|3y
 * @param {string} today - 北京时区当天 YYYY-MM-DD（区间末点）
 * @returns {Object} { range, unit, labels[], total[], open[], done[], details[] }
 */
function buildChartSeries(raw, range, today) {
  const cfg = CHART_RANGES[range] || CHART_RANGES['7d'];
  // 仅末端叶子 + 有效截止日（自身优先否则继承祖先）; 逐级门控下父/子不重复计数
  const tasks = buildEffLeafTasks(raw);
  const effDone = buildEffDoneResolver(raw);
  // 逐行预算有效完成态（同一行在按天循环里被反复判定）
  const effMap = new Map();
  const effOf = (t) => {
    let e = effMap.get(t.id);
    if (!e) { e = effDone(t); effMap.set(t.id, e); }
    return e;
  };

  // d 日末仍未完成（已到期）：最终未完成全期挂账；最终完成的在完成日次日才消失。
  // done 但缺完成日的脏数据按"早已完成"处理，不计入任何历史日。
  const openAt = (t, d) => {
    const e = effOf(t);
    return t.due <= d && (!e.done || (!!e.day && e.day > d));
  };
  // 祖先标题路径（根在前、不含自身）：钻取弹窗据此显示"主任务 / 中间层"面包屑，标明子任务来源。
  // 旧模式带日期的行全是顶层主任务，path 恒为空；tree 缺行（数据异常/跨范围）时就地终止。
  const treeById = new Map();
  (raw.tree || []).forEach(r => { if (r && r.id != null) treeById.set(r.id, r); });
  const pathOf = (t) => {
    const path = [];
    let cur = t, guard = 0;
    while (cur.parent_id != null && treeById.has(cur.parent_id) && guard++ < 20) {
      cur = treeById.get(cur.parent_id);
      path.unshift(cur.title || '');
    }
    return path;
  };
  // 钻取明细项：完成组 late=逾期补做(完成日晚于到期日)；未完成组 late=截至 asOf 已逾期
  const doneItem = (t, e) => ({
    id: t.id, title: t.title || '', due: t.due, path: pathOf(t),
    adopted: t.done !== 1 ? 1 : 0, late: e.day > t.due ? 1 : 0
  });
  const openItem = (t, asOf) => ({
    id: t.id, title: t.title || '', due: t.due, path: pathOf(t), adopted: 0, late: t.due < asOf ? 1 : 0
  });
  // 无日期叶子(备忘录式)平时不进曲线; 但被已完成祖先收编时, 在祖先完成日计入一次完成。
  // 限定: 末端叶子 + 自身未勾选 + 有完成日(祖先 done_at); 自身完成的无日期任务仍不进(沿用历史口径);
  // 只影响折线完成量, 不影响 buildAnalysis(无到期日不参与达标率)。
  const datedIds = new Set(tasks.map(t => t.id));
  const parentIds = new Set();
  (raw.tree || []).forEach(r => { if (r.parent_id != null) parentIds.add(r.parent_id); });
  const isLeafInTree = (r) => !parentIds.has(r.id);
  const adoptedUndated = [];
  (raw.tree || []).forEach(r => {
    if (!r || datedIds.has(r.id) || !isLeafInTree(r) || r.done === 1 || r.parent_id == null) return;
    const e = effOf(r);
    if (e.done && e.day) {
      adoptedUndated.push({ day: e.day, item: { id: r.id, title: r.title || '', due: null, path: pathOf(r), adopted: 1, late: 0 } });
    }
  });
  // 把全部任务按某一天 d 分成「当天完成 / 当天末仍未完成」两组（互斥，合计即当天总任务）
  const splitByDay = (d) => {
    const dn = [], op = [];
    for (const t of tasks) {
      const e = effOf(t);
      if (e.done && e.day === d) dn.push(doneItem(t, e));
      if (openAt(t, d)) op.push(openItem(t, d));
    }
    adoptedUndated.forEach(u => { if (u.day === d) dn.push(u.item); });
    return { dn, op };
  };

  const DAY = 86400000;
  const todayMs = dayMs(today);
  const labels = [], total = [], open = [], done = [], details = [];
  const pushBucket = (label, dn, op) => {
    labels.push(label.length > 7 ? label.slice(5) : label); // 日格 MM-DD；月格保留 YYYY-MM
    open.push(op.length);
    done.push(dn.length);
    total.push(op.length + dn.length);
    details.push({ label, done: dn, open: op });
  };

  if (cfg.unit === 'month-current') {
    // 当月: 从 today 所在月 1 号起, 到 today 为止, 每天一格
    const n = +today.slice(8, 10);
    for (let i = n - 1; i >= 0; i--) {
      const day = msDay(todayMs - i * DAY);
      const g = splitByDay(day);
      pushBucket(day, g.dn, g.op);
    }
  } else if (cfg.unit === 'day') {
    for (let i = cfg.span - 1; i >= 0; i--) {
      const day = msDay(todayMs - i * DAY);
      const g = splitByDay(day);
      pushBucket(day, g.dn, g.op);
    }
  } else {
    // 按月：完成数为当月完成行；未完成取月末水位（历史月=月末，当月=today）；总任务=两者之和
    const y = +today.slice(0, 4), m = +today.slice(5, 7) - 1;
    for (let i = cfg.span - 1; i >= 0; i--) {
      const monthDate = new Date(Date.UTC(y, m - i, 1));
      const ym = monthDate.toISOString().slice(0, 7); // YYYY-MM
      const monthEnd = msDay(Date.UTC(y, m - i + 1, 0));
      const snap = monthEnd > today ? today : monthEnd;
      const dn = [], op = [];
      for (const t of tasks) {
        const e = effOf(t);
        if (e.done && e.day && e.day.slice(0, 7) === ym) dn.push(doneItem(t, e));
        if (openAt(t, snap)) op.push(openItem(t, snap));
      }
      adoptedUndated.forEach(u => { if (u.day.slice(0, 7) === ym) dn.push(u.item); });
      pushBucket(ym, dn, op);
    }
  }
  return { range, unit: cfg.unit, labels, total, open, done, details };
}

/**
 * 构造任务分析数据：日完成率、连续达标 streak、区间完成率/逾期率（纯计算，不碰存储）
 *
 * 达标口径：当天有到期任务且日终零新增逾期 = win；有新增逾期 = fail；
 *           当天无到期任务 = idle（中性，不断签也不计天数）；today 当天未收官 = pending（不计入）。
 * 与 buildChartSeries 同一脏数据约定：done=1 但缺 done10 按「早已完成」处理，不计逾期。
 *
 * @param {Object} raw - storage.todo.chartRaw 的返回 { tree }
 * @param {number} days - 窗口天数，窗口含 today
 * @param {string} today - 北京时区当天 YYYY-MM-DD（区间末点）
 * @returns {Object} { days, currentStreak, longestStreak, winRate, onTimeRate, overdueRate, daily[] }
 *   winRate/overdueRate 为 0..1 比率（无分母时 null）；
 *   daily: [{ date:'YYYY-MM-DD', planned, done, overdue, rate: 0..1|null, mark: win|fail|idle|pending }]
 */
function buildAnalysis(raw, days, today) {
  // 仅末端叶子 + 有效截止日，与 buildChartSeries / countStats 同口径
  const tasks = buildEffLeafTasks(raw);
  const effDone = buildEffDoneResolver(raw);
  const DAY = 86400000;
  const todayMs = dayMs(today);

  // 按到期日聚合：dueCnt=到期数；doneFinalCnt=最终完成数（含逾期补做、缺 done10 的历史完成、
  // 被完成主任务收编的子任务）；overCnt=日终仍未完成（新增逾期；收编但收编日晚于到期日算逾期补做）；
  // onTimeCnt=按时完成数（最终完成且完成日<=到期日；缺完成日的历史完成按"早已完成"视为按时，与逾期口径对称）
  const dueCnt = {}, doneFinalCnt = {}, overCnt = {}, onTimeCnt = {};
  let minMs = null;
  for (const t of tasks) {
    const e = effDone(t);
    dueCnt[t.due] = (dueCnt[t.due] || 0) + 1;
    if (e.done) {
      doneFinalCnt[t.due] = (doneFinalCnt[t.due] || 0) + 1;
      if (!(e.day && e.day > t.due)) onTimeCnt[t.due] = (onTimeCnt[t.due] || 0) + 1;
    }
    const unfinishedAtEnd = !e.done || (!!e.day && e.day > t.due);
    if (unfinishedAtEnd) overCnt[t.due] = (overCnt[t.due] || 0) + 1;
    const ms = dayMs(t.due);
    if (minMs === null || ms < minMs) minMs = ms;
  }

  // d 日标记：today 未收官=pending；无到期=idle；有新增逾期=fail；否则 win
  const markAt = (d, isToday) => {
    if (isToday) return 'pending';
    if (!dueCnt[d]) return 'idle';
    return overCnt[d] ? 'fail' : 'win';
  };

  // 当前连续达标：从昨天往回，跳过 idle，遇 fail 止；早于首个到期日后停止
  let currentStreak = 0;
  for (let ms = todayMs - DAY; minMs !== null && ms >= minMs; ms -= DAY) {
    const m = markAt(msDay(ms), false);
    if (m === 'win') currentStreak++;
    else if (m === 'fail') break;
  }

  // 最长连续达标：首个到期日 → 昨天，idle 不断签
  let longestStreak = 0, run = 0;
  if (minMs !== null) {
    for (let ms = minMs; ms < todayMs; ms += DAY) {
      const m = markAt(msDay(ms), false);
      if (m === 'win') { run++; if (run > longestStreak) longestStreak = run; }
      else if (m === 'fail') run = 0;
    }
  }

  // 窗口逐日明细（含 today）
  const daily = [];
  let winDue = 0, winDone = 0, winOnTime = 0, pastDue = 0, pastOver = 0;
  for (let i = days - 1; i >= 0; i--) {
    const d = msDay(todayMs - i * DAY);
    const isToday = i === 0;
    const planned = dueCnt[d] || 0;
    const doneN = doneFinalCnt[d] || 0;
    const overdue = overCnt[d] || 0;
    daily.push({ date: d, planned, done: doneN, overdue, rate: planned ? doneN / planned : null, mark: markAt(d, isToday) });
    winDue += planned; winDone += doneN; winOnTime += (onTimeCnt[d] || 0);
    if (!isToday) { pastDue += planned; pastOver += overdue; }
  }

  return {
    days,
    currentStreak,
    longestStreak,
    winRate: winDue ? winDone / winDue : null,
    // 按时完成率: 最终完成且完成日<=到期日 / 到期数（含今天，与 winRate 同窗；逾期补做不算按时）
    onTimeRate: winDue ? winOnTime / winDue : null,
    overdueRate: pastDue ? pastOver / pastDue : null,
    daily
  };
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

export { buildTree, flattenPending, countStats, buildWidgetGroups, buildChartSeries, buildAnalysis, CHART_RANGES, shiftDate, todoDateLabel, todoDateBadge, effDueOf, rootDueOf };
