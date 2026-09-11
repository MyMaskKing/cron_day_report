/**
 * 用户管理 API（超管专用）
 * 列出所有用户、查看指定用户各模块数据、改角色/禁用状态
 */

import { json, error } from '../router.js';
import { getStorage } from '../storage/adapter.js';
import { requireAdmin } from '../auth/middleware.js';
import { hashPassword } from '../auth/password.js';
import { getTokenFromRequest, getSession, impersonate, stopImpersonate } from '../auth/session.js';
import { parseOffset, DEFAULT_TZ_OFFSET } from '../services/time.service.js';

const DEFAULT_PASSWORD = '123456';

/**
 * GET /api/admin/users  列出所有用户
 */
async function listUsers({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;

  const storage = getStorage(env);
  const users = await storage.users.list();
  return json({ success: true, users });
}

/**
 * GET /api/admin/users/:id  查看指定用户的汇总数据
 */
async function getUserDetail({ request, env, params }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;

  const storage = getStorage(env);
  const userId = parseInt(params.id, 10);
  const user = await storage.users.findById(userId);
  if (!user) return error('用户不存在', 404);

  const [monitors, channels, funds, members] = await Promise.all([
    storage.monitor.listByUser(userId),
    storage.notify.listByUser(userId),
    storage.fund.listByUser(userId),
    storage.weight.listMembers(userId)
  ]);

  return json({
    success: true,
    user: { id: user.id, username: user.username, role: user.role, status: user.status, created_at: user.created_at },
    summary: {
      monitorCount: monitors.length,
      channelCount: channels.length,
      fundCount: funds.length,
      memberCount: members.length
    },
    monitors, channels, funds, members
  });
}

/**
 * PUT /api/admin/users/:id/role  修改用户角色
 * body: { role: 'user' | 'admin' }
 */
async function updateUserRole({ request, env, params }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => ({}));
  const role = body.role;
  if (role !== 'user' && role !== 'admin') return error('角色值非法');

  const storage = getStorage(env);
  const userId = parseInt(params.id, 10);
  const user = await storage.users.findById(userId);
  if (!user) return error('用户不存在', 404);

  await storage.users.updateRole(userId, role);
  return json({ success: true, message: '角色已更新' });
}

/**
 * PUT /api/admin/users/:id/status  启用/禁用用户
 * body: { status: 'active' | 'disabled' }
 */
async function updateUserStatus({ request, env, params }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => ({}));
  const status = body.status;
  if (status !== 'active' && status !== 'disabled') return error('状态值非法');

  const storage = getStorage(env);
  const userId = parseInt(params.id, 10);
  const user = await storage.users.findById(userId);
  if (!user) return error('用户不存在', 404);
  if (userId === auth.user_id && status === 'disabled') return error('不能禁用自己', 400);

  await storage.users.updateStatus(userId, status);
  return json({ success: true, message: '状态已更新' });
}

/**
 * POST /api/admin/users  创建用户（默认密码 123456）
 * body: { username, password?, role? }
 */
async function createUser({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => ({}));
  const username = (body.username || '').trim();
  if (username.length < 3 || username.length > 32) return error('用户名需为 3-32 个字符');
  const nickname = (body.nickname || '').trim() || username;
  const role = body.role === 'admin' ? 'admin' : 'user';
  const password = body.password && body.password.length >= 6 ? body.password : DEFAULT_PASSWORD;

  const storage = getStorage(env);
  const existing = await storage.users.findByName(username);
  if (existing) return error('用户名已存在');

  const password_hash = await hashPassword(password);
  const id = await storage.users.create({ username, password_hash, role, nickname });
  return json({ success: true, message: `用户已创建，初始密码：${password}`, id });
}

/**
 * PUT /api/admin/users/:id/nickname  超管修改用户昵称
 * body: { nickname }
 */
async function updateUserNickname({ request, env, params }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => ({}));
  const nickname = (body.nickname || '').trim();
  if (!nickname || nickname.length > 32) return error('昵称需为 1-32 个字符');

  const storage = getStorage(env);
  const userId = parseInt(params.id, 10);
  const user = await storage.users.findById(userId);
  if (!user) return error('用户不存在', 404);

  await storage.users.updateNickname(userId, nickname);
  return json({ success: true, message: '昵称已更新' });
}

/**
 * PUT /api/admin/users/:id/password  重置密码（默认 123456，或指定）
 * body: { password? }
 */
async function resetPassword({ request, env, params }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => ({}));
  const password = body.password && body.password.length >= 6 ? body.password : DEFAULT_PASSWORD;

  const storage = getStorage(env);
  const userId = parseInt(params.id, 10);
  const user = await storage.users.findById(userId);
  if (!user) return error('用户不存在', 404);

  const password_hash = await hashPassword(password);
  await storage.users.updatePassword(userId, password_hash);
  return json({ success: true, message: `密码已重置为：${password}` });
}

/**
 * POST /api/admin/users/:id/impersonate  超管切换为指定用户身份
 */
async function impersonateUser({ request, env, params }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;
  if (auth.impersonating) return error('请先退出当前模拟身份', 400);

  const storage = getStorage(env);
  const userId = parseInt(params.id, 10);
  const target = await storage.users.findById(userId);
  if (!target) return error('用户不存在', 404);
  if (target.id === auth.user_id) return error('不能切换到自己', 400);

  const token = getTokenFromRequest(request);
  await impersonate(env, token, { id: target.id, username: target.username, role: target.role }, auth);
  return json({ success: true, message: `已切换为 ${target.username}` });
}

/**
 * POST /api/admin/stop-impersonate  退出模拟身份，恢复超管
 */
async function stopImpersonateUser({ request, env }) {
  const token = getTokenFromRequest(request);
  const session = await getSession(env, token);
  if (!session || !session.impersonating) return error('当前不在模拟状态', 400);

  const storage = getStorage(env);
  const admin = await storage.users.findById(session.admin_id);
  if (!admin) return error('超管账号不存在', 404);

  await stopImpersonate(env, token, { id: admin.id, username: admin.username, role: admin.role });
  return json({ success: true, message: '已恢复超管身份' });
}

/**
 * GET /api/admin/settings/timezone  读取全局时区偏移
 */
async function getTimezone({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const raw = await storage.settings.get('tz_offset');
  return json({ success: true, tz_offset: parseOffset(raw != null ? raw : DEFAULT_TZ_OFFSET) });
}

/**
 * PUT /api/admin/settings/timezone  设置全局时区偏移
 * body: { tz_offset }  -12 ~ 14
 */
async function setTimezone({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  const n = parseInt(body.tz_offset, 10);
  if (isNaN(n) || n < -12 || n > 14) return error('时区偏移需为 -12 ~ 14 的整数');
  const storage = getStorage(env);
  await storage.settings.set('tz_offset', String(n));
  return json({ success: true, message: '时区已保存', tz_offset: n });
}

/**
 * GET /api/admin/settings/todo-attach-max-mb  读取待办附件单文件上限(MB)，默认 5
 */
async function getTodoAttachMaxMb({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const raw = parseInt(await storage.settings.get('todo_attach_max_mb'), 10);
  const mb = (!isNaN(raw) && raw >= 1 && raw <= 50) ? raw : 5;
  return json({ success: true, max_mb: mb });
}

/**
 * PUT /api/admin/settings/todo-attach-max-mb  设置待办附件单文件上限
 * body: { max_mb }  1 ~ 50
 */
async function setTodoAttachMaxMb({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  const n = parseInt(body.max_mb, 10);
  if (isNaN(n) || n < 1 || n > 50) return error('附件上限需为 1–50 之间的整数(MB)', 400);
  const storage = getStorage(env);
  await storage.settings.set('todo_attach_max_mb', String(n));
  return json({ success: true, message: '附件上限已保存', max_mb: n });
}

/**
 * GET /api/admin/settings/base-url  读取全局站点公开地址（DB 配置值，可能为空）
 */
async function getBaseUrl({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const base = await storage.settings.get('public_base_url');
  return json({ success: true, base_url: base || '' });
}

/**
 * PUT /api/admin/settings/base-url  设置全局站点公开地址
 * body: { base_url }  空串=清空（回退配置文件/请求源）；非空需 http(s):// 开头
 */
async function setBaseUrl({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  let v = (body.base_url != null ? String(body.base_url) : '').trim();
  if (v && !/^https?:\/\//i.test(v)) return error('站点地址需以 http:// 或 https:// 开头');
  v = v.replace(/\/+$/, '');  // 去掉结尾斜杠，避免拼链接出现双斜杠
  const storage = getStorage(env);
  await storage.settings.set('public_base_url', v);
  return json({ success: true, message: '站点地址已保存', base_url: v });
}

/**
 * GET /api/admin/settings/register-limit  读取注册人数上限与满员提示词
 * 返回 { limit: 0 表示不限制, msg: markdown 提示词（空串=用默认提示） }
 */
async function getRegisterLimit({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const raw = await storage.settings.get('register_limit');
  const n = parseInt(raw, 10);
  const limit = (!isNaN(n) && n > 0) ? Math.floor(n) : 0;
  const msg = (await storage.settings.get('register_limit_msg')) || '';
  return json({ success: true, limit, msg });
}

/**
 * PUT /api/admin/settings/register-limit  设置注册人数上限与满员提示词
 * body: { limit: 非负整数（0=不限制）, msg: markdown 提示词，空串=用默认提示 }
 */
async function setRegisterLimit({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  const n = parseInt(body.limit, 10);
  if (isNaN(n) || n < 0) return error('注册上限需为非负整数（0 表示不限制）');
  const limit = Math.floor(n);
  const msg = typeof body.msg === 'string' ? body.msg : '';
  if (msg.length > 5000) return error('满员提示词最长 5000 字符');
  const storage = getStorage(env);
  await storage.settings.set('register_limit', String(limit));
  await storage.settings.set('register_limit_msg', msg);
  return json({ success: true, message: '注册限制已保存', limit, msg });
}

export {
  listUsers, getUserDetail, updateUserRole, updateUserStatus,
  createUser, resetPassword, impersonateUser, stopImpersonateUser, updateUserNickname,
  getTimezone, setTimezone, getTodoAttachMaxMb, setTodoAttachMaxMb, getBaseUrl, setBaseUrl,
  getRegisterLimit, setRegisterLimit
};
