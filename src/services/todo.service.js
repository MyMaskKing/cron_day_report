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
    if (node.children.length === 0 && own && (!min || own < min)) min = own;
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
    // 新模式(child_due)空主任务是分组容器(日期由子任务决定), 自身无日期是结构使然,
    // 不算备忘录/待办/总数; 待其添加子任务后由叶子子任务计入
    if (r.parent_id == null && r.child_due) continue;
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
      if (!isRoot && n.children.length === 0 && leafPass(ownDue)) {
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
 * 构造图表序列：按 range 决定按天/按月，产出连续标签与 新建/完成/到期未完成 三条序列
 * ≤60 天按天，半年/1年/3年按月。
 * 到期未完成（open）：截至当天「已到期仍未完成」的任务数（未来任务、无日期备忘录不计）。
 *   以 raw.openNow（今天水位）反推：open(d-1) = open(d) − entries(d) + exits(d)
 *   entries=到期日当天仍未完成（进入存量）；exits=逾期后补做完成（离开存量）；
 *   到期当天即完成的任务从不进入存量。月格取该月最后一天水位（当月取 today）。
 * @param {Object} raw - storage.chartRaw 结果 { created, done, entries, exits:[{d,c}], openNow:number }
 * @param {string} range - month|7d|30d|60d|6m|1y|3y
 * @param {string} today - 北京时区当天 YYYY-MM-DD（区间末点）
 * @returns {Object} { range, unit, labels[], created[], done[], open[] }
 */
function buildChartSeries(raw, range, today) {
  const cfg = CHART_RANGES[range] || CHART_RANGES['7d'];
  const createdMap = {}, doneMap = {}, entriesMap = {}, exitsMap = {};
  (raw.created || []).forEach(r => { if (r.d) createdMap[r.d] = r.c; });
  (raw.done || []).forEach(r => { if (r.d) doneMap[r.d] = r.c; });
  (raw.entries || []).forEach(r => { if (r.d) entriesMap[r.d] = r.c; });
  (raw.exits || []).forEach(r => { if (r.d) exitsMap[r.d] = r.c; });
  const DAY = 86400000;
  const todayMs = dayMs(today);

  // 生成 [startMs, today] 连续北京日（YYYY-MM-DD）
  const dayRange = (startMs) => {
    const out = [];
    for (let ms = startMs; ms <= todayMs; ms += DAY) out.push(msDay(ms));
    return out;
  };
  // 由今天水位 openNow 反向递推每天的到期未完成存量
  const backfillOpen = (days) => {
    const map = {};
    let cur = Number.isFinite(raw.openNow) ? raw.openNow : 0;
    map[days[days.length - 1]] = cur;
    for (let i = days.length - 1; i > 0; i--) {
      cur = cur - (entriesMap[days[i]] || 0) + (exitsMap[days[i]] || 0);
      map[days[i - 1]] = cur;
    }
    return map;
  };

  const labels = [], created = [], done = [], open = [];
  if (cfg.unit === 'month-current') {
    // 当月: 从 today 所在月 1 号起, 到 today 为止, 每天一格
    const n = +today.slice(8, 10);
    const days = dayRange(todayMs - (n - 1) * DAY);
    const openMap = backfillOpen(days);
    days.forEach(day => {
      labels.push(day.slice(5)); // MM-DD
      created.push(createdMap[day] || 0);
      done.push(doneMap[day] || 0);
      open.push(openMap[day]);
    });
  } else if (cfg.unit === 'day') {
    const days = dayRange(todayMs - (cfg.span - 1) * DAY);
    const openMap = backfillOpen(days);
    days.forEach(day => {
      labels.push(day.slice(5)); // MM-DD
      created.push(createdMap[day] || 0);
      done.push(doneMap[day] || 0);
      open.push(openMap[day]);
    });
  } else {
    // 按月：新建/完成聚合当月每日之和；存量取月内最后一天水位（历史月=月末，当月=today）
    const y = +today.slice(0, 4), m = +today.slice(5, 7) - 1;
    const firstMs = Date.UTC(y, m - (cfg.span - 1), 1);
    const days = dayRange(firstMs);
    const openMap = backfillOpen(days);
    for (let i = cfg.span - 1; i >= 0; i--) {
      const monthDate = new Date(Date.UTC(y, m - i, 1));
      const ym = monthDate.toISOString().slice(0, 7); // YYYY-MM
      labels.push(ym);
      let cc = 0, dc = 0;
      for (const k in createdMap) if (k.slice(0, 7) === ym) cc += createdMap[k];
      for (const k in doneMap) if (k.slice(0, 7) === ym) dc += doneMap[k];
      created.push(cc);
      done.push(dc);
      // 该月最后一个有数据意义的日子：月末与 today 取较早者（当月只走到 today）
      const monthEnd = msDay(Date.UTC(y, m - i + 1, 0));
      const snap = monthEnd > today ? today : monthEnd;
      open.push(openMap[snap] != null ? openMap[snap] : 0);
    }
  }
  return { range, unit: cfg.unit, labels, created, done, open };
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

export { buildTree, flattenPending, countStats, buildWidgetGroups, buildChartSeries, CHART_RANGES, shiftDate, todoDateLabel, todoDateBadge, effDueOf, rootDueOf };
