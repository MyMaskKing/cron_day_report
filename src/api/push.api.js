/**
 * 推送配置 API（通用，供 fund/weight/asset 模块共用）
 * 每个用户每个模块一条配置：渠道 + 格式 + 启用 + 时间(hour/day)
 */

import { json, error } from '../router.js';
import { getStorage } from '../storage/adapter.js';
import { requireAuth } from '../auth/middleware.js';

const MODULES = ['fund', 'weight', 'asset', 'monitor'];

/** GET /api/push/:module  读取当前用户某模块推送配置 */
async function getPushConfig({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  if (!MODULES.includes(params.module)) return error('模块非法', 400);
  const storage = getStorage(env);
  const cfg = await storage.push.getConfig(auth.user_id, params.module);
  // 默认值：weight 每天10点，asset 每月15号9点，fund 每天15点
  const defaults = {
    fund: { hour: 15, day: 15 },
    weight: { hour: 10, day: 1 },
    asset: { hour: 9, day: 15 },
    monitor: { hour: 6, day: 1 }
  };
  return json({
    success: true,
    config: cfg || { channel_id: null, format: 'text', enabled: 0, ...defaults[params.module] }
  });
}

/** PUT /api/push/:module  保存某模块推送配置
 * body: { channel_id, format, enabled, hour, day }
 */
async function setPushConfig({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  if (!MODULES.includes(params.module)) return error('模块非法', 400);
  const body = await request.json().catch(() => ({}));

  if (body.channel_id) {
    const storage0 = getStorage(env);
    const ch = await storage0.notify.findById(parseInt(body.channel_id, 10));
    if (!ch || ch.user_id !== auth.user_id) return error('通知渠道不存在', 400);
  }
  const hour = Math.max(0, Math.min(23, parseInt(body.hour, 10) || 0));
  const day = Math.max(1, Math.min(28, parseInt(body.day, 10) || 1));

  const storage = getStorage(env);
  await storage.push.setConfig(auth.user_id, params.module, {
    channel_id: body.channel_id || null,
    format: body.format === 'html' ? 'html' : 'text',
    enabled: !!body.enabled,
    hour, day
  });
  return json({ success: true, message: '推送配置已保存' });
}

export { getPushConfig, setPushConfig };
