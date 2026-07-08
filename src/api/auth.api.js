/**
 * 认证 API：注册 / 登录 / 登出 / 当前用户 / 初始化超管
 */

import { json, error } from '../router.js';
import { getStorage } from '../storage/adapter.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import {
  createSession, destroySession, getSession,
  getTokenFromRequest, buildSessionCookie, buildClearCookie
} from '../auth/session.js';

/** 校验用户名/密码基本规则 */
function validateCredentials(username, password) {
  if (!username || typeof username !== 'string' || username.length < 3 || username.length > 32) {
    return '用户名需为 3-32 个字符';
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return '密码至少 6 位';
  }
  return null;
}

/**
 * POST /api/auth/register  注册普通用户
 * body: { username, password }
 */
async function register({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const { username, password } = body;
  const nickname = (body.nickname || '').trim() || username;
  const invalid = validateCredentials(username, password);
  if (invalid) return error(invalid);

  const storage = getStorage(env);
  const existing = await storage.users.findByName(username);
  if (existing) return error('用户名已存在');

  const password_hash = await hashPassword(password);
  const id = await storage.users.create({ username, password_hash, role: 'user', nickname });
  return json({ success: true, message: '注册成功', user: { id, username, role: 'user' } });
}

/**
 * POST /api/auth/login  登录
 * body: { username, password }
 */
async function login({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const { username, password } = body;
  if (!username || !password) return error('请输入用户名和密码');

  const storage = getStorage(env);
  const user = await storage.users.findByName(username);
  if (!user) return error('用户名或密码错误', 401);
  if (user.status === 'disabled') return error('账号已被禁用', 403);

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return error('用户名或密码错误', 401);

  const token = await createSession(env, user);
  return json(
    { success: true, message: '登录成功', user: { id: user.id, username: user.username, role: user.role } },
    200,
    { 'Set-Cookie': buildSessionCookie(token) }
  );
}

/**
 * POST /api/auth/logout  登出
 */
async function logout({ request, env }) {
  const token = getTokenFromRequest(request);
  await destroySession(env, token);
  return json({ success: true, message: '已登出' }, 200, { 'Set-Cookie': buildClearCookie() });
}

/**
 * GET /api/auth/me  当前登录用户
 */
async function me({ request, env }) {
  const token = getTokenFromRequest(request);
  const session = await getSession(env, token);
  if (!session) return error('未登录', 401);
  const storage = getStorage(env);
  const u = await storage.users.findById(session.user_id);
  const nickname = (u && u.nickname) || session.nickname || session.username;
  return json({
    success: true,
    user: { id: session.user_id, username: session.username, nickname, role: session.role }
  });
}

/**
 * GET /api/auth/profile  当前用户资料
 */
async function getProfile({ request, env }) {
  const token = getTokenFromRequest(request);
  const session = await getSession(env, token);
  if (!session) return error('未登录', 401);
  const storage = getStorage(env);
  const u = await storage.users.findById(session.user_id);
  if (!u) return error('用户不存在', 404);
  return json({ success: true, profile: { username: u.username, nickname: u.nickname || u.username } });
}

/**
 * PUT /api/auth/profile  修改昵称  body: { nickname }
 */
async function updateProfile({ request, env }) {
  const token = getTokenFromRequest(request);
  const session = await getSession(env, token);
  if (!session) return error('未登录', 401);
  const body = await request.json().catch(() => ({}));
  const nickname = (body.nickname || '').trim();
  if (!nickname || nickname.length > 32) return error('昵称需为 1-32 个字符');
  const storage = getStorage(env);
  await storage.users.updateNickname(session.user_id, nickname);
  return json({ success: true, message: '昵称已更新' });
}

/**
 * PUT /api/auth/password  修改自己的密码  body: { oldPassword, newPassword }
 */
async function changePassword({ request, env }) {
  const token = getTokenFromRequest(request);
  const session = await getSession(env, token);
  if (!session) return error('未登录', 401);
  const body = await request.json().catch(() => ({}));
  const { oldPassword, newPassword } = body;
  if (!newPassword || newPassword.length < 6) return error('新密码至少 6 位');

  const storage = getStorage(env);
  const u = await storage.users.findById(session.user_id);
  if (!u) return error('用户不存在', 404);
  const ok = await verifyPassword(oldPassword || '', u.password_hash);
  if (!ok) return error('原密码错误', 401);

  const password_hash = await hashPassword(newPassword);
  await storage.users.updatePassword(session.user_id, password_hash);
  return json({ success: true, message: '密码已修改' });
}

/**
 * GET /api/auth/setup-status  查询是否需要初始化超管（供 /setup 页面判断）
 * 判断依据是"是否已存在超管"，而非是否有任何用户
 * 返回 { needSetup: bool, tokenRequired: bool }
 */
async function setupStatus({ env }) {
  const storage = getStorage(env);
  const adminCount = await storage.users.countAdmins();
  return json({
    success: true,
    needSetup: adminCount === 0,
    tokenRequired: !!env.ADMIN_BOOTSTRAP_TOKEN
  });
}

/**
 * POST /api/auth/bootstrap  初始化超管（仅当系统尚无超管时可用）
 * body: { username, password, token }
 * 若配置了 env.ADMIN_BOOTSTRAP_TOKEN 则校验 token；未配置则仅凭"系统无超管"即可创建。
 * 若用户名已存在（如已注册的普通用户），则将其提升为超管。
 */
async function bootstrap({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const { username, password, token } = body;

  // 令牌可选：仅在配置了 secret 时才强制校验
  if (env.ADMIN_BOOTSTRAP_TOKEN && token !== env.ADMIN_BOOTSTRAP_TOKEN) {
    return error('初始化令牌错误', 403);
  }

  const storage = getStorage(env);
  const adminCount = await storage.users.countAdmins();
  if (adminCount > 0) return error('系统已存在超管，无法重复初始化', 409);

  const invalid = validateCredentials(username, password);
  if (invalid) return error(invalid);

  // 用户名已存在：提升为超管（沿用原密码）；否则新建超管
  const existing = await storage.users.findByName(username);
  if (existing) {
    await storage.users.updateRole(existing.id, 'admin');
    return json({ success: true, message: '已将现有用户提升为超管（请用原注册密码登录）', user: { id: existing.id, username, role: 'admin' } });
  }
  const password_hash = await hashPassword(password);
  const id = await storage.users.create({ username, password_hash, role: 'admin' });
  return json({ success: true, message: '超管初始化成功', user: { id, username, role: 'admin' } });
}

/**
 * POST /api/public/quick-login/:kind/:token  免密页快速登录
 * 按免密 token 定位其所属用户并签发正式会话（谁的链接就登入谁的账号）
 * kind ∈ fund | weight | asset | weight-report | asset-report
 */
async function quickLoginByToken({ env, params }) {
  const storage = getStorage(env);
  const { kind, token } = params;
  let userId = null;
  if (kind === 'fund') {
    const f = await storage.fund.findByShareToken(token);
    if (f) userId = f.user_id;
  } else if (kind === 'weight') {
    const m = await storage.weight.findMemberByShareToken(token);
    if (m) userId = m.user_id;
  } else if (kind === 'asset') {
    const w = await storage.asset.findWalletByShareToken(token);
    if (w) userId = w.user_id;
  } else if (kind === 'weight-report' || kind === 'asset-report' || kind === 'fund-report') {
    const row = await storage.push.findByReportToken(token);
    if (row) userId = row.user_id;
  } else {
    return error('登录类型非法', 400);
  }
  if (userId == null) return error('链接无效或已失效', 404);

  const user = await storage.users.findById(userId);
  if (!user) return error('用户不存在', 404);
  if (user.status === 'disabled') return error('账号已被禁用', 403);

  const REDIRECT = {
    fund: '/fund', weight: '/weight', asset: '/asset',
    'weight-report': '/weight', 'asset-report': '/asset', 'fund-report': '/fund'
  };
  const sessionToken = await createSession(env, user);
  return json(
    { success: true, redirect: REDIRECT[kind] || '/dashboard' },
    200,
    { 'Set-Cookie': buildSessionCookie(sessionToken) }
  );
}

export {
  register, login, logout, me, bootstrap, setupStatus,
  getProfile, updateProfile, changePassword, quickLoginByToken
};
