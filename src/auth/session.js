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
  getTokenFromRequest, buildSessionCookie, buildClearCookie, COOKIE_NAME
};
