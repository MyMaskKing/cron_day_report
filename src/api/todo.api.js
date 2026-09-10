/**
 * 待办 API
 * 任务 CRUD（无限嵌套子任务）、独立完成状态、免密协作填写、免密报告查看
 */

import { json, error } from '../router.js';
import { getStorage } from '../storage/adapter.js';
import { requireAuth } from '../auth/middleware.js';
import { generateToken } from '../auth/password.js';
import { resolveBaseUrl } from '../config.js';
import { requireDataContext } from './share.api.js';
import { countStats, buildWidgetGroups, buildChartSeries, CHART_RANGES } from '../services/todo.service.js';

/** 取北京时区当天 YYYY-MM-DD */
function todayCN() {
  const now = new Date(Date.now() + 8 * 3600 * 1000); // UTC+8
  return now.toISOString().slice(0, 10);
}

/** 读取数据 owner 的待办偏好：子任务全部完成后是否自动完成父任务（默认开启，列缺失/NULL 也视为开） */
async function autoParentOn(storage, ownerUid) {
  const u = await storage.users.findById(ownerUid);
  return !u || u.todo_auto_parent !== 0;
}

/** 规范化优先级为 0/1/2，非法回退 1 */
function normPriority(v) {
  const n = parseInt(v, 10);
  return (n === 0 || n === 1 || n === 2) ? n : 1;
}
/** 规范化重复间隔: null / <1 归一为 null(等价 1); [1..99] clamp; 非法返回 null */
function normRecurInterval(v) {
  if (v == null || v === '') return null;
  const n = parseInt(v, 10);
  if (!isFinite(n) || n < 1) return null;
  return Math.min(n, 99);
}
/** 规范化 monthly_nth_weekday 的第 N 个: [1..5], 5=最后一个; 非法返回 null */
function normRecurNth(v) {
  if (v == null || v === '') return null;
  const n = parseInt(v, 10);
  if (!isFinite(n) || n < 1 || n > 5) return null;
  return n;
}
/** 规范化 monthly_nth_weekday 的星期几: [0..6], 0=周日; 非法返回 null */
function normRecurWeekday(v) {
  if (v == null || v === '') return null;
  const n = parseInt(v, 10);
  if (!isFinite(n) || n < 0 || n > 6) return null;
  return n;
}
/** 重复周期白名单(顶层任务) */
const REC_LIST = ['daily', 'weekly', 'monthly', 'yearly', 'monthly_nth_weekday'];

/**
 * 校验 dc.uid 对任务行的访问权限（共享分类成员身份实时查 todo_shared_cat_members）。
 * 个人任务(shared_cat_id NULL)：须归属 dc.uid；共享分类任务：dc.uid 须为该分类成员。
 * @returns {Promise<{ownerUid:number, catId:number|null, role:string}|null>}
 *   ownerUid = 行 user_id（数据归属人，共享分类下恒为分类 owner）；存储写调用统一传它，
 *   存储层 user_id 双校验依然成立。成员真实身份由调用方记 created_by/done_by。
 */
async function todoAccess(storage, dc, row) {
  if (row.shared_cat_id != null) {
    const m = await storage.sharedCat.findMember(row.shared_cat_id, dc.uid);
    if (!m) return null;
    return { ownerUid: row.user_id, catId: row.shared_cat_id, role: m.role };
  }
  if (row.user_id !== dc.uid) return null;
  return { ownerUid: row.user_id, catId: null, role: 'owner' };
}

/** 沿 parent 链找到顶层主任务行（用于判断该任务所在清单是否 child_due 新模式） */
async function rootRowOf(storage, row) {
  let cur = row;
  const guard = new Set();
  while (cur.parent_id != null && !guard.has(cur.parent_id)) {
    guard.add(cur.parent_id);
    const p = await storage.todo.findById(cur.parent_id);
    if (!p) break;
    cur = p;
  }
  return cur;
}

/**
 * 从 body 抽出重复相关字段, 归一到统一形状
 * 返回 { recurrence, recur_interval, recur_nth, recur_weekday }
 * - allowRecur=false(旧模式子任务 / 新模式主任务 / 新模式非叶子子任务)一律清空
 * - 无 recurrence 时三伴生列一律 null
 * - recurrence 为 monthly_nth_weekday 且 nth/weekday 缺失时降级为 null(不写入无效行)
 */
function readRecurFields(body, allowRecur) {
  if (!allowRecur) return { recurrence: null, recur_interval: null, recur_nth: null, recur_weekday: null };
  const raw = body.recurrence;
  const rec = (raw && REC_LIST.includes(raw)) ? raw : null;
  if (!rec) return { recurrence: null, recur_interval: null, recur_nth: null, recur_weekday: null };
  const iv = normRecurInterval(body.recur_interval);
  if (rec === 'monthly_nth_weekday') {
    const nth = normRecurNth(body.recur_nth);
    const wd = normRecurWeekday(body.recur_weekday);
    // nth/weekday 必须完整; 缺一即视为未开重复, 避免写入残缺行
    if (nth == null || wd == null) {
      return { recurrence: null, recur_interval: null, recur_nth: null, recur_weekday: null };
    }
    return { recurrence: rec, recur_interval: iv, recur_nth: nth, recur_weekday: wd };
  }
  return { recurrence: rec, recur_interval: iv, recur_nth: null, recur_weekday: null };
}

// ==================== 登录态 CRUD ====================

/** GET /api/todo/list  当前用户可见全部待办（个人任务 + 我加入的共享分类，扁平行）+ 统计概览 */
async function listTodos({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const dc = await requireDataContext(storage, auth, 'todo', request);
  if (dc instanceof Response) return dc;
  const rows = await storage.todo.listVisibleForUser(dc.uid);
  const stats = countStats(rows, todayCN());
  return json({ success: true, todos: rows, stats });
}

/** POST /api/todo  新建任务  body: { parent_id?, title, priority?, due_date?, category?, child_due? } */
async function createTodo({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  const title = (body.title || '').trim();
  if (!title) return error('请填写任务标题');

  const storage = getStorage(env);
  const dc = await requireDataContext(storage, auth, 'todo', request);
  if (dc instanceof Response) return dc;
  let parentId = null;
  let parentRow = null;
  let parentAcc = null;
  let rootRow = null;
  if (body.parent_id != null && body.parent_id !== '') {
    parentId = parseInt(body.parent_id, 10);
    parentRow = await storage.todo.findById(parentId);
    if (!parentRow) return error('父任务不存在', 404);
    // 个人父任务须归属本人; 共享分类父任务须是该目录成员(todoAccess 统一校验)
    parentAcc = await todoAccess(storage, dc, parentRow);
    if (!parentAcc) return error('父任务不存在', 404);
    rootRow = await rootRowOf(storage, parentRow);
  }
  // child_due 新模式仅新建顶层主任务时可开启; 子任务沿用所在主任务的模式
  const childDue = parentId == null ? !!body.child_due : false;
  const childDueMode = parentId != null ? !!rootRow.child_due : childDue;
  // 截止日期: 旧模式仅顶层可设(子任务继承); 新模式顶层不设, 子任务可各自设置
  const dueDate = parentId == null
    ? (childDue ? null : ((body.due_date || '').trim() || null))
    : (childDueMode ? ((body.due_date || '').trim() || null) : null);
  // 重复: 旧模式顶层可设; 新模式仅子任务可设(新建任务即为叶子)
  const recFields = readRecurFields(body, parentId == null ? !childDue : childDueMode);
  // 不变量: 新模式下重复任务必须是叶子; 若给带重复的叶子任务添加首个子任务, 先记录, 建后清其重复
  const parentWasLeaf = parentRow ? (await storage.todo.collectDescendantIds(parentId)).length === 0 : false;
  // 共享分类归属: 子任务继承父任务所在分类; 顶层任务可显式指定 shared_cat_id(在分类视图下新建)
  // 行归属分类 owner(ownerUid), shared_cat_id 为分类 id, created_by 记真实操作人;
  // 个人任务: 归属 dc.uid, shared_cat_id NULL, created_by=dc.uid
  let catId = parentAcc ? parentAcc.catId : null;
  let ownerUid = parentAcc ? parentAcc.ownerUid : dc.uid;
  if (parentId == null && body.shared_cat_id) {
    const cid = parseInt(body.shared_cat_id, 10);
    const cat = await storage.sharedCat.findCatById(cid);
    if (!cat) return error('共享分类不存在', 404);
    const member = await storage.sharedCat.findMember(cid, dc.uid);
    if (!member) return error('你不是该共享分类成员', 403);
    catId = cid;
    ownerUid = cat.owner_user_id;
  }
  const id = await storage.todo.create(ownerUid, {
    parent_id: parentId, title,
    priority: normPriority(body.priority),
    due_date: dueDate,
    category: (body.category || '').trim() || null,
    note: (body.note || '').trim() || null,
    child_due: childDue ? 1 : 0,
    recurrence: recFields.recurrence,
    recur_interval: recFields.recur_interval,
    recur_nth: recFields.recur_nth,
    recur_weekday: recFields.recur_weekday,
    shared_cat_id: catId,
    created_by: catId != null ? auth.user_id : dc.uid
  });
  if (childDueMode && parentWasLeaf && parentRow && parentRow.recurrence) {
    await storage.todo.clearRecur(parentId);
  }
  return json({ success: true, message: '任务已添加', id });
}

/** PUT /api/todo/:id  修改任务  body: { title, priority?, due_date?, category?, child_due?, shared_cat_id? }
 *  shared_cat_id 仅顶层任务生效：数字=移入该共享分类（须为分类成员），null=移出回个人（仅分类 owner）；子任务忽略。 */
async function updateTodo({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  const title = (body.title || '').trim();
  if (!title) return error('请填写任务标题');

  const storage = getStorage(env);
  const dc = await requireDataContext(storage, auth, 'todo', request);
  if (dc instanceof Response) return dc;
  const id = parseInt(params.id, 10);
  const t = await storage.todo.findById(id);
  if (!t) return error('任务不存在', 404);
  const acc = await todoAccess(storage, dc, t);
  if (!acc) return error('任务不存在', 404);
  // 共享分类下任务就是普通协作任务, 成员均可编辑(删除才收口给 owner, 见 removeTodo)
  const isRoot = t.parent_id == null;
  const rootRow = isRoot ? t : await rootRowOf(storage, t);

  // child_due 模式切换(仅顶层主任务): 开→主任务日期/重复由下方归一清空; 关→清空全部后代日期/重复
  let childDue = !!rootRow.child_due;
  if (isRoot && Object.prototype.hasOwnProperty.call(body, 'child_due')) {
    const want = !!body.child_due;
    if (want && !childDue) childDue = true;
    else if (!want && childDue) {
      childDue = false;
      await storage.todo.clearSubtreeDates(id);
    }
  }
  const childDueMode = isRoot ? childDue : !!rootRow.child_due;
  // 截止日期: 旧模式仅顶层可设(子任务继承); 新模式顶层不设, 子任务可各自设置
  const dueDate = isRoot
    ? (childDue ? null : ((body.due_date || '').trim() || null))
    : (childDueMode ? ((body.due_date || '').trim() || null) : null);
  // 重复: 旧模式顶层可设; 新模式仅叶子子任务可设(有后代的任务不允许)
  let allowRecur;
  if (isRoot) allowRecur = !childDue;
  else {
    const descendants = await storage.todo.collectDescendantIds(id);
    allowRecur = childDueMode && descendants.length === 0;
  }
  const payload = {
    title,
    priority: normPriority(body.priority),
    due_date: dueDate,
    category: (body.category || '').trim() || null,
    note: (body.note || '').trim() || null
  };
  if (isRoot) payload.child_due = childDue ? 1 : 0;
  // body 显式携带 recurrence, 或主任务切到 child_due 模式(需清空其旧重复)时, 归一重复字段
  if (Object.prototype.hasOwnProperty.call(body, 'recurrence') || (isRoot && childDue)) {
    const recFields = readRecurFields(body, allowRecur);
    payload.recurrence = recFields.recurrence;
    payload.recur_interval = recFields.recur_interval;
    payload.recur_nth = recFields.recur_nth;
    payload.recur_weekday = recFields.recur_weekday;
  }
  await storage.todo.update(id, acc.ownerUid, payload);
  // 共享分类归属变更（仅顶层主任务；子任务继承父任务归属，忽略该字段）。
  // body 显式带 shared_cat_id 键才处理（前端编辑保存始终携带；null=个人/移出，数字=移入该分类）。
  if (isRoot && Object.prototype.hasOwnProperty.call(body, 'shared_cat_id')) {
    const wantCatId = body.shared_cat_id ? parseInt(body.shared_cat_id, 10) : null;
    const curCatId = t.shared_cat_id != null ? t.shared_cat_id : null;
    if (wantCatId !== curCatId) {
      let newOwnerId = acc.ownerUid;
      let newCatId = curCatId;
      if (curCatId == null && wantCatId != null) {
        // 个人 → 共享：目标分类成员即可移入（与 createTodo 同口径），行 owner 转为分类 owner
        const cat = await storage.sharedCat.findCatById(wantCatId);
        if (!cat) return error('共享分类不存在', 404);
        const member = await storage.sharedCat.findMember(wantCatId, dc.uid);
        if (!member) return error('你不是该共享分类成员', 403);
        newOwnerId = cat.owner_user_id;
        newCatId = wantCatId;
      } else if (curCatId != null && wantCatId == null) {
        // 共享 → 个人：仅分类 owner 可移出（editor 不能动别人创建的共享任务）
        if (acc.role !== 'owner') return error('仅分类创建者可把任务移出共享分类', 403);
        newOwnerId = t.user_id; // 行 owner 本就是分类 owner，不变；仅摘 shared_cat_id
        newCatId = null;
      } else if (curCatId != null && wantCatId !== curCatId) {
        return error('暂不支持在共享分类之间直接移动，请先移出再移入', 400);
      }
      // 整树（root + 全部后代）一次性迁移，保证每行 user_id/shared_cat_id 一致
      const ids = [id, ...(await storage.todo.collectDescendantIds(id))];
      await storage.todo.reassignSubtree(ids, newOwnerId, newCatId);
    }
  }
  return json({ success: true, message: '任务已更新' });
}

/** PUT /api/todo/:id/done  勾选/取消完成当前任务  body: { done } */
async function toggleTodo({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  const done = !!body.done;
  const jumpToCurrent = !!body.jumpToCurrent;

  const storage = getStorage(env);
  const dc = await requireDataContext(storage, auth, 'todo', request);
  if (dc instanceof Response) return dc;
  const id = parseInt(params.id, 10);
  const t = await storage.todo.findById(id);
  if (!t) return error('任务不存在', 404);
  const acc = await todoAccess(storage, dc, t);
  if (!acc) return error('任务不存在', 404);
  // done_by: 共享分类记真实操作人(auth.user_id); 个人任务置 null
  const doneBy = acc.catId != null ? auth.user_id : null;
  const r = await storage.todo.markDoneWithRecur(id, acc.ownerUid, done, jumpToCurrent, todayCN(), doneBy);
  // 偏好开启时(偏好跟随数据 owner):
  //   勾选 → 全部兄弟子任务均完成则逐级自动完成父任务;
  //   取消 → 沿父链把已完成的祖先恢复为未完成(父完成⇒子任务应全完成的不变量被破坏)
  if (await autoParentOn(storage, acc.ownerUid)) {
    if (done) await storage.todo.autoCompleteAncestors(id, acc.ownerUid, todayCN(), doneBy);
    else await storage.todo.reopenAncestors(id, acc.ownerUid);
  }
  return json({ success: true, message: done ? '已完成' : '已取消完成', cloned: !!r.cloned, next_id: r.next_id || null, next_due: r.next_due || null });
}

/** PUT /api/todo/reorder  子任务同级重排  body: { parent_id, ids:[...] }
 * 校验 ids 全属该用户且 parent_id 与 body 一致，再批量写 sort_order
 */
async function reorderTodo({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  const parentId = body.parent_id != null && body.parent_id !== '' ? parseInt(body.parent_id, 10) : null;
  const ids = Array.isArray(body.ids) ? body.ids.map(v => parseInt(v, 10)).filter(n => !isNaN(n)) : [];
  if (ids.length === 0) return error('缺少排序列表');

  const storage = getStorage(env);
  const dc = await requireDataContext(storage, auth, 'todo', request);
  if (dc instanceof Response) return dc;
  // 逐个校验访问权限与同父，防越权/跨级；同次排序必须同属个人或同一共享分类
  let catId = null;
  let ownerUid = dc.uid;
  for (const id of ids) {
    const t = await storage.todo.findById(id);
    if (!t) return error('任务不存在', 404);
    const acc = await todoAccess(storage, dc, t);
    if (!acc) return error('任务不存在', 404);
    const tp = t.parent_id != null ? t.parent_id : null;
    if (tp !== parentId) return error('存在跨层级的任务，无法排序', 400);
    if (catId === null) { catId = acc.catId; ownerUid = acc.ownerUid; }
    else if (acc.catId !== catId) return error('存在跨分类的任务，无法排序', 400);
  }
  await storage.todo.reorder(ownerUid, parentId, ids);
  return json({ success: true, message: '顺序已更新' });
}

/** DELETE /api/todo/:id  删除任务（级联删除全部子任务）；共享分类中仅分类 owner 可删 */
async function removeTodo({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const dc = await requireDataContext(storage, auth, 'todo', request);
  if (dc instanceof Response) return dc;
  const id = parseInt(params.id, 10);
  const t = await storage.todo.findById(id);
  if (!t) return error('任务不存在', 404);
  const acc = await todoAccess(storage, dc, t);
  if (!acc) return error('任务不存在', 404);
  // 共享分类内删除是破坏性操作, 收口给分类 owner(editor 可增改勾排, 不能删)
  if (acc.catId != null && acc.role !== 'owner') {
    return error('共享分类中仅创建者可删除任务', 403);
  }
  const descendants = await storage.todo.collectDescendantIds(id);
  await storage.todo.remove([id, ...descendants]);
  return json({ success: true, message: '任务已删除' });
}

/** DELETE /api/todo/categories?name=xx  删除个人文本分类：分类下任务保留，统一摘为「未分类」 */
async function deleteCategory({ request, env, url }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const dc = await requireDataContext(storage, auth, 'todo', request);
  if (dc instanceof Response) return dc;
  const name = (url.searchParams.get('name') || '').trim();
  if (!name) return error('缺少分类名', 400);
  await storage.todo.clearCategory(dc.uid, name);
  return json({ success: true, message: '分类已删除，任务已转为未分类' });
}

/** PUT /api/todo/categories  重命名个人文本分类：body { old, name }，分类下任务批量改挂新名 */
async function renameCategory({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const dc = await requireDataContext(storage, auth, 'todo', request);
  if (dc instanceof Response) return dc;
  const body = await request.json().catch(() => ({}));
  const oldName = (body.old || '').trim();
  const newName = (body.name || '').trim();
  if (!oldName || !newName) return error('分类名不能为空', 400);
  if (oldName === newName) return json({ success: true, message: '名称未变化' });
  // 新名已被占用时拒绝: 否则 UPDATE 会把两个分类的任务合并到一起且无法拆分
  if (await storage.todo.categoryExists(dc.uid, newName)) {
    return error('已存在同名分类，请换一个名称', 400);
  }
  await storage.todo.renameCategory(dc.uid, oldName, newName);
  return json({ success: true, message: '分类已重命名' });
}

/** GET /api/todo/:id/share-link  获取/生成顶层任务免密协作链接 */
async function getShareLink({ request, env, params, url }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const id = parseInt(params.id, 10);
  const t = await storage.todo.findById(id);
  if (!t || t.user_id !== auth.user_id) return error('任务不存在', 404);
  if (t.parent_id != null) return error('仅顶层任务可分享', 400);

  let token = t.share_token;
  // reset=1 时强制重置：重新生成 token 覆盖旧值，旧链接立即失效
  if (!token || url.searchParams.get('reset')) {
    token = generateToken();
    await storage.todo.setShareToken(id, token);
  }
  const base = await resolveBaseUrl(storage, env, url);
  return json({ success: true, token, link: `${base}/t/${token}` });
}

/** GET /api/todo/chart?range=  当前用户每日/每月创建量与完成量序列
 * range ∈ 7d|30d|60d|6m|1y|3y，默认 7d
 */
async function todoChart({ request, env, url }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const dc = await requireDataContext(storage, auth, 'todo', request);
  if (dc instanceof Response) return dc;
  const range = CHART_RANGES[url.searchParams.get('range')] ? url.searchParams.get('range') : '7d';
  const raw = await storage.todo.chartRaw(dc.uid);
  const series = buildChartSeries(raw, range, todayCN());
  return json({ success: true, series });
}

// ==================== 免密公开 ====================

/** GET /api/public/todo/:token  免密查看某顶层任务子树 */
async function publicTodoInfo({ env, params }) {
  const storage = getStorage(env);
  const root = await storage.todo.findByShareToken(params.token);
  if (!root) return error('链接无效或已失效', 404);
  await storage.users.updateLastPublic(root.user_id);
  const rows = await storage.todo.listSubtree(root.id);
  const owner = await storage.users.findById(root.user_id);
  return json({
    success: true,
    root: { id: root.id, title: root.title },
    owner_name: owner ? (owner.nickname || owner.username) : '',
    today: todayCN(),
    todos: rows
  });
}

/** POST /api/public/todo/:token  免密添加子任务（挂到该顶层任务或其子任务下）
 * body: { title, parent_id?, priority?, due_date?, category? }
 * parent_id 缺省则挂到顶层任务下；若指定必须属于该子树
 * child_due 新模式下子任务可自带截止日期/重复(新建即为叶子); 旧模式日期继承主任务
 */
async function publicAddTodo({ request, env, params }) {
  const storage = getStorage(env);
  const root = await storage.todo.findByShareToken(params.token);
  if (!root) return error('链接无效或已失效', 404);
  const body = await request.json().catch(() => ({}));
  const title = (body.title || '').trim();
  if (!title) return error('请填写任务标题');

  // 子树内合法 id 集合（含 root），校验 parent 归属，防越权挂载
  const subtree = await storage.todo.listSubtree(root.id);
  const allowIds = new Set(subtree.map(r => r.id));
  let parentId = root.id;
  let parentRow = root;
  if (body.parent_id != null && body.parent_id !== '') {
    parentId = parseInt(body.parent_id, 10);
    if (!allowIds.has(parentId)) return error('父任务不属于此清单', 400);
    parentRow = await storage.todo.findById(parentId);
  }
  const childDueMode = !!root.child_due;
  // 新模式子任务可自带日期; 旧模式日期继承主任务不单独存
  const dueDate = childDueMode ? ((body.due_date || '').trim() || null) : null;
  // 新模式下新建叶子可重复; 若给带重复的叶子任务添加首个子任务, 建后清其重复
  const recFields = readRecurFields(body, childDueMode);
  const parentWasLeaf = (await storage.todo.collectDescendantIds(parentId)).length === 0;
  const id = await storage.todo.create(root.user_id, {
    parent_id: parentId, title,
    priority: normPriority(body.priority),
    due_date: dueDate,
    category: (body.category || '').trim() || null,
    note: (body.note || '').trim() || null,
    recurrence: recFields.recurrence,
    recur_interval: recFields.recur_interval,
    recur_nth: recFields.recur_nth,
    recur_weekday: recFields.recur_weekday,
    // 该免密链接对应共享分类下任务时, 匿名添加同样归入分类(shared_cat_id); created_by 为 NULL(匿名)
    shared_cat_id: root.shared_cat_id != null ? root.shared_cat_id : null,
    created_by: null
  });
  if (childDueMode && parentWasLeaf && parentRow && parentRow.recurrence) {
    await storage.todo.clearRecur(parentId);
  }
  return json({ success: true, message: '已添加', id });
}

/** PUT /api/public/todo/:token/:id/done  免密勾选当前任务，校验目标属该子树
 * body: { done }
 */
async function publicToggleTodo({ request, env, params }) {
  const storage = getStorage(env);
  const root = await storage.todo.findByShareToken(params.token);
  if (!root) return error('链接无效或已失效', 404);
  const body = await request.json().catch(() => ({}));
  const done = !!body.done;

  const id = parseInt(params.id, 10);
  const subtree = await storage.todo.listSubtree(root.id);
  const allowIds = new Set(subtree.map(r => r.id));
  if (!allowIds.has(id)) return error('任务不属于此清单', 400);
  // 免密页永远用默认(旧+周期); 不接受 jumpToCurrent 参数; done_by 为 NULL(匿名操作)
  const r = await storage.todo.markDoneWithRecur(id, root.user_id, done, false, todayCN(), null);
  // 偏好开启时(偏好跟随链接 owner): 勾选则逐级自动完成父任务; 取消则恢复已完成的祖先
  if (await autoParentOn(storage, root.user_id)) {
    if (done) await storage.todo.autoCompleteAncestors(id, root.user_id, todayCN(), null);
    else await storage.todo.reopenAncestors(id, root.user_id);
  }
  return json({ success: true, message: done ? '已完成' : '已取消完成', cloned: !!r.cloned, next_id: r.next_id || null, next_due: r.next_due || null });
}

/** PUT /api/public/todo/:token/:id  免密编辑任务，校验目标属该子树
 * body: { title, priority?, due_date?, category?, note? }
 * 旧模式: 仅清单根任务可改 due_date/重复, 子任务日期继承主任务;
 * child_due 新模式: 根任务不设日期, 子任务(叶子)可改各自日期/重复;
 * 协作链接不允许切换 child_due 模式(仅清单所有者可在登录态/汇总页切换)
 */
async function publicUpdateTodo({ request, env, params }) {
  const storage = getStorage(env);
  const root = await storage.todo.findByShareToken(params.token);
  if (!root) return error('链接无效或已失效', 404);
  const body = await request.json().catch(() => ({}));
  const title = (body.title || '').trim();
  if (!title) return error('请填写任务标题');

  const id = parseInt(params.id, 10);
  const subtree = await storage.todo.listSubtree(root.id);
  const allowIds = new Set(subtree.map(r => r.id));
  if (!allowIds.has(id)) return error('任务不属于此清单', 400);
  const isRoot = id === root.id;
  const childDueMode = !!root.child_due;
  let dueDate, allowRecur;
  if (isRoot) {
    // 新模式主任务不设日期; 旧模式主任务可设日期与重复
    dueDate = childDueMode ? null : ((body.due_date || '').trim() || null);
    allowRecur = !childDueMode;
  } else {
    // 新模式子任务可各自设日期; 仅叶子子任务可重复
    dueDate = childDueMode ? ((body.due_date || '').trim() || null) : null;
    const hasKids = subtree.some(r => r.parent_id === id);
    allowRecur = childDueMode && !hasKids;
  }
  const payload = {
    title,
    priority: normPriority(body.priority),
    due_date: dueDate,
    category: (body.category || '').trim() || null,
    note: (body.note || '').trim() || null
  };
  if (Object.prototype.hasOwnProperty.call(body, 'recurrence')) {
    const recFields = readRecurFields(body, allowRecur);
    payload.recurrence = recFields.recurrence;
    payload.recur_interval = recFields.recur_interval;
    payload.recur_nth = recFields.recur_nth;
    payload.recur_weekday = recFields.recur_weekday;
  }
  await storage.todo.update(id, root.user_id, payload);
  return json({ success: true, message: '任务已更新' });
}

/** GET /api/public/todo-report/:token  免密报告查看：该用户全部待办
 * token 优先匹配 push_config(module=todo).report_token，回退顶层任务 share_token
 */
async function publicTodoReport({ env, params }) {
  const storage = getStorage(env);
  let userId = null;
  const pushRow = await storage.push.findByReportToken(params.token);
  if (pushRow && pushRow.module === 'todo') {
    userId = pushRow.user_id;
  } else {
    const root = await storage.todo.findByShareToken(params.token);
    if (root) userId = root.user_id;
  }
  if (userId == null) return error('链接无效或已失效', 404);

  await storage.users.updateLastPublic(userId);
  // 免密报告为个人口径: 不含共享分类任务(匿名链接不泄露家庭共享数据)
  const rows = await storage.todo.listPersonalByUser(userId);
  const owner = await storage.users.findById(userId);
  return json({
    success: true,
    owner_name: owner ? (owner.nickname || owner.username) : '',
    today: todayCN(),
    todos: rows,
    stats: countStats(rows, todayCN())
  });
}

/** GET /api/public/todo-chart/:token?range=  免密图表数据
 * token 匹配 push_config(module=todo).report_token → 统计该用户全部任务；
 * 否则匹配顶层任务 share_token → 仅统计该清单子树。默认 7d
 */
async function publicTodoChart({ env, params, url }) {
  const storage = getStorage(env);
  const range = CHART_RANGES[url.searchParams.get('range')] ? url.searchParams.get('range') : '7d';
  let raw = null;
  const pushRow = await storage.push.findByReportToken(params.token);
  if (pushRow && pushRow.module === 'todo') {
    raw = await storage.todo.chartRaw(pushRow.user_id);
  } else {
    const root = await storage.todo.findByShareToken(params.token);
    if (!root) return error('链接无效或已失效', 404);
    const subtree = await storage.todo.listSubtree(root.id);
    raw = await storage.todo.chartRaw(root.user_id, 8, subtree.map(r => r.id));
  }
  const series = buildChartSeries(raw, range, todayCN());
  return json({ success: true, series });
}

/** 小组件响应体构造（鉴权方式由调用方决定）。scope/limit 解析与公开/登录两口径一致。
 *  scopePersonal=true(report_token 免密): 仅个人任务; false(登录态 Cookie): 含共享分类 */
async function buildWidgetPayload(storage, userId, url, touchLastPublic, scopePersonal) {
  const scopeRaw = url.searchParams.get('scope');
  const scope = (scopeRaw === 'today' || scopeRaw === 'overdue' || scopeRaw === 'all') ? scopeRaw : 'cur';
  let limit = parseInt(url.searchParams.get('limit') || '20', 10);
  if (!isFinite(limit)) limit = 20;
  limit = Math.max(1, Math.min(50, limit));

  if (touchLastPublic) await storage.users.updateLastPublic(userId);
  const rows = scopePersonal
    ? await storage.todo.listPersonalByUser(userId)
    : await storage.todo.listVisibleForUser(userId);
  const owner = await storage.users.findById(userId);
  const today = todayCN();
  return {
    success: true,
    owner_name: owner ? (owner.nickname || owner.username) : '',
    today,
    stats: countStats(rows, today),
    groups: buildWidgetGroups(rows, today, scope, limit)
  };
}

/** GET /api/public/todo-widget/:token?scope=&limit=  小组件专用：轻量「顶层分组」数据
 * scope ∈ cur(默认,今日+逾期)|today|overdue|all；limit 默认 20，clamp [1,50]
 * 仅接受 module=todo 的 report_token（与 todo-all 汇总页同口径），不接受单清单 share_token
 */
async function widgetTodo({ env, params, url }) {
  const storage = getStorage(env);
  const userId = await resolveUserByReportToken(storage, params.token);
  if (userId == null) return error('链接无效或已失效', 404);
  return json(await buildWidgetPayload(storage, userId, url, true, true));
}

/** GET /api/todo-widget?scope=&limit=  登录态小组件数据：复用 App 会话 Cookie（sid），无需 report_token */
async function widgetTodoAuth({ request, env, url }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  return json(await buildWidgetPayload(storage, auth.user_id, url, false, false));
}

// ==================== 免密汇总协作（用户级 report_token，跨全部清单可写） ====================

/** 由 report_token 解析用户 id（module=todo），无效返回 null */
async function resolveUserByReportToken(storage, token) {
  const pushRow = await storage.push.findByReportToken(token);
  if (pushRow && pushRow.module === 'todo') return pushRow.user_id;
  return null;
}

/** POST /api/public/todo-all/:token  免密汇总页添加任务
 * body: { title, parent_id?, priority?, due_date?, category?, note?, child_due? }
 * parent_id 缺省则新建顶层清单(旧模式可设 due_date, 或带 child_due 开新模式)；
 * 指定则须属该用户，作为其子任务(child_due 新模式下可自带日期/重复)
 */
async function publicAllAdd({ request, env, params }) {
  const storage = getStorage(env);
  const userId = await resolveUserByReportToken(storage, params.token);
  if (userId == null) return error('链接无效或已失效', 404);
  const body = await request.json().catch(() => ({}));
  const title = (body.title || '').trim();
  if (!title) return error('请填写任务标题');

  let parentId = null;
  let parentRow = null;
  let rootRow = null;
  if (body.parent_id != null && body.parent_id !== '') {
    parentId = parseInt(body.parent_id, 10);
    parentRow = await storage.todo.findById(parentId);
    if (!parentRow || parentRow.user_id !== userId) return error('父任务不属于此清单', 400);
    if (parentRow.shared_cat_id != null) return error('该任务属共享分类，请登录后在待办页操作', 400);
    rootRow = await rootRowOf(storage, parentRow);
  }
  const childDue = parentId == null ? !!body.child_due : false;
  const childDueMode = parentId != null ? !!rootRow.child_due : childDue;
  // 截止日期: 旧模式仅顶层可设; 新模式顶层不设, 子任务可各自设置
  const dueDate = parentId == null
    ? (childDue ? null : ((body.due_date || '').trim() || null))
    : (childDueMode ? ((body.due_date || '').trim() || null) : null);
  const recFields = readRecurFields(body, parentId == null ? !childDue : childDueMode);
  const parentWasLeaf = parentRow ? (await storage.todo.collectDescendantIds(parentId)).length === 0 : false;
  const id = await storage.todo.create(userId, {
    parent_id: parentId, title,
    priority: normPriority(body.priority),
    due_date: dueDate,
    category: (body.category || '').trim() || null,
    note: (body.note || '').trim() || null,
    child_due: childDue ? 1 : 0,
    recurrence: recFields.recurrence,
    recur_interval: recFields.recur_interval,
    recur_nth: recFields.recur_nth,
    recur_weekday: recFields.recur_weekday,
    // 免密汇总页新建恒为个人任务(共享分类请登录后操作); 匿名 created_by 为 NULL
    shared_cat_id: null,
    created_by: null
  });
  if (childDueMode && parentWasLeaf && parentRow && parentRow.recurrence) {
    await storage.todo.clearRecur(parentId);
  }
  return json({ success: true, message: '已添加', id });
}

/** PUT /api/public/todo-all/:token/:id/done  免密汇总页勾选当前任务，校验任务属该用户
 * body: { done }
 */
async function publicAllToggle({ request, env, params }) {
  const storage = getStorage(env);
  const userId = await resolveUserByReportToken(storage, params.token);
  if (userId == null) return error('链接无效或已失效', 404);
  const body = await request.json().catch(() => ({}));
  const done = !!body.done;

  const id = parseInt(params.id, 10);
  const t = await storage.todo.findById(id);
  if (!t || t.user_id !== userId) return error('任务不存在', 404);
  if (t.shared_cat_id != null) return error('该任务属共享分类，请登录后在待办页操作', 400);
  // 免密汇总页永远用默认(旧+周期); done_by 为 NULL(匿名操作)
  const r = await storage.todo.markDoneWithRecur(id, userId, done, false, todayCN(), null);
  // 偏好开启时(偏好跟随数据 owner): 勾选则逐级自动完成父任务; 取消则恢复已完成的祖先
  if (await autoParentOn(storage, userId)) {
    if (done) await storage.todo.autoCompleteAncestors(id, userId, todayCN(), null);
    else await storage.todo.reopenAncestors(id, userId);
  }
  return json({ success: true, message: done ? '已完成' : '已取消完成', cloned: !!r.cloned, next_id: r.next_id || null, next_due: r.next_due || null });
}

/** PUT /api/public/todo-all/:token/:id  免密汇总页编辑，校验任务属该用户
 * body: { title, priority?, due_date?, category?, note?, child_due? }
 * 旧模式仅顶层任务可改 due_date/重复; child_due 新模式顶层不设日期, 子任务(叶子)可各自设置;
 * 汇总页为用户级 token(所有者本人使用), 允许顶层切换 child_due 模式
 */
async function publicAllUpdate({ request, env, params }) {
  const storage = getStorage(env);
  const userId = await resolveUserByReportToken(storage, params.token);
  if (userId == null) return error('链接无效或已失效', 404);
  const body = await request.json().catch(() => ({}));
  const title = (body.title || '').trim();
  if (!title) return error('请填写任务标题');

  const id = parseInt(params.id, 10);
  const t = await storage.todo.findById(id);
  if (!t || t.user_id !== userId) return error('任务不存在', 404);
  if (t.shared_cat_id != null) return error('该任务属共享分类，请登录后在待办页操作', 400);
  const isRoot = t.parent_id == null;
  const rootRow = isRoot ? t : await rootRowOf(storage, t);

  let childDue = !!rootRow.child_due;
  if (isRoot && Object.prototype.hasOwnProperty.call(body, 'child_due')) {
    const want = !!body.child_due;
    if (want && !childDue) childDue = true;
    else if (!want && childDue) {
      childDue = false;
      await storage.todo.clearSubtreeDates(id);
    }
  }
  const childDueMode = isRoot ? childDue : !!rootRow.child_due;
  const dueDate = isRoot
    ? (childDue ? null : ((body.due_date || '').trim() || null))
    : (childDueMode ? ((body.due_date || '').trim() || null) : null);
  let allowRecur;
  if (isRoot) allowRecur = !childDue;
  else {
    const descendants = await storage.todo.collectDescendantIds(id);
    allowRecur = childDueMode && descendants.length === 0;
  }
  const payload = {
    title,
    priority: normPriority(body.priority),
    due_date: dueDate,
    category: (body.category || '').trim() || null,
    note: (body.note || '').trim() || null
  };
  if (isRoot) payload.child_due = childDue ? 1 : 0;
  if (Object.prototype.hasOwnProperty.call(body, 'recurrence') || (isRoot && childDue)) {
    const recFields = readRecurFields(body, allowRecur);
    payload.recurrence = recFields.recurrence;
    payload.recur_interval = recFields.recur_interval;
    payload.recur_nth = recFields.recur_nth;
    payload.recur_weekday = recFields.recur_weekday;
  }
  await storage.todo.update(id, userId, payload);
  return json({ success: true, message: '任务已更新' });
}

/** PUT /api/public/todo/:token/reorder  免密单清单页子任务同级重排  body: { parent_id, ids:[...] }
 * 校验 ids 与 parent 都属该 share_token 对应的子树，再批量写 sort_order
 */
async function publicReorder({ request, env, params }) {
  const storage = getStorage(env);
  const root = await storage.todo.findByShareToken(params.token);
  if (!root) return error('链接无效或已失效', 404);
  const body = await request.json().catch(() => ({}));
  const parentId = body.parent_id != null && body.parent_id !== '' ? parseInt(body.parent_id, 10) : null;
  const ids = Array.isArray(body.ids) ? body.ids.map(v => parseInt(v, 10)).filter(n => !isNaN(n)) : [];
  if (ids.length === 0) return error('缺少排序列表');

  const subtree = await storage.todo.listSubtree(root.id);
  const allowIds = new Set(subtree.map(r => r.id));
  // parent 必须在子树内(允许等于 root.id, 即对 root 的直接子任务排序)
  if (parentId == null || !allowIds.has(parentId)) return error('父任务不属于此清单', 400);
  for (const id of ids) {
    const t = await storage.todo.findById(id);
    if (!t || !allowIds.has(id)) return error('任务不属于此清单', 404);
    const tp = t.parent_id != null ? t.parent_id : null;
    if (tp !== parentId) return error('存在跨层级的任务，无法排序', 400);
  }
  await storage.todo.reorder(root.user_id, parentId, ids);
  return json({ success: true, message: '顺序已更新' });
}

/** PUT /api/public/todo-all/:token/reorder  免密汇总页子任务同级重排  body: { parent_id, ids:[...] }
 * 校验 ids 全属该用户且 parent_id 与 body 一致，再批量写 sort_order
 */
async function publicAllReorder({ request, env, params }) {
  const storage = getStorage(env);
  const userId = await resolveUserByReportToken(storage, params.token);
  if (userId == null) return error('链接无效或已失效', 404);
  const body = await request.json().catch(() => ({}));
  const parentId = body.parent_id != null && body.parent_id !== '' ? parseInt(body.parent_id, 10) : null;
  const ids = Array.isArray(body.ids) ? body.ids.map(v => parseInt(v, 10)).filter(n => !isNaN(n)) : [];
  if (ids.length === 0) return error('缺少排序列表');

  for (const id of ids) {
    const t = await storage.todo.findById(id);
    if (!t || t.user_id !== userId) return error('任务不存在', 404);
    if (t.shared_cat_id != null) return error('该任务属共享分类，请登录后在待办页操作', 400);
    const tp = t.parent_id != null ? t.parent_id : null;
    if (tp !== parentId) return error('存在跨层级的任务，无法排序', 400);
  }
  await storage.todo.reorder(userId, parentId, ids);
  return json({ success: true, message: '顺序已更新' });
}

export {
  listTodos, createTodo, updateTodo, toggleTodo, removeTodo, deleteCategory, renameCategory, getShareLink, todoChart, reorderTodo,
  publicTodoInfo, publicAddTodo, publicToggleTodo, publicUpdateTodo, publicReorder, publicTodoReport, publicTodoChart,
  widgetTodo, widgetTodoAuth,
  publicAllAdd, publicAllToggle, publicAllUpdate, publicAllReorder
};
