/**
 * 监控任务 API（当前登录用户）
 * 手动触发执行在 index.js 的 runMyMonitors（保留兼容）
 */

import { json, error } from '../router.js';
import { getStorage } from '../storage/adapter.js';
import { requireAuth } from '../auth/middleware.js';

/** 校验任务字段 */
function validateTask(t) {
  if (!t.name || typeof t.name !== 'string') return '请填写任务名称';
  if (!t.url || !/^https?:\/\//.test(t.url)) return '请填写合法的 URL';
  if (t.return_type && t.return_type !== 'text' && t.return_type !== 'html') return '返回格式非法';
  return null;
}

/** GET /api/monitor/tasks  列出当前用户任务 */
async function listTasks({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const tasks = await storage.monitor.listByUser(auth.user_id);
  return json({ success: true, tasks });
}

/** POST /api/monitor/tasks  新建任务 */
async function createTask({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  const invalid = validateTask(body);
  if (invalid) return error(invalid);

  const storage = getStorage(env);
  // 若指定渠道，校验归属
  if (body.channel_id) {
    const ch = await storage.notify.findById(parseInt(body.channel_id, 10));
    if (!ch || ch.user_id !== auth.user_id) return error('通知渠道不存在', 400);
  }
  const id = await storage.monitor.create(auth.user_id, body);
  return json({ success: true, message: '任务已创建', id });
}

/** PUT /api/monitor/tasks/:id  更新任务 */
async function updateTask({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  const invalid = validateTask(body);
  if (invalid) return error(invalid);

  const storage = getStorage(env);
  const id = parseInt(params.id, 10);
  const existing = await storage.monitor.findById(id);
  if (!existing || existing.user_id !== auth.user_id) return error('任务不存在', 404);
  if (body.channel_id) {
    const ch = await storage.notify.findById(parseInt(body.channel_id, 10));
    if (!ch || ch.user_id !== auth.user_id) return error('通知渠道不存在', 400);
  }
  await storage.monitor.update(id, auth.user_id, body);
  return json({ success: true, message: '任务已更新' });
}

/** DELETE /api/monitor/tasks/:id  删除任务 */
async function removeTask({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const id = parseInt(params.id, 10);
  const existing = await storage.monitor.findById(id);
  if (!existing || existing.user_id !== auth.user_id) return error('任务不存在', 404);
  await storage.monitor.remove(id, auth.user_id);
  return json({ success: true, message: '任务已删除' });
}

/** GET /api/monitor/tasks/:id/logs  查看任务执行日志 */
async function listTaskLogs({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const id = parseInt(params.id, 10);
  const existing = await storage.monitor.findById(id);
  if (!existing || existing.user_id !== auth.user_id) return error('任务不存在', 404);
  const logs = await storage.monitor.listLogs(id, 50);
  return json({ success: true, logs });
}

export { listTasks, createTask, updateTask, removeTask, listTaskLogs };
