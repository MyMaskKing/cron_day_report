/**
 * Cloudflare Worker 入口
 * - fetch: 页面路由 + /api 接口路由
 * - scheduled: 定时执行所有启用的监控任务并按渠道发送
 *
 * 架构分层见 src/ 各子目录；存储通过 storage/adapter.js 抽象（D1 为主，MySQL 预留）。
 */

import { Router, json, html, error } from './router.js';
import { getTimeoutConfig, resolveBaseUrl, effectiveFormat } from './config.js';
import { getStorage } from './storage/adapter.js';
import { getSession, getTokenFromRequest } from './auth/session.js';
import { generateToken } from './auth/password.js';
import { batchAccessUrls, formatResults } from './services/monitor.service.js';
import { sendNotification } from './services/notify.service.js';

// API handlers
import { register, login, logout, me, bootstrap, setupStatus, getProfile, updateProfile, changePassword, quickLoginByToken, updateQuickloginRestrict } from './api/auth.api.js';
import {
  listUsers, getUserDetail, updateUserRole, updateUserStatus,
  createUser, resetPassword, impersonateUser, stopImpersonateUser, updateUserNickname,
  getTimezone, setTimezone, getBaseUrl, setBaseUrl
} from './api/users.api.js';
import { listChannels, createChannel, updateChannel, removeChannel } from './api/notify.api.js';
import { listTasks, createTask, updateTask, removeTask, listTaskLogs } from './api/monitor.api.js';
import {
  listFunds, createFund, updateFund, removeFund,
  fundReport, refreshFundNav, getReportConfig, setReportConfig, sendReport, fundAnalysis,
  getShareLink, fundScenario, publicFundInfo, publicFundReport, publicFundBuy, buyFund,
  fundProfitHistory,
  getStrategy, setStrategy
} from './api/fund.api.js';
import { fetchNavBatch, buildPortfolio, enrichNavWithCache } from './services/fund.service.js';
import {
  listMembers, createMember, updateMember, removeMember, getMemberShareLink,
  weightChart, addRecord, updateRecord, removeRecord,
  publicMemberInfo, publicSubmitWeight, publicWeightReport, adminCompare, adminAllMembers, adminShareMember,
  getUnit, setUnit
} from './api/weight.api.js';
import {
  listWallets, createWallet, updateWallet, removeWallet, getWalletShareLink,
  saveRecord, updateRecord as updateAssetRecord, removeRecord as removeAssetRecord, assetReport, getGoal, setGoal,
  publicWalletInfo, publicSaveRecord, publicAssetReport
} from './api/asset.api.js';
import { buildAssetReportData } from './services/asset.service.js';
import { getPushConfig, setPushConfig, resetMyModuleShare, adminResetModuleShare } from './api/push.api.js';
import { listPushLogs, countPushLogs, deletePushLogsRange } from './api/pushLog.api.js';
import { shouldRun, nowCN } from './services/schedule.service.js';
import { buildFundReport, buildAssetReport, buildWeightReport, buildTodoReport, filterTodayOverdue } from './services/report.service.js';
import { buildTree, flattenPending } from './services/todo.service.js';
import {
  listTodos, createTodo, updateTodo, toggleTodo, removeTodo, getShareLink as getTodoShareLink, todoChart, reorderTodo,
  publicTodoInfo, publicAddTodo, publicToggleTodo, publicUpdateTodo, publicTodoReport, publicTodoChart,
  publicAllAdd, publicAllToggle, publicAllUpdate, publicAllReorder
} from './api/todo.api.js';
import { parseOffset, fmtShort } from './services/time.service.js';

// Pages
import {
  loginPage, dashboardPage, adminPage, setupPage, monitorPage, fundPage, publicBuyPage,
  weightPage, publicWeightPage, settingsPage, assetPage, publicAssetPage, channelsPage,
  weightReportPage, assetReportPage, fundReportPage,
  todoPage, publicTodoPage, todoReportPage, todoCollabPage
} from './web/pages.js';

// ==================== 路由注册 ====================
const router = new Router();

// --- 认证 API ---
router.post('/api/auth/register', register);
router.post('/api/auth/login', login);
router.post('/api/auth/logout', logout);
router.get('/api/auth/me', me);
router.get('/api/auth/profile', getProfile);
router.put('/api/auth/profile', updateProfile);
router.put('/api/auth/password', changePassword);
router.put('/api/auth/quicklogin-restrict', updateQuickloginRestrict);
router.get('/api/auth/setup-status', setupStatus);
router.post('/api/auth/bootstrap', bootstrap);
router.post('/api/public/quick-login/:kind/:token', quickLoginByToken);

// --- 超管用户管理 API ---
router.get('/api/admin/users', listUsers);
router.post('/api/admin/users', createUser);
router.post('/api/admin/stop-impersonate', stopImpersonateUser);
router.get('/api/admin/users/:id', getUserDetail);
router.put('/api/admin/users/:id/role', updateUserRole);
router.put('/api/admin/users/:id/status', updateUserStatus);
router.put('/api/admin/users/:id/password', resetPassword);
router.put('/api/admin/users/:id/nickname', updateUserNickname);
router.post('/api/admin/users/:id/impersonate', impersonateUser);

// --- 超管全局设置 API ---
router.get('/api/admin/settings/timezone', getTimezone);
router.put('/api/admin/settings/timezone', setTimezone);
router.get('/api/admin/settings/base-url', getBaseUrl);
router.put('/api/admin/settings/base-url', setBaseUrl);

// --- 超管推送日志 API ---
router.get('/api/admin/push-log', listPushLogs);
router.get('/api/admin/push-log/count', countPushLogs);
router.post('/api/admin/push-log/delete-range', deletePushLogsRange);

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
router.post('/api/fund/refresh', refreshFundNav);
router.get('/api/fund/profit-history', fundProfitHistory);
router.get('/api/fund/report-config', getReportConfig);
router.put('/api/fund/report-config', setReportConfig);
router.get('/api/fund/strategy', getStrategy);
router.put('/api/fund/strategy', setStrategy);
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
router.get('/api/public/fund-report/:token', publicFundReport);
router.post('/api/public/fund/:token/buy', publicFundBuy);

// --- 体重曲线 API ---
router.get('/api/weight/members', listMembers);
router.post('/api/weight/members', createMember);
router.put('/api/weight/members/:id', updateMember);
router.get('/api/weight/members/:id/share-link', getMemberShareLink);
router.delete('/api/weight/members/:id', removeMember);
router.get('/api/weight/chart', weightChart);
router.get('/api/weight/unit', getUnit);
router.put('/api/weight/unit', setUnit);
router.post('/api/weight/records', addRecord);
router.put('/api/weight/records/:id', updateRecord);
router.delete('/api/weight/records/:id', removeRecord);
router.get('/api/admin/weight/compare', adminCompare);
router.get('/api/admin/weight/all-members', adminAllMembers);
router.post('/api/admin/weight/share', adminShareMember);
router.get('/api/public/weight/:token', publicMemberInfo);
router.post('/api/public/weight/:token', publicSubmitWeight);
router.get('/api/public/weight-report/:token', publicWeightReport);

// --- 资产报表 API ---
router.get('/api/asset/wallets', listWallets);
router.post('/api/asset/wallets', createWallet);
router.get('/api/asset/wallets/:id/share-link', getWalletShareLink);
router.put('/api/asset/wallets/:id', updateWallet);
router.delete('/api/asset/wallets/:id', removeWallet);
router.post('/api/asset/records', saveRecord);
router.put('/api/asset/records/:id', updateAssetRecord);
router.delete('/api/asset/records/:id', removeAssetRecord);
router.get('/api/asset/report', assetReport);
router.get('/api/asset/goal', getGoal);
router.put('/api/asset/goal', setGoal);
router.get('/api/public/asset/:token', publicWalletInfo);
router.post('/api/public/asset/:token', publicSaveRecord);
router.get('/api/public/asset-report/:token', publicAssetReport);

// --- 待办 API ---
router.get('/api/todo/list', listTodos);
router.get('/api/todo/chart', todoChart);
router.put('/api/todo/reorder', reorderTodo);
router.post('/api/todo', createTodo);
router.get('/api/todo/:id/share-link', getTodoShareLink);
router.put('/api/todo/:id/done', toggleTodo);
router.put('/api/todo/:id', updateTodo);
router.delete('/api/todo/:id', removeTodo);
router.get('/api/public/todo/:token', publicTodoInfo);
router.post('/api/public/todo/:token', publicAddTodo);
router.put('/api/public/todo/:token/:id/done', publicToggleTodo);
router.put('/api/public/todo/:token/:id', publicUpdateTodo);
router.get('/api/public/todo-report/:token', publicTodoReport);
router.get('/api/public/todo-chart/:token', publicTodoChart);
router.post('/api/public/todo-all/:token', publicAllAdd);
router.put('/api/public/todo-all/:token/reorder', publicAllReorder);
router.put('/api/public/todo-all/:token/:id/done', publicAllToggle);
router.put('/api/public/todo-all/:token/:id', publicAllUpdate);

// --- 通用推送配置 API ---
router.get('/api/push/:module', getPushConfig);
router.put('/api/push/:module', setPushConfig);
router.post('/api/push/:module/send', runMyModulePush);
// 免密链接模块级重置
router.post('/api/share/reset/:module', resetMyModuleShare);
router.post('/api/admin/share/reset/:module/:userId', adminResetModuleShare);

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
  // 体重免密填写公开页 /w/:token
  if (path.startsWith('/w/') && path.split('/').filter(Boolean).length === 2) {
    return html(publicWeightPage());
  }
  // 资产免密录入公开页 /a/:token
  if (path.startsWith('/a/') && path.split('/').filter(Boolean).length === 2) {
    return html(publicAssetPage());
  }
  // 体重免密报告查看页 /wr/:token
  if (path.startsWith('/wr/') && path.split('/').filter(Boolean).length === 2) {
    return html(weightReportPage());
  }
  // 资产免密报告查看页 /ar/:token
  if (path.startsWith('/ar/') && path.split('/').filter(Boolean).length === 2) {
    return html(assetReportPage());
  }
  // 基金持仓分布免密报告页 /fr/:token
  if (path.startsWith('/fr/') && path.split('/').filter(Boolean).length === 2) {
    return html(fundReportPage());
  }
  // 待办免密协作页 /t/:token
  if (path.startsWith('/t/') && path.split('/').filter(Boolean).length === 2) {
    return html(publicTodoPage());
  }
  // 待办免密报告查看页 /tr/:token
  if (path.startsWith('/tr/') && path.split('/').filter(Boolean).length === 2) {
    return html(todoReportPage());
  }
  // 待办免密汇总协作页 /tc/:token（跨全部清单，今天+逾期，可写）
  if (path.startsWith('/tc/') && path.split('/').filter(Boolean).length === 2) {
    return html(todoCollabPage());
  }

  // 需登录页面
  const pageMap = {
    '/': 'dashboard', '/dashboard': 'dashboard',
    '/monitor': 'monitor',
    '/channels': 'channels',
    '/fund': 'fund',
    '/asset': 'asset',
    '/weight': 'weight',
    '/todo': 'todo',
    '/settings': 'settings',
    '/admin': 'admin'
  };
  if (path in pageMap) {
    const token = getTokenFromRequest(request);
    const session = await getSession(env, token);
    if (!session) {
      return new Response(null, { status: 302, headers: { Location: '/login' } });
    }
    // 受限免密会话：只放行对应模块页，其他一律重定向回允许页
    if (session.quicklogin_module) {
      const allow = { fund: '/fund', weight: '/weight', asset: '/asset', todo: '/todo' }[session.quicklogin_module];
      if (allow && path !== allow) {
        return new Response(null, { status: 302, headers: { Location: allow } });
      }
    }
    const user = {
      id: session.user_id, username: session.username,
      nickname: session.nickname || session.username, role: session.role,
      impersonating: !!session.impersonating, admin_username: session.admin_username || null,
      quickloginModule: session.quicklogin_module || null
    };

    switch (pageMap[path]) {
      case 'dashboard':
        return html(dashboardPage(user));
      case 'monitor':
        return html(monitorPage(user));
      case 'channels':
        return html(channelsPage(user));
      case 'fund':
        return html(fundPage(user));
      case 'asset':
        return html(assetPage(user));
      case 'weight':
        return html(weightPage(user));
      case 'todo':
        return html(todoPage(user));
      case 'settings':
        return html(settingsPage(user));
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
  const tzOffset = parseOffset(await storage.settings.get('tz_offset'));
  const tasks = (await storage.monitor.listByUser(session.user_id)).filter(t => t.enabled);
  if (tasks.length === 0) return json({ success: true, message: '没有启用的监控任务', results: [] });

  const result = await executeTasksAndNotify(env, storage, tasks, tzOffset, 'manual');
  return json({ success: true, message: '执行完成', ...result });
}

/**
 * 手动触发：立即推送当前登录用户某模块的日报/月报（供画面「立即推送」测试）
 * 忽略时间判断，直接按该模块 push_config 的渠道发送。
 * @param {Object} ctx - { request, env, params }
 * @returns {Promise<Response>}
 */
async function runMyModulePush({ request, env, params }) {
  const token = getTokenFromRequest(request);
  const session = await getSession(env, token);
  if (!session) return error('未登录', 401);
  const module = params.module;
  if (!['fund', 'weight', 'asset', 'todo'].includes(module)) return error('模块非法', 400);

  const storage = getStorage(env);
  const tzOffset = parseOffset(await storage.settings.get('tz_offset'));
  const cfg = await storage.push.getConfig(session.user_id, module);
  const channelIds = cfg ? parseChannelIds(cfg) : [];
  if (!channelIds.length) return error('请先配置推送渠道', 400);

  const format = (cfg && cfg.format) || 'text';
  // 逐个绑定渠道发送，按渠道有效格式生成内容（同一有效格式只生成一次）
  const msgCache = {};
  const results = [];
  let anySent = false;
  for (const cid of channelIds) {
    const channel = await storage.notify.findById(cid);
    if (!channel || channel.user_id !== session.user_id || !channel.enabled) continue;
    const fmt = effectiveFormat(format, channel.type);
    if (!(fmt in msgCache)) {
      msgCache[fmt] = await buildModuleMessage(env, storage, module, session.user_id, fmt, tzOffset);
    }
    const message = msgCache[fmt];
    if (!message) return error('暂无数据，无法生成推送内容', 400);
    const r = await sendNotification(message, channel, fmt, moduleSubject(module, tzOffset));
    results.push({ channel_id: cid, ...r });
    anySent = true;
    // 推送日志: 手动触发, 写失败不影响主流程
    await storage.pushLog.add({
      user_id: session.user_id, module,
      channel_id: cid, channel_name: channel.name, channel_type: channel.type,
      format: fmt, trigger_by: 'manual',
      success: !!r.success, error: r.success ? null : r.message
    }).catch(() => {});
  }
  if (!anySent) return error('绑定的通知渠道不存在或已停用', 400);
  return json({ success: true, message: '已推送', results });
}

/**
 * 执行一批监控任务并按各自渠道发送通知、写日志
 * @param {Object} env
 * @param {Object} storage
 * @param {Array} tasks
 * @returns {Promise<Object>} { results, notified }
 */
async function executeTasksAndNotify(env, storage, tasks, tzOffset = 8, triggerBy = 'cron') {
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

  // 分流：standalone 任务单独发；其余按渠道合并
  const notified = [];
  const standaloneResults = results.filter(r => r.standalone && r.channel_id);
  const mergeResults = results.filter(r => !r.standalone);
  const subject = moduleSubject('monitor', tzOffset);

  // 独立发送：每条一个消息
  for (const r of standaloneResults) {
    const channel = await storage.notify.findById(parseInt(r.channel_id, 10));
    if (!channel || !channel.enabled) continue;
    const returnType = r.return_type || 'text';
    const message = formatResults([r], returnType, tzOffset);
    const sendResult = await sendNotification(message, channel, returnType, subject);
    notified.push({ channelId: r.channel_id, standalone: true, ...sendResult });
    // 推送日志: 落发送动作本身, 失败原因取 sendResult.message; 写失败不影响主流程
    await storage.pushLog.add({
      user_id: r.user_id, module: 'monitor',
      channel_id: channel.id, channel_name: channel.name, channel_type: channel.type,
      format: returnType, trigger_by: triggerBy,
      success: !!sendResult.success, error: sendResult.success ? null : sendResult.message
    }).catch(() => {});
  }

  // 合并发送：同一 channel_id 的结果合并为一条消息
  const byChannel = new Map();
  for (const r of mergeResults) {
    const key = r.channel_id || 'none';
    if (!byChannel.has(key)) byChannel.set(key, []);
    byChannel.get(key).push(r);
  }
  for (const [channelId, group] of byChannel) {
    if (channelId === 'none') continue; // 未配置渠道的任务不发送
    const channel = await storage.notify.findById(parseInt(channelId, 10));
    if (!channel || !channel.enabled) continue;
    const returnType = group[0].return_type || 'text';
    const message = formatResults(group, returnType, tzOffset);
    const sendResult = await sendNotification(message, channel, returnType, subject);
    notified.push({ channelId, ...sendResult });
    // 推送日志: 合并组以组内第一条的 user_id 作为归属 (同用户同渠道)
    await storage.pushLog.add({
      user_id: group[0].user_id, module: 'monitor',
      channel_id: channel.id, channel_name: channel.name, channel_type: channel.type,
      format: returnType, trigger_by: triggerBy,
      success: !!sendResult.success, error: sendResult.success ? null : sendResult.message
    }).catch(() => {});
  }

  return { results, notified };
}

/**
 * 定时调度（平台无关）：Worker 每小时唤醒一次，读各模块推送配置，
 * 用 shouldRun 判断此刻是否到点。监控任务固定每天北京 6 点执行。
 * @param {string} cron - 触发的 cron 表达式（未用于分流，仅记录）
 * @param {Object} env
 * @param {Object} ctx
 * @returns {Promise<Response>}
 */
async function handleScheduled(cron, env, ctx) {
  const storage = getStorage(env);
  const tzOffset = parseOffset(await storage.settings.get('tz_offset'));
  const now = nowCN(Date.now(), tzOffset);
  const manual = !cron; // /cron 手动调用时 cron 为空，全部执行
  const summary = { at: `${now.dateStr} ${now.hour}:00`, monitor: null, fund: null, weight: null, asset: null, todo: null };

  // 1. 监控任务：每个用户按自己 push_config(module=monitor) 的时间执行其启用任务
  try {
    const cfgs = await storage.push.listEnabledByModule('monitor');
    let total = 0;
    for (const cfg of cfgs) {
      if (!manual && !shouldRun('monitor', cfg, now)) continue;
      const tasks = (await storage.monitor.listByUser(cfg.user_id)).filter(t => t.enabled);
      if (tasks.length === 0) continue;
      await executeTasksAndNotify(env, storage, tasks, tzOffset, manual ? 'manual' : 'cron');
      total += tasks.length;
    }
    summary.monitor = { count: total };
  } catch (err) { summary.monitor = { error: err.message }; }

  // 2. 基金净值刷新（每天 15 点刷一次缓存）+ 基金日报（按各用户配置时间）
  try {
    if (manual || now.hour === 15) {
      const codes = await storage.fund.listAllCodes();
      if (codes.length > 0) {
        const navMap = await fetchNavBatch(codes);
        for (const [code, nav] of navMap) await storage.fund.upsertNav(code, nav);
      }
      // 刷完净值后，为每个有持仓的用户记录当日总收益快照（同用户同日覆盖）
      await snapshotFundProfit(storage, now.dateStr);
    }
    summary.fund = await runModulePush(env, storage, 'fund', now, manual, tzOffset);
  } catch (err) { summary.fund = { error: err.message }; }

  // 3. 体重日报
  try { summary.weight = await runModulePush(env, storage, 'weight', now, manual, tzOffset); }
  catch (err) { summary.weight = { error: err.message }; }

  // 4. 资产月报
  try { summary.asset = await runModulePush(env, storage, 'asset', now, manual, tzOffset); }
  catch (err) { summary.asset = { error: err.message }; }

  // 5. 待办日报
  try { summary.todo = await runModulePush(env, storage, 'todo', now, manual, tzOffset); }
  catch (err) { summary.todo = { error: err.message }; }

  return json({ success: true, message: '定时调度执行完成', ...summary });
}

/**
 * 构造某模块推送的邮件主题（含推送时间）
 * @param {string} module - 'fund' | 'weight' | 'asset' | 'monitor'
 * @param {number} tzOffset - 时区偏移
 * @returns {string}
 */
function moduleSubject(module, tzOffset) {
  const at = fmtShort(Date.now(), tzOffset);
  switch (module) {
    case 'fund': return `📈 基金持仓日报 ${at}`;
    case 'weight': return `⚖️ 体重日报 ${at}`;
    case 'asset': return `💰 资产月报 ${at}`;
    case 'todo': return `📝 待办日报 ${at}`;
    case 'monitor': return `🌅 定时任务执行报告 ${at}`;
    default: return `定时任务执行报告 ${at}`;
  }
}

/**
 * 执行某模块所有已启用且到点的用户推送
 * @param {Object} env
 * @param {Object} storage
 * @param {string} module - 'fund' | 'weight' | 'asset'
 * @param {Object} now - nowCN 结果
 * @param {boolean} manual - 手动触发则忽略时间判断
 * @param {number} tzOffset - 时区偏移
 * @returns {Promise<Object>} { sent }
 */
async function runModulePush(env, storage, module, now, manual, tzOffset) {
  const configs = await storage.push.listEnabledByModule(module);
  const sent = [];
  for (const cfg of configs) {
    if (!manual && !shouldRun(module, cfg, now)) continue;
    const channelIds = parseChannelIds(cfg);
    if (!channelIds.length) continue;
    const format = cfg.format || 'text';
    // 待办分档提醒语用：当天第几次/共几次推送（manual 全量触发无确切序号，置 null 不显示）
    const pushSeq = (module === 'todo' && !manual) ? pushSeqOf(cfg, now) : null;
    // 按渠道有效格式生成消息并缓存（同一有效格式只生成一次）
    const msgCache = {};
    for (const cid of channelIds) {
      const channel = await storage.notify.findById(cid);
      if (!channel || !channel.enabled) continue;
      const fmt = effectiveFormat(format, channel.type);
      if (!(fmt in msgCache)) {
        msgCache[fmt] = await buildModuleMessage(env, storage, module, cfg.user_id, fmt, tzOffset, pushSeq);
      }
      const message = msgCache[fmt];
      if (!message) continue;
      const r = await sendNotification(message, channel, fmt, moduleSubject(module, tzOffset));
      sent.push({ user_id: cfg.user_id, channel_id: cid, ...r });
      // 推送日志: 定时触发; manual 全量重放时(/cron) trigger_by 记为 'manual'
      await storage.pushLog.add({
        user_id: cfg.user_id, module,
        channel_id: cid, channel_name: channel.name, channel_type: channel.type,
        format: fmt, trigger_by: manual ? 'manual' : 'cron',
        success: !!r.success, error: r.success ? null : r.message
      }).catch(() => {});
    }
  }
  return { sent };
}

/**
 * 从推送配置解析绑定的渠道 id 列表（channel_ids 多值优先，回退旧 channel_id 单值）
 * @param {Object} cfg - push_config 行
 * @returns {number[]}
 */
function parseChannelIds(cfg) {
  const raw = cfg.channel_ids != null && cfg.channel_ids !== '' ? cfg.channel_ids : cfg.channel_id;
  if (raw == null || raw === '') return [];
  return [...new Set(String(raw).split(',').map(s => parseInt(s, 10)).filter(n => !isNaN(n)))];
}

/**
 * 计算当天推送序号：此刻是配置时间点里的第几次 / 共几次（用于待办分档提醒语）
 * hours 逗号分隔多值，升序去重后，seq = ≤ now.hour 的时间点个数，total = 时间点总数
 * @param {Object} cfg - push_config 行（含 hours/hour）
 * @param {Object} now - nowCN() 结果，取 now.hour
 * @returns {{seq:number, total:number}}
 */
function pushSeqOf(cfg, now) {
  const hoursStr = cfg.hours != null && cfg.hours !== '' ? String(cfg.hours) : String(cfg.hour != null ? cfg.hour : 9);
  const hours = [...new Set(hoursStr.split(',').map(s => parseInt(s, 10)).filter(n => !isNaN(n)))].sort((a, b) => a - b);
  const total = hours.length;
  const seq = hours.filter(h => h <= now.hour).length;
  return { seq, total };
}

/**
 * 构造某模块某用户的推送消息（text/html，html 附 QuickChart 图）
 * @param {number} tzOffset - 时区偏移（小时）
 * @returns {Promise<string|null>} 无数据返回 null
 */
async function buildModuleMessage(env, storage, module, userId, format, tzOffset = 8, pushSeq = null) {
  if (module === 'fund') {
    const funds = await storage.fund.listByUser(userId);
    if (funds.length === 0) return null;
    const navMap = await fetchNavBatch(funds.map(f => f.code));
    for (const [code, nav] of navMap) await storage.fund.upsertNav(code, nav);
    // 本次失败的 code 用 fund_nav_cache 上次快照兜底, 避免 0 净值导致 -本金
    const fallback = await enrichNavWithCache(storage, funds, navMap);
    const portfolio = buildPortfolio(funds, navMap, fallback);
    const linkMap = await buildShareLinkMap(env, storage, funds);
    // 持仓分布饼图免密报告页链接
    let reportLink = '';
    const base = await resolveBaseUrl(storage, env);
    if (base) {
      const reportToken = await storage.push.ensureReportToken(userId, 'fund', generateToken());
      reportLink = `${base}/fr/${reportToken}`;
    }
    // 推送即更新当天总收益快照（同用户同日覆盖，靠 UNIQUE 约束保证每天一条），
    // 使"较昨日"与每日明细在任意推送时点都是最新，不必等 15 点调度
    const today = nowCN(Date.now(), tzOffset).dateStr;
    await storage.fund.upsertProfitDaily(userId, today, {
      cost: portfolio.totals.cost, value: portfolio.totals.value, profit: portfolio.totals.profit
    });
    const profitDelta = await getFundProfitDelta(storage, userId);
    return buildFundReport(portfolio, format, linkMap, tzOffset, reportLink, profitDelta);
  }
  if (module === 'weight') {
    const members = await storage.weight.listMembers(userId);
    const records = await storage.weight.listRecords(userId);
    if (members.length === 0) return null;
    const user = await storage.users.findById(userId);
    const unit = (user && user.weight_unit) || 'jin';
    const base = await resolveBaseUrl(storage, env);
    const today = nowCN(Date.now(), tzOffset).dateStr;
    // 每个成员确保有 share_token（未填当日时用于快速填写链接）
    const tokenMap = {};
    for (const m of members) {
      let tk = m.share_token;
      if (!tk) { tk = generateToken(); await storage.weight.setMemberShareToken(m.id, tk); }
      tokenMap[m.id] = tk;
    }
    // 用户级报告 token（查看曲线图）
    let reportToken = null;
    if (base) reportToken = await storage.push.ensureReportToken(userId, 'weight', generateToken());
    return buildWeightReport(members, records, { format, unit, base, today, tokenMap, reportToken });
  }
  if (module === 'asset') {
    const wallets = await storage.asset.listWallets(userId);
    const records = await storage.asset.listRecords(userId);
    if (records.length === 0) return null;
    const data = buildAssetReportData(wallets, records);
    // 年度目标（若已设置，用于报告显示"离目标还差多少"）
    const year = nowCN(Date.now(), tzOffset).dateStr.slice(0, 4);
    const goalRow = await storage.asset.getGoal(userId, year);
    const target = goalRow ? goalRow.target_amount : null;
    const base = await resolveBaseUrl(storage, env);
    let chartLink = '';
    // 每个钱包的免密录入链接（无 token 则生成持久化）；html 展示，text 默认不显示
    const walletLinkMap = {};
    if (base) {
      for (const w of wallets) {
        let tk = w.share_token;
        if (!tk) { tk = generateToken(); await storage.asset.setWalletShareToken(w.id, tk); }
        walletLinkMap[w.id] = `${base}/a/${tk}`;
      }
      const reportToken = await storage.push.ensureReportToken(userId, 'asset', generateToken());
      const link = `${base}/ar/${reportToken}`;
      if (format === 'html') chartLink = `<p>📈 <a href="${link}">查看净资产趋势图</a></p>`;
      else if (format === 'markdown') chartLink = `\n[📈 查看净资产趋势图](${link})\n`;
      else chartLink = `\n📈 查看趋势图：${link}\n`;
    }
    return buildAssetReport(data, format, chartLink, target, walletLinkMap);
  }
  if (module === 'todo') {
    const rows = await storage.todo.listByUser(userId);
    const today = nowCN(Date.now(), tzOffset).dateStr;
    const pendingTrees = flattenPending(buildTree(rows));
    // 仅当存在"截止今天或已逾期"的未完成任务时才推送，否则跳过（不发空日报）
    if (filterTodayOverdue(pendingTrees, today).length === 0) return null;
    const base = await resolveBaseUrl(storage, env);
    // 用户级报告 token：汇总协作页(/tc/)与查看全部(/tr/)共用
    let reportToken = null;
    if (base) reportToken = await storage.push.ensureReportToken(userId, 'todo', generateToken());
    return buildTodoReport(pendingTrees, { format, base, reportToken, today, seq: pushSeq && pushSeq.seq, total: pushSeq && pushSeq.total });
  }
  return null;
}

/**
 * 为一批持仓生成 { fundId: 免密加仓链接 }，无 token 的自动生成并持久化
 * @param {Object} env
 * @param {Object} storage
 * @param {Array} funds
 * @returns {Promise<Object>}
 */
async function buildShareLinkMap(env, storage, funds) {
  const base = await resolveBaseUrl(storage, env);
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

/**
 * 为所有有持仓的用户记录当日总收益快照（同用户同日覆盖）
 * @param {Object} storage
 * @param {string} dateStr - 北京时区当日 YYYY-MM-DD
 */
async function snapshotFundProfit(storage, dateStr) {
  const userIds = await storage.fund.listUserIdsWithFunds();
  for (const uid of userIds) {
    const funds = await storage.fund.listByUser(uid);
    if (funds.length === 0) continue;
    const navMap = new Map();
    for (const f of funds) {
      const nav = await storage.fund.getNav(f.code);
      // 只把有效净值(nav 或 gsz > 0)塞入; 无效值让 buildPortfolio 内部走 cost_nav 兜底,
      // 避免历史被 0 污染的缓存把当日 value 计算成 0 -> profit=-本金
      if (nav && ((+nav.nav > 0) || (+nav.gsz > 0))) {
        navMap.set(f.code, { nav: +nav.nav || 0, gsz: +nav.gsz || 0, navDate: nav.nav_date });
      }
    }
    const { totals } = buildPortfolio(funds, navMap);
    await storage.fund.upsertProfitDaily(uid, dateStr, { cost: totals.cost, value: totals.value, profit: totals.profit });
  }
}

/**
 * 读取用户今日总收益较昨日差额（供推送展示）
 * @param {Object} storage
 * @param {number} userId
 * @returns {Promise<Object|null>} { today, yesterday, delta } 或 null（不足两条）
 */
async function getFundProfitDelta(storage, userId) {
  const rows = await storage.fund.getLatestTwoProfit(userId);
  if (!rows || rows.length < 2) return null;
  const today = rows[0].profit;
  const yesterday = rows[1].profit;
  return { today, yesterday, delta: today - yesterday };
}

export default {
  async fetch(request, env, ctx) {
    try {
      // 平台无关的定时触发入口：GET/POST /cron?key=CRON_SECRET
      // 供非 Cloudflare 平台（Node/crontab 等）每小时调用一次
      const cronUrl = new URL(request.url);
      if (cronUrl.pathname === '/cron') {
        if (env.CRON_SECRET && cronUrl.searchParams.get('key') !== env.CRON_SECRET) {
          return json({ success: false, message: 'invalid key' }, 403);
        }
        return await handleScheduled(null, env, ctx);
      }

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
