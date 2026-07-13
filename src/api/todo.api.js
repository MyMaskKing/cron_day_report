/**
 * 待办 API
 * 任务 CRUD（无限嵌套子任务）、勾选（父任务级联子树）、免密协作填写、免密报告查看
 */

import { json, error } from '../router.js';
import { getStorage } from '../storage/adapter.js';
import { requireAuth } from '../auth/middleware.js';
import { generateToken } from '../auth/password.js';
import { resolveBaseUrl } from '../config.js';
import { countStats, buildChartSeries, CHART_RANGES } from '../services/todo.service.js';

/** 取北京时区当天 YYYY-MM-DD */
function todayCN() {
  const now = new Date(Date.now() + 8 * 3600 * 1000); // UTC+8
  return now.toISOString().slice(0, 10);
}

/** 规范化优先级为 0/1/2，非法回退 1 */
function normPriority(v) {
  const n = parseInt(v, 10);
  return (n === 0 || n === 1 || n === 2) ? n : 1;
}

// ==================== 登录态 CRUD ====================

/** GET /api/todo/list  当前用户全部待办（扁平行）+ 统计概览 */
async function listTodos({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const rows = await storage.todo.listByUser(auth.user_id);
  const stats = countStats(rows, todayCN());
  return json({ success: true, todos: rows, stats });
}

/** POST /api/todo  新建任务  body: { parent_id?, title, priority?, due_date?, category? } */
async function createTodo({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  const title = (body.title || '').trim();
  if (!title) return error('请填写任务标题');

  const storage = getStorage(env);
  let parentId = null;
  if (body.parent_id != null && body.parent_id !== '') {
    parentId = parseInt(body.parent_id, 10);
    const parent = await storage.todo.findById(parentId);
    if (!parent || parent.user_id !== auth.user_id) return error('父任务不存在', 404);
  }
  // 子任务日期继承主任务，不单独存日期；仅顶层任务可设 due_date
  const dueDate = parentId != null ? null : ((body.due_date || '').trim() || null);
  // 重复周期: 仅顶层任务允许, 值须在白名单内
  const REC = ['daily', 'weekly', 'monthly', 'yearly'];
  const rec = (parentId == null && body.recurrence && REC.includes(body.recurrence)) ? body.recurrence : null;
  const id = await storage.todo.create(auth.user_id, {
    parent_id: parentId, title,
    priority: normPriority(body.priority),
    due_date: dueDate,
    category: (body.category || '').trim() || null,
    note: (body.note || '').trim() || null,
    recurrence: rec
  });
  return json({ success: true, message: '任务已添加', id });
}

/** PUT /api/todo/:id  修改任务  body: { title, priority?, due_date?, category? } */
async function updateTodo({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  const title = (body.title || '').trim();
  if (!title) return error('请填写任务标题');

  const storage = getStorage(env);
  const id = parseInt(params.id, 10);
  const t = await storage.todo.findById(id);
  if (!t || t.user_id !== auth.user_id) return error('任务不存在', 404);
  // 子任务日期继承主任务，不单独存日期；仅顶层任务可设 due_date
  const dueDate = t.parent_id != null ? null : ((body.due_date || '').trim() || null);
  // 重复周期: 仅顶层任务允许; body.recurrence 显式为空字符串或 null 时清空; 未传则不改动
  const REC = ['daily', 'weekly', 'monthly', 'yearly'];
  const payload = {
    title,
    priority: normPriority(body.priority),
    due_date: dueDate,
    category: (body.category || '').trim() || null,
    note: (body.note || '').trim() || null
  };
  if (Object.prototype.hasOwnProperty.call(body, 'recurrence')) {
    payload.recurrence = (t.parent_id == null && body.recurrence && REC.includes(body.recurrence)) ? body.recurrence : null;
  }
  await storage.todo.update(id, auth.user_id, payload);
  return json({ success: true, message: '任务已更新' });
}

/** PUT /api/todo/:id/done  勾选/取消完成  body: { done }
 * 勾选父任务连带其全部子任务一起置为该状态（级联）
 */
async function toggleTodo({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  const done = !!body.done;
  const jumpToCurrent = !!body.jumpToCurrent;

  const storage = getStorage(env);
  const id = parseInt(params.id, 10);
  const t = await storage.todo.findById(id);
  if (!t || t.user_id !== auth.user_id) return error('任务不存在', 404);
  const r = await storage.todo.markDoneWithRecur(id, auth.user_id, done, jumpToCurrent, todayCN());
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
  // 逐个校验归属与同父，防越权/跨级
  for (const id of ids) {
    const t = await storage.todo.findById(id);
    if (!t || t.user_id !== auth.user_id) return error('任务不存在', 404);
    const tp = t.parent_id != null ? t.parent_id : null;
    if (tp !== parentId) return error('存在跨层级的任务，无法排序', 400);
  }
  await storage.todo.reorder(auth.user_id, parentId, ids);
  return json({ success: true, message: '顺序已更新' });
}

/** DELETE /api/todo/:id  删除任务（级联删除全部子任务） */
async function removeTodo({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const id = parseInt(params.id, 10);
  const t = await storage.todo.findById(id);
  if (!t || t.user_id !== auth.user_id) return error('任务不存在', 404);
  const descendants = await storage.todo.collectDescendantIds(id);
  await storage.todo.remove([id, ...descendants]);
  return json({ success: true, message: '任务已删除' });
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
  const range = CHART_RANGES[url.searchParams.get('range')] ? url.searchParams.get('range') : '7d';
  const raw = await storage.todo.chartRaw(auth.user_id);
  const series = buildChartSeries(raw, range, todayCN());
  return json({ success: true, series });
}

// ==================== 免密公开 ====================

/** GET /api/public/todo/:token  免密查看某顶层任务子树 */
async function publicTodoInfo({ env, params }) {
  const storage = getStorage(env);
  const root = await storage.todo.findByShareToken(params.token);
  if (!root) return error('链接无效或已失效', 404);
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
  if (body.parent_id != null && body.parent_id !== '') {
    parentId = parseInt(body.parent_id, 10);
    if (!allowIds.has(parentId)) return error('父任务不属于此清单', 400);
  }
  // 免密添加的任务均为某任务的子任务（挂在 root 或其后代下），日期继承主任务，不单独存
  const id = await storage.todo.create(root.user_id, {
    parent_id: parentId, title,
    priority: normPriority(body.priority),
    due_date: null,
    category: (body.category || '').trim() || null,
    note: (body.note || '').trim() || null
  });
  return json({ success: true, message: '已添加', id });
}

/** PUT /api/public/todo/:token/:id/done  免密勾选（级联子树），校验目标属该子树
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
  // 免密页永远用默认(旧+周期); 不接受 jumpToCurrent 参数
  const r = await storage.todo.markDoneWithRecur(id, root.user_id, done, false, todayCN());
  return json({ success: true, message: done ? '已完成' : '已取消完成', cloned: !!r.cloned, next_id: r.next_id || null, next_due: r.next_due || null });
}

/** PUT /api/public/todo/:token/:id  免密编辑任务，校验目标属该子树
 * body: { title, priority?, due_date?, category?, note? }
 * 仅该清单根任务(id===root.id)可改 due_date，其余为子任务日期继承主任务
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
  // 仅清单根任务是顶层，可设截止日期；其余子任务日期继承主任务
  const dueDate = id === root.id ? ((body.due_date || '').trim() || null) : null;
  const REC = ['daily', 'weekly', 'monthly', 'yearly'];
  const payload = {
    title,
    priority: normPriority(body.priority),
    due_date: dueDate,
    category: (body.category || '').trim() || null,
    note: (body.note || '').trim() || null
  };
  if (id === root.id && Object.prototype.hasOwnProperty.call(body, 'recurrence')) {
    payload.recurrence = (body.recurrence && REC.includes(body.recurrence)) ? body.recurrence : null;
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

  const rows = await storage.todo.listByUser(userId);
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

// ==================== 免密汇总协作（用户级 report_token，跨全部清单可写） ====================

/** 由 report_token 解析用户 id（module=todo），无效返回 null */
async function resolveUserByReportToken(storage, token) {
  const pushRow = await storage.push.findByReportToken(token);
  if (pushRow && pushRow.module === 'todo') return pushRow.user_id;
  return null;
}

/** POST /api/public/todo-all/:token  免密汇总页添加任务
 * body: { title, parent_id?, priority?, due_date?, category?, note? }
 * parent_id 缺省则新建顶层清单(可设 due_date)；指定则须属该用户，作为其子任务(日期继承)
 */
async function publicAllAdd({ request, env, params }) {
  const storage = getStorage(env);
  const userId = await resolveUserByReportToken(storage, params.token);
  if (userId == null) return error('链接无效或已失效', 404);
  const body = await request.json().catch(() => ({}));
  const title = (body.title || '').trim();
  if (!title) return error('请填写任务标题');

  let parentId = null;
  if (body.parent_id != null && body.parent_id !== '') {
    parentId = parseInt(body.parent_id, 10);
    const parent = await storage.todo.findById(parentId);
    if (!parent || parent.user_id !== userId) return error('父任务不属于此清单', 400);
  }
  // 顶层可设截止日期；子任务日期继承主任务，不单独存
  const dueDate = parentId != null ? null : ((body.due_date || '').trim() || null);
  const id = await storage.todo.create(userId, {
    parent_id: parentId, title,
    priority: normPriority(body.priority),
    due_date: dueDate,
    category: (body.category || '').trim() || null,
    note: (body.note || '').trim() || null
  });
  return json({ success: true, message: '已添加', id });
}

/** PUT /api/public/todo-all/:token/:id/done  免密汇总页勾选（级联子树），校验任务属该用户
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
  // 免密汇总页永远用默认(旧+周期)
  const r = await storage.todo.markDoneWithRecur(id, userId, done, false, todayCN());
  return json({ success: true, message: done ? '已完成' : '已取消完成', cloned: !!r.cloned, next_id: r.next_id || null, next_due: r.next_due || null });
}

/** PUT /api/public/todo-all/:token/:id  免密汇总页编辑，校验任务属该用户
 * body: { title, priority?, due_date?, category?, note? }
 * 仅顶层任务(parent_id 为空)可改 due_date，子任务日期继承主任务
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
  const dueDate = t.parent_id != null ? null : ((body.due_date || '').trim() || null);
  const REC = ['daily', 'weekly', 'monthly', 'yearly'];
  const payload = {
    title,
    priority: normPriority(body.priority),
    due_date: dueDate,
    category: (body.category || '').trim() || null,
    note: (body.note || '').trim() || null
  };
  if (t.parent_id == null && Object.prototype.hasOwnProperty.call(body, 'recurrence')) {
    payload.recurrence = (body.recurrence && REC.includes(body.recurrence)) ? body.recurrence : null;
  }
  await storage.todo.update(id, userId, payload);
  return json({ success: true, message: '任务已更新' });
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
    const tp = t.parent_id != null ? t.parent_id : null;
    if (tp !== parentId) return error('存在跨层级的任务，无法排序', 400);
  }
  await storage.todo.reorder(userId, parentId, ids);
  return json({ success: true, message: '顺序已更新' });
}

export {
  listTodos, createTodo, updateTodo, toggleTodo, removeTodo, getShareLink, todoChart, reorderTodo,
  publicTodoInfo, publicAddTodo, publicToggleTodo, publicUpdateTodo, publicTodoReport, publicTodoChart,
  publicAllAdd, publicAllToggle, publicAllUpdate, publicAllReorder
};
