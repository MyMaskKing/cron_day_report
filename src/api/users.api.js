/**
 * 用户管理 API（超管专用）
 * 列出所有用户、查看指定用户各模块数据、改角色/禁用状态
 */

import { json, error } from '../router.js';
import { getStorage } from '../storage/adapter.js';
import { requireAdmin } from '../auth/middleware.js';

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

export { listUsers, getUserDetail, updateUserRole, updateUserStatus };
