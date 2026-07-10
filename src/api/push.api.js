/**
 * 推送配置 API（通用，供 fund/weight/asset 模块共用）
 * 每个用户每个模块一条配置：渠道 + 格式 + 启用 + 时间(hour/day)
 */

import { json, error } from '../router.js';
import { getStorage } from '../storage/adapter.js';
import { requireAuth, requireAdmin } from '../auth/middleware.js';
import { ALLOWED_FORMATS } from '../config.js';

const MODULES = ['fund', 'weight', 'asset', 'monitor', 'todo'];
// 可重置免密链接的业务模块（monitor 无免密链接）
const SHARE_MODULES = ['fund', 'weight', 'asset', 'todo'];

/** 清空某用户某模块的全部免密 token（各 share_token + 报告 report_token），旧链接立即失效 */
async function resetModuleTokens(storage, userId, module) {
  if (module === 'fund') await storage.fund.clearShareTokens(userId);
  else if (module === 'weight') await storage.weight.clearShareTokens(userId);
  else if (module === 'asset') await storage.asset.clearShareTokens(userId);
  else if (module === 'todo') await storage.todo.clearShareTokens(userId);
  await storage.push.clearReportToken(userId, module);
}

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
    monitor: { hours: [6], days: [1] },
    todo: { hours: [9], days: [1] }
  };
  function toArr(str, fallback) {
    if (str == null || str === '') return fallback;
    return String(str).split(',').map(s => parseInt(s, 10)).filter(n => !isNaN(n));
  }
  const config = cfg ? {
    channel_id: cfg.channel_id,
    channel_ids: toArr(cfg.channel_ids != null ? cfg.channel_ids : cfg.channel_id, []),
    format: cfg.format, enabled: cfg.enabled,
    hours: toArr(cfg.hours != null ? cfg.hours : cfg.hour, defaults[params.module].hours),
    days: toArr(cfg.days != null ? cfg.days : cfg.day, defaults[params.module].days)
  } : { channel_id: null, channel_ids: [], format: 'text', enabled: 0, ...defaults[params.module] };
  return json({ success: true, config });
}

/** PUT /api/push/:module  保存某模块推送配置
 * body: { channel_ids[], format, enabled, hours[], days[] }
 */
async function setPushConfig({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  if (!MODULES.includes(params.module)) return error('模块非法', 400);
  const body = await request.json().catch(() => ({}));

  const storage = getStorage(env);
  // 接收 channel_ids 数组或逗号串；兼容旧 channel_id 单值。逐个校验归属当前用户
  let channelIds = Array.isArray(body.channel_ids)
    ? body.channel_ids
    : (typeof body.channel_ids === 'string' ? body.channel_ids.split(',') : []);
  if (!channelIds.length && body.channel_id) channelIds = [body.channel_id];
  channelIds = [...new Set(channelIds.map(x => parseInt(x, 10)).filter(n => !isNaN(n)))];
  for (const cid of channelIds) {
    const ch = await storage.notify.findById(cid);
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

  await storage.push.setConfig(auth.user_id, params.module, {
    channel_ids: channelIds.join(','),
    format: ALLOWED_FORMATS.includes(body.format) ? body.format : 'text',
    enabled: !!body.enabled,
    hours: hours.join(','),
    days: days.join(',')
  });
  return json({ success: true, message: '推送配置已保存' });
}

/** POST /api/share/reset/:module  重置自己该模块的全部免密链接 */
async function resetMyModuleShare({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  if (!SHARE_MODULES.includes(params.module)) return error('模块非法', 400);
  const storage = getStorage(env);
  await resetModuleTokens(storage, auth.user_id, params.module);
  return json({ success: true, message: '该模块免密链接已重置，旧链接已失效' });
}

/** POST /api/admin/share/reset/:module/:userId  超管重置指定用户该模块的全部免密链接 */
async function adminResetModuleShare({ request, env, params }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;
  if (!SHARE_MODULES.includes(params.module)) return error('模块非法', 400);
  const userId = parseInt(params.userId, 10);
  const storage = getStorage(env);
  const u = await storage.users.findById(userId);
  if (!u) return error('用户不存在', 404);
  await resetModuleTokens(storage, userId, params.module);
  return json({ success: true, message: '该用户该模块免密链接已重置' });
}

export { getPushConfig, setPushConfig, resetMyModuleShare, adminResetModuleShare };
