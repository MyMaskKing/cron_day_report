/**
 * Cloudflare Worker 入口
 * - fetch: 页面路由 + /api 接口路由
 * - scheduled: 定时执行所有启用的监控任务并按渠道发送
 *
 * 架构分层见 src/ 各子目录；存储通过 storage/adapter.js 抽象（D1 为主，MySQL 预留）。
 */

import { Router, json, html, error } from './router.js';
import { getTimeoutConfig } from './config.js';
import { getStorage } from './storage/adapter.js';
import { getSession, getTokenFromRequest } from './auth/session.js';
import { batchAccessUrls, formatResults } from './services/monitor.service.js';
import { sendNotification } from './services/notify.service.js';

// API handlers
import { register, login, logout, me, bootstrap, setupStatus } from './api/auth.api.js';
import { listUsers, getUserDetail, updateUserRole, updateUserStatus } from './api/users.api.js';

// Pages
import { loginPage, dashboardPage, adminPage, setupPage } from './web/pages.js';

// ==================== 路由注册 ====================
const router = new Router();

// --- 认证 API ---
router.post('/api/auth/register', register);
router.post('/api/auth/login', login);
router.post('/api/auth/logout', logout);
router.get('/api/auth/me', me);
router.get('/api/auth/setup-status', setupStatus);
router.post('/api/auth/bootstrap', bootstrap);

// --- 超管用户管理 API ---
router.get('/api/admin/users', listUsers);
router.get('/api/admin/users/:id', getUserDetail);
router.put('/api/admin/users/:id/role', updateUserRole);
router.put('/api/admin/users/:id/status', updateUserStatus);

// --- 手动触发（兼容保留，执行当前登录用户的启用任务）---
router.get('/api/monitor/run', runMyMonitors);
router.post('/api/monitor/run', runMyMonitors);

/**
 * 页面路由处理（需登录的页面统一校验会话）
 * @param {Request} request
 * @param {Object} env
 * @returns {Promise<Response|null>}
 */
async function handlePages(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  // 公开页
  if (path === '/login') return html(loginPage());
  if (path === '/setup') return html(setupPage());

  // 需登录页面
  const pageMap = {
    '/': 'dashboard', '/dashboard': 'dashboard',
    '/admin': 'admin'
  };
  if (path in pageMap) {
    const token = getTokenFromRequest(request);
    const session = await getSession(env, token);
    if (!session) {
      return new Response(null, { status: 302, headers: { Location: '/login' } });
    }
    const user = { id: session.user_id, username: session.username, role: session.role };

    switch (pageMap[path]) {
      case 'dashboard':
        return html(dashboardPage(user));
      case 'admin':
        if (user.role !== 'admin') return html(dashboardPage(user));
        return html(adminPage(user));
    }
  }
  return null;
}

/**
 * 手动触发：执行当前登录用户所有启用的监控任务
 * @param {Object} ctx - { request, env }
 * @returns {Promise<Response>}
 */
async function runMyMonitors({ request, env }) {
  const token = getTokenFromRequest(request);
  const session = await getSession(env, token);
  if (!session) return error('未登录', 401);

  const storage = getStorage(env);
  const tasks = (await storage.monitor.listByUser(session.user_id)).filter(t => t.enabled);
  if (tasks.length === 0) return json({ success: true, message: '没有启用的监控任务', results: [] });

  const result = await executeTasksAndNotify(env, storage, tasks);
  return json({ success: true, message: '执行完成', ...result });
}

/**
 * 执行一批监控任务并按各自渠道发送通知、写日志
 * @param {Object} env
 * @param {Object} storage
 * @param {Array} tasks
 * @returns {Promise<Object>} { results, notified }
 */
async function executeTasksAndNotify(env, storage, tasks) {
  const timeoutConfig = getTimeoutConfig(env);
  const results = await batchAccessUrls(tasks, timeoutConfig);

  // 写执行日志
  for (const r of results) {
    await storage.monitor.addLog({
      task_id: r.task_id, user_id: r.user_id, success: r.success,
      status: r.status, status_text: r.statusText,
      response_time: r.responseTime, response_size: r.responseSize
    });
  }

  // 按渠道分组发送：同一 channel_id 的结果合并为一条消息
  const byChannel = new Map();
  for (const r of results) {
    const key = r.channel_id || 'none';
    if (!byChannel.has(key)) byChannel.set(key, []);
    byChannel.get(key).push(r);
  }

  const notified = [];
  for (const [channelId, group] of byChannel) {
    if (channelId === 'none') continue; // 未配置渠道的任务不发送
    const channel = await storage.notify.findById(parseInt(channelId, 10));
    if (!channel || !channel.enabled) continue;
    const returnType = group[0].return_type || 'text';
    const message = formatResults(group, returnType);
    const sendResult = await sendNotification(message, channel, returnType);
    notified.push({ channelId, ...sendResult });
  }

  return { results, notified };
}

/**
 * 定时任务：执行所有用户启用的监控任务
 * @param {Object} env
 * @param {Object} ctx
 * @returns {Promise<Response>}
 */
async function handleScheduled(env, ctx) {
  try {
    const storage = getStorage(env);
    const tasks = await storage.monitor.listEnabledAll();
    if (tasks.length === 0) {
      return json({ success: true, message: '没有启用的监控任务' });
    }
    const result = await executeTasksAndNotify(env, storage, tasks);
    return json({ success: true, message: '定时任务执行完成', count: tasks.length, notified: result.notified });
  } catch (err) {
    return json({ success: false, message: `定时任务执行失败: ${err.message}`, error: err.stack }, 500);
  }
}

export default {
  async fetch(request, env, ctx) {
    try {
      // 1. API 路由
      const apiRes = await router.handle(request, env, ctx);
      if (apiRes) return apiRes;

      // 2. 页面路由
      const pageRes = await handlePages(request, env);
      if (pageRes) return pageRes;

      // 3. 未命中
      return html('<h1>404 Not Found</h1><p><a href="/dashboard">返回控制台</a></p>', 404);
    } catch (err) {
      return json({ success: false, message: '服务器错误', error: err.message }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(env, ctx));
  }
};
