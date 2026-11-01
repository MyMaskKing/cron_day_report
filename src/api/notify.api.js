/**
 * 通知渠道 API（当前登录用户）
 * 渠道用于监控任务/基金日报的消息推送
 */

import { json, error } from '../router.js';
import { getStorage } from '../storage/adapter.js';
import { requireAuth } from '../auth/middleware.js';
import { getMailGateway, isValidEmail } from '../services/mail-gateway.service.js';

// sys_email=官方邮件（走超管配置的系统邮件网关，无需用户填 URL）；email=用户自备邮件 webhook
const VALID_TYPES = ['wechat', 'webhook', 'email', 'sys_email'];

/** 校验官方邮件收件人（逗号/分号/空白分隔，去重去空，上限 50） */
function parseSysEmails(raw) {
  const list = [...new Set(
    String(raw || '').split(/[,;\s]+/).map(s => s.trim()).filter(Boolean)
  )];
  if (list.length === 0) return { error: '请填写至少一个收件邮箱' };
  if (list.length > 50) return { error: '收件邮箱不能超过 50 个' };
  const bad = list.find(x => !isValidEmail(x));
  if (bad) return { error: `收件邮箱格式不正确: ${bad}` };
  return { emails: list };
}

/** 官方邮件渠道入库前规整：URL/方法不用用户填，收件人统一序列化进 headers_json.mailto */
function normalizeSysEmail(c) {
  const list = [...new Set(
    String((c.emails || '')).split(/[,;\s]+/).map(s => s.trim()).filter(Boolean)
  )];
  return {
    ...c,
    url: '',
    method: 'POST',
    headers_json: JSON.stringify({ mailto: list.join(';') }),
    body_template: null
  };
}

/** 校验渠道字段（sys_email 不校验 URL，校验收件人） */
function validateChannel(c) {
  if (!c.name || typeof c.name !== 'string') return '请填写渠道名称';
  if (!VALID_TYPES.includes(c.type)) return '渠道类型非法';
  if (c.type === 'sys_email') {
    const r = parseSysEmails(c.emails);
    if (r.error) return r.error;
    return null;
  }
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

/** GET /api/notify/gateway-status  官方邮件网关是否已由超管配置（不泄露配置内容） */
async function gatewayStatus({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const gw = await getMailGateway(getStorage(env));
  return json({ success: true, configured: !!gw.url });
}

/** POST /api/notify/channels  新建渠道 */
async function createChannel({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  const invalid = validateChannel(body);
  if (invalid) return error(invalid);

  const storage = getStorage(env);
  if (body.type === 'sys_email') {
    const gw = await getMailGateway(storage);
    if (!gw.url) return error('官方邮件未配置，请联系管理员配置');
  }
  const payload = body.type === 'sys_email' ? normalizeSysEmail(body) : body;
  const id = await storage.notify.create(auth.user_id, payload);
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

  if (body.type === 'sys_email') {
    const gw = await getMailGateway(storage);
    if (!gw.url) return error('官方邮件未配置，请联系管理员配置');
  }
  const payload = body.type === 'sys_email' ? normalizeSysEmail(body) : body;
  await storage.notify.update(id, auth.user_id, payload);
  return json({ success: true, message: '渠道已更新' });
}

/** PUT /api/notify/channels/:id/status  一键启用/停用渠道
 * body: { enabled: boolean }；只改状态，其余字段沿用现值（复用 notify.update 全字段写入）
 */
async function setChannelStatus({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  const enabled = body.enabled === true || body.enabled === 1;

  const storage = getStorage(env);
  const id = parseInt(params.id, 10);
  const existing = await storage.notify.findById(id);
  if (!existing || existing.user_id !== auth.user_id) return error('渠道不存在', 404);

  await storage.notify.update(id, auth.user_id, {
    name: existing.name, type: existing.type, url: existing.url, method: existing.method,
    headers_json: existing.headers_json, body_template: existing.body_template, enabled
  });
  return json({ success: true, message: enabled ? '渠道已启用' : '渠道已停用', enabled });
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

export { listChannels, gatewayStatus, createChannel, updateChannel, setChannelStatus, removeChannel };
