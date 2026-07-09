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
  const id = await storage.todo.create(auth.user_id, {
    parent_id: parentId, title,
    priority: normPriority(body.priority),
    due_date: dueDate,
    category: (body.category || '').trim() || null,
    note: (body.note || '').trim() || null
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
  await storage.todo.update(id, auth.user_id, {
    title,
    priority: normPriority(body.priority),
    due_date: dueDate,
    category: (body.category || '').trim() || null,
    note: (body.note || '').trim() || null
  });
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

  const storage = getStorage(env);
  const id = parseInt(params.id, 10);
  const t = await storage.todo.findById(id);
  if (!t || t.user_id !== auth.user_id) return error('任务不存在', 404);
  const descendants = await storage.todo.collectDescendantIds(id);
  await storage.todo.setDone([id, ...descendants], done, todayCN());
  return json({ success: true, message: done ? '已完成' : '已取消完成' });
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
  if (!token) {
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
  const descendants = await storage.todo.collectDescendantIds(id);
  await storage.todo.setDone([id, ...descendants], done, todayCN());
  return json({ success: true, message: done ? '已完成' : '已取消完成' });
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

export {
  listTodos, createTodo, updateTodo, toggleTodo, removeTodo, getShareLink, todoChart,
  publicTodoInfo, publicAddTodo, publicToggleTodo, publicTodoReport, publicTodoChart
};
