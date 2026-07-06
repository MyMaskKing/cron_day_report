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
import { generateToken } from './auth/password.js';
import { batchAccessUrls, formatResults } from './services/monitor.service.js';
import { sendNotification } from './services/notify.service.js';

// API handlers
import { register, login, logout, me, bootstrap, setupStatus } from './api/auth.api.js';
import { listUsers, getUserDetail, updateUserRole, updateUserStatus } from './api/users.api.js';
import { listChannels, createChannel, updateChannel, removeChannel } from './api/notify.api.js';
import { listTasks, createTask, updateTask, removeTask, listTaskLogs } from './api/monitor.api.js';
import {
  listFunds, createFund, updateFund, removeFund,
  fundReport, getReportConfig, setReportConfig, sendReport, fundAnalysis,
  getShareLink, fundScenario, publicFundInfo, publicFundBuy, buyFund
} from './api/fund.api.js';
import { fetchNavBatch, buildPortfolio, buildFundReport } from './services/fund.service.js';

// Pages
import { loginPage, dashboardPage, adminPage, setupPage, monitorPage, fundPage, publicBuyPage } from './web/pages.js';

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

// --- 通知渠道 API ---
router.get('/api/notify/channels', listChannels);
router.post('/api/notify/channels', createChannel);
router.put('/api/notify/channels/:id', updateChannel);
router.delete('/api/notify/channels/:id', removeChannel);

// --- 监控任务 API ---
router.get('/api/monitor/tasks', listTasks);
router.post('/api/monitor/tasks', createTask);
router.get('/api/monitor/tasks/:id/logs', listTaskLogs);
router.put('/api/monitor/tasks/:id', updateTask);
router.delete('/api/monitor/tasks/:id', removeTask);

// --- 基金追踪 API ---
router.get('/api/fund/list', listFunds);
router.get('/api/fund/report', fundReport);
router.get('/api/fund/report-config', getReportConfig);
router.put('/api/fund/report-config', setReportConfig);
router.get('/api/fund/analysis', fundAnalysis);
router.post('/api/fund/scenario', fundScenario);
router.post('/api/fund/report/send', sendReport);
router.get('/api/fund/:id/share-link', getShareLink);
router.post('/api/fund/:id/buy', buyFund);
router.post('/api/fund', createFund);
router.put('/api/fund/:id', updateFund);
router.delete('/api/fund/:id', removeFund);

// --- 免密加仓公开 API（无需登录，靠 token）---
router.get('/api/public/fund/:token', publicFundInfo);
router.post('/api/public/fund/:token/buy', publicFundBuy);

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
  // 免密加仓公开页 /f/:token
  if (path.startsWith('/f/') && path.split('/').filter(Boolean).length === 2) {
    return html(publicBuyPage());
  }

  // 需登录页面
  const pageMap = {
    '/': 'dashboard', '/dashboard': 'dashboard',
    '/monitor': 'monitor',
    '/fund': 'fund',
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
      case 'monitor':
        return html(monitorPage(user));
      case 'fund':
        return html(fundPage(user));
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
 * 定时任务分流：按触发的 cron 表达式决定执行监控任务还是基金日报
 * - MONITOR_CRON: 执行所有用户启用的监控任务
 * - FUND_CRON: 推送启用日报的用户基金日报
 * 手动调用（cron 为空）时两者都执行
 * @param {string} cron - 触发的 cron 表达式（event.cron）
 * @param {Object} env
 * @param {Object} ctx
 * @returns {Promise<Response>}
 */
const MONITOR_CRON = '0 22 * * *';   // 北京早上 6 点
const FUND_CRON = '50 6 * * *';      // 北京 14:50

async function handleScheduled(cron, env, ctx) {
  const storage = getStorage(env);
  const summary = { cron: cron || 'manual', monitor: null, fundReport: null };

  const runMonitor = !cron || cron === MONITOR_CRON;
  const runFund = !cron || cron === FUND_CRON;

  // 1. 监控任务
  if (runMonitor) {
    try {
      const tasks = await storage.monitor.listEnabledAll();
      if (tasks.length > 0) {
        const result = await executeTasksAndNotify(env, storage, tasks);
        summary.monitor = { count: tasks.length, notified: result.notified };
      } else {
        summary.monitor = { count: 0 };
      }
    } catch (err) {
      summary.monitor = { error: err.message };
    }
  }

  // 2. 基金日报
  if (runFund) {
    // 2.1 无条件刷新所有被持有基金的净值到缓存（即使用户未启用日报）
    try {
      const codes = await storage.fund.listAllCodes();
      if (codes.length > 0) {
        const navMap = await fetchNavBatch(codes);
        for (const [code, nav] of navMap) await storage.fund.upsertNav(code, nav);
        summary.navRefreshed = navMap.size;
      } else {
        summary.navRefreshed = 0;
      }
    } catch (err) {
      summary.navRefreshed = { error: err.message };
    }
    // 2.2 推送启用日报用户的基金日报
    try {
      summary.fundReport = await sendFundReports(env, storage);
    } catch (err) {
      summary.fundReport = { error: err.message };
    }
  }

  return json({ success: true, message: '定时任务执行完成', ...summary });
}

/**
 * 为所有启用日报的用户生成并推送基金日报
 * @param {Object} env
 * @param {Object} storage
 * @returns {Promise<Object>} { sent }
 */
async function sendFundReports(env, storage) {
  const configs = await storage.fund.listReportEnabled();
  const sent = [];
  for (const cfg of configs) {
    if (!cfg.channel_id) continue;
    const channel = await storage.notify.findById(cfg.channel_id);
    if (!channel || !channel.enabled) continue;
    const funds = await storage.fund.listByUser(cfg.user_id);
    if (funds.length === 0) continue;

    const navMap = await fetchNavBatch(funds.map(f => f.code));
    for (const [code, nav] of navMap) await storage.fund.upsertNav(code, nav);
    const portfolio = buildPortfolio(funds, navMap);
    const format = cfg.format || 'text';
    const linkMap = await buildShareLinkMap(env, storage, funds);
    const message = buildFundReport(portfolio, format, linkMap);
    const r = await sendNotification(message, channel, format);
    sent.push({ user_id: cfg.user_id, ...r });
  }
  return { sent };
}

/**
 * 为一批持仓生成 { fundId: 免密加仓链接 }，无 token 的自动生成并持久化
 * @param {Object} env
 * @param {Object} storage
 * @param {Array} funds
 * @returns {Promise<Object>}
 */
async function buildShareLinkMap(env, storage, funds) {
  const base = env.PUBLIC_BASE_URL || '';
  if (!base) return null; // 未配置站点地址则不附链接
  const map = {};
  for (const f of funds) {
    let token = f.share_token;
    if (!token) {
      token = generateToken();
      await storage.fund.setShareToken(f.id, token);
    }
    map[f.id] = `${base}/f/${token}`;
  }
  return map;
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
    ctx.waitUntil(handleScheduled(event.cron, env, ctx));
  }
};
