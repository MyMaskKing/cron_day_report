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
  // 默认值：weight 每天10点，asset 每月15号9点，fund 每天15点，monitor 每天6点
  const defaults = {
    fund: { hours: [15], days: [15] },
    weight: { hours: [10], days: [1] },
    asset: { hours: [9], days: [15] },
    monitor: { hours: [6], days: [1] }
  };
  function toArr(str, fallback) {
    if (str == null || str === '') return fallback;
    return String(str).split(',').map(s => parseInt(s, 10)).filter(n => !isNaN(n));
  }
  const config = cfg ? {
    channel_id: cfg.channel_id, format: cfg.format, enabled: cfg.enabled,
    hours: toArr(cfg.hours != null ? cfg.hours : cfg.hour, defaults[params.module].hours),
    days: toArr(cfg.days != null ? cfg.days : cfg.day, defaults[params.module].days)
  } : { channel_id: null, format: 'text', enabled: 0, ...defaults[params.module] };
  return json({ success: true, config });
}

/** PUT /api/push/:module  保存某模块推送配置
 * body: { channel_id, format, enabled, hours[], days[] }
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
  // 接收数组或逗号字符串，规范化去重排序
  function normList(v, min, max, fallback) {
    let arr = Array.isArray(v) ? v : (typeof v === 'string' ? v.split(',') : []);
    arr = arr.map(x => parseInt(x, 10)).filter(n => !isNaN(n) && n >= min && n <= max);
    arr = [...new Set(arr)].sort((a, b) => a - b);
    return arr.length ? arr : fallback;
  }
  const hours = normList(body.hours, 0, 23, [9]);
  const days = normList(body.days, 1, 28, [1]);

  const storage = getStorage(env);
  await storage.push.setConfig(auth.user_id, params.module, {
    channel_id: body.channel_id || null,
    format: body.format === 'html' ? 'html' : 'text',
    enabled: !!body.enabled,
    hours: hours.join(','),
    days: days.join(',')
  });
  return json({ success: true, message: '推送配置已保存' });
}

export { getPushConfig, setPushConfig };
