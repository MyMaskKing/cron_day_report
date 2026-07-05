/**
 * 通知渠道 API（当前登录用户）
 * 渠道用于监控任务/基金日报的消息推送
 */

import { json, error } from '../router.js';
import { getStorage } from '../storage/adapter.js';
import { requireAuth } from '../auth/middleware.js';

const VALID_TYPES = ['wechat', 'webhook', 'email'];

/** 校验渠道字段 */
function validateChannel(c) {
  if (!c.name || typeof c.name !== 'string') return '请填写渠道名称';
  if (!VALID_TYPES.includes(c.type)) return '渠道类型非法';
  if (!c.url || !/^https?:\/\//.test(c.url)) return '请填写合法的 URL';
  if (c.headers_json) {
    try { JSON.parse(c.headers_json); } catch { return 'headers_json 不是合法 JSON'; }
  }
  return null;
}

/** GET /api/notify/channels  列出当前用户渠道 */
async function listChannels({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const channels = await storage.notify.listByUser(auth.user_id);
  return json({ success: true, channels });
}

/** POST /api/notify/channels  新建渠道 */
async function createChannel({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  const invalid = validateChannel(body);
  if (invalid) return error(invalid);

  const storage = getStorage(env);
  const id = await storage.notify.create(auth.user_id, body);
  return json({ success: true, message: '渠道已创建', id });
}

/** PUT /api/notify/channels/:id  更新渠道 */
async function updateChannel({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  const invalid = validateChannel(body);
  if (invalid) return error(invalid);

  const storage = getStorage(env);
  const id = parseInt(params.id, 10);
  const existing = await storage.notify.findById(id);
  if (!existing || existing.user_id !== auth.user_id) return error('渠道不存在', 404);

  await storage.notify.update(id, auth.user_id, body);
  return json({ success: true, message: '渠道已更新' });
}

/** DELETE /api/notify/channels/:id  删除渠道 */
async function removeChannel({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const id = parseInt(params.id, 10);
  const existing = await storage.notify.findById(id);
  if (!existing || existing.user_id !== auth.user_id) return error('渠道不存在', 404);

  await storage.notify.remove(id, auth.user_id);
  return json({ success: true, message: '渠道已删除' });
}

export { listChannels, createChannel, updateChannel, removeChannel };
