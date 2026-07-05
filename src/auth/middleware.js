/**
 * 认证中间件：requireAuth / requireAdmin
 * 返回 session 对象（通过）或 Response（拒绝）
 */

import { getSession, getTokenFromRequest } from './session.js';
import { error } from '../router.js';

/**
 * 要求已登录
 * @param {Request} request
 * @param {Object} env
 * @returns {Promise<Object|Response>} 会话数据 或 401 响应
 */
async function requireAuth(request, env) {
  const token = getTokenFromRequest(request);
  const session = await getSession(env, token);
  if (!session) return error('未登录或会话已过期', 401);
  return session;
}

/**
 * 要求超管
 * @returns {Promise<Object|Response>} 会话数据 或 401/403 响应
 */
async function requireAdmin(request, env) {
  const session = await requireAuth(request, env);
  if (session instanceof Response) return session;
  if (session.role !== 'admin') return error('需要超管权限', 403);
  return session;
}

export { requireAuth, requireAdmin };
