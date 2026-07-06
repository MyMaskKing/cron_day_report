/**
 * 会话管理：签发 / 校验 / 销毁（基于 KV）
 * token 通过 Cookie (name=sid) 传递
 */

import { generateToken } from './password.js';
import { kvSetSession, kvGetSession, kvDeleteSession } from '../storage/kv-store.js';
import { SESSION_TTL } from '../config.js';

const COOKIE_NAME = 'sid';

/**
 * 创建会话并返回 token
 * @param {Object} env
 * @param {Object} user - {id, username, role}
 * @returns {Promise<string>} token
 */
async function createSession(env, user) {
  const token = generateToken();
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL;
  await kvSetSession(env.KV, token, {
    user_id: user.id, username: user.username, role: user.role, exp
  }, SESSION_TTL);
  return token;
}

/**
 * 读取会话
 * @returns {Promise<Object|null>}
 */
async function getSession(env, token) {
  if (!token) return null;
  const data = await kvGetSession(env.KV, token);
  if (!data) return null;
  if (data.exp && data.exp < Math.floor(Date.now() / 1000)) {
    await kvDeleteSession(env.KV, token);
    return null;
  }
  return data;
}

/** 销毁会话 */
async function destroySession(env, token) {
  if (token) await kvDeleteSession(env.KV, token);
}

/**
 * 超管切换为指定用户身份（复用当前 token，改写 session 数据）
 * 保留 admin 原始身份用于恢复
 * @param {Object} env
 * @param {string} token - 当前超管会话 token
 * @param {Object} targetUser - 目标用户 {id, username, role}
 * @param {Object} admin - 当前超管 {user_id, username}
 */
async function impersonate(env, token, targetUser, admin) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL;
  await kvSetSession(env.KV, token, {
    user_id: targetUser.id, username: targetUser.username, role: targetUser.role, exp,
    impersonating: true, admin_id: admin.user_id, admin_username: admin.username
  }, SESSION_TTL);
}

/**
 * 退出模拟身份，恢复超管
 * @param {Object} env
 * @param {string} token
 * @param {Object} admin - 超管用户 {id, username, role}
 */
async function stopImpersonate(env, token, admin) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL;
  await kvSetSession(env.KV, token, {
    user_id: admin.id, username: admin.username, role: admin.role, exp
  }, SESSION_TTL);
}

/**
 * 从请求 Cookie 提取会话 token
 * @param {Request} request
 * @returns {string|null}
 */
function getTokenFromRequest(request) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

/** 生成 Set-Cookie 头（登录） */
function buildSessionCookie(token) {
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL}`;
}

/** 生成清除 Cookie 头（登出） */
function buildClearCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export {
  createSession, getSession, destroySession,
  impersonate, stopImpersonate,
  getTokenFromRequest, buildSessionCookie, buildClearCookie, COOKIE_NAME
};
