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
import { register, login, logout, me, bootstrap, setupStatus, getProfile, updateProfile, changePassword } from './api/auth.api.js';
import {
  listUsers, getUserDetail, updateUserRole, updateUserStatus,
  createUser, resetPassword, impersonateUser, stopImpersonateUser, updateUserNickname
} from './api/users.api.js';
import { listChannels, createChannel, updateChannel, removeChannel } from './api/notify.api.js';
import { listTasks, createTask, updateTask, removeTask, listTaskLogs } from './api/monitor.api.js';
import {
  listFunds, createFund, updateFund, removeFund,
  fundReport, getReportConfig, setReportConfig, sendReport, fundAnalysis,
  getShareLink, fundScenario, publicFundInfo, publicFundBuy, buyFund
} from './api/fund.api.js';
import { fetchNavBatch, buildPortfolio, buildFundReport } from './services/fund.service.js';
import {
  listMembers, createMember, removeMember, getMemberShareLink,
  weightChart, addRecord, updateRecord, removeRecord,
  publicMemberInfo, publicSubmitWeight, publicWeightReport, adminCompare,
  getUnit, setUnit
} from './api/weight.api.js';
import {
  listWallets, createWallet, updateWallet, removeWallet, getWalletShareLink,
  saveRecord, assetReport, getGoal, setGoal,
  publicWalletInfo, publicSaveRecord, publicAssetReport
} from './api/asset.api.js';
import { buildAssetReportData, buildAssetReport } from './services/asset.service.js';
import { getPushConfig, setPushConfig } from './api/push.api.js';
import { shouldRun, nowCN } from './services/schedule.service.js';
import { buildChartUrl } from './services/chart.service.js';

// Pages
import {
  loginPage, dashboardPage, adminPage, setupPage, monitorPage, fundPage, publicBuyPage,
  weightPage, publicWeightPage, settingsPage, assetPage, publicAssetPage, channelsPage,
  weightReportPage, assetReportPage
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
router.get('/api/auth/setup-status', setupStatus);
router.post('/api/auth/bootstrap', bootstrap);

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

// --- 体重曲线 API ---
router.get('/api/weight/members', listMembers);
router.post('/api/weight/members', createMember);
router.get('/api/weight/members/:id/share-link', getMemberShareLink);
router.delete('/api/weight/members/:id', removeMember);
router.get('/api/weight/chart', weightChart);
router.get('/api/weight/unit', getUnit);
router.put('/api/weight/unit', setUnit);
router.post('/api/weight/records', addRecord);
router.put('/api/weight/records/:id', updateRecord);
router.delete('/api/weight/records/:id', removeRecord);
router.get('/api/admin/weight/compare', adminCompare);
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
router.get('/api/asset/report', assetReport);
router.get('/api/asset/goal', getGoal);
router.put('/api/asset/goal', setGoal);
router.get('/api/public/asset/:token', publicWalletInfo);
router.post('/api/public/asset/:token', publicSaveRecord);
router.get('/api/public/asset-report/:token', publicAssetReport);

// --- 通用推送配置 API ---
router.get('/api/push/:module', getPushConfig);
router.put('/api/push/:module', setPushConfig);
router.post('/api/push/:module/send', runMyModulePush);

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

  // 需登录页面
  const pageMap = {
    '/': 'dashboard', '/dashboard': 'dashboard',
    '/monitor': 'monitor',
    '/channels': 'channels',
    '/fund': 'fund',
    '/asset': 'asset',
    '/weight': 'weight',
    '/settings': 'settings',
    '/admin': 'admin'
  };
  if (path in pageMap) {
    const token = getTokenFromRequest(request);
    const session = await getSession(env, token);
    if (!session) {
      return new Response(null, { status: 302, headers: { Location: '/login' } });
    }
    const user = {
      id: session.user_id, username: session.username,
      nickname: session.nickname || session.username, role: session.role,
      impersonating: !!session.impersonating, admin_username: session.admin_username || null
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
  const tasks = (await storage.monitor.listByUser(session.user_id)).filter(t => t.enabled);
  if (tasks.length === 0) return json({ success: true, message: '没有启用的监控任务', results: [] });

  const result = await executeTasksAndNotify(env, storage, tasks);
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
  if (!['fund', 'weight', 'asset'].includes(module)) return error('模块非法', 400);

  const storage = getStorage(env);
  const cfg = await storage.push.getConfig(session.user_id, module);
  if (!cfg || !cfg.channel_id) return error('请先配置推送渠道', 400);
  const channel = await storage.notify.findById(cfg.channel_id);
  if (!channel || channel.user_id !== session.user_id) return error('通知渠道不存在', 400);
  if (!channel.enabled) return error('通知渠道已停用', 400);

  const format = cfg.format || 'text';
  const message = await buildModuleMessage(env, storage, module, session.user_id, format);
  if (!message) return error('暂无数据，无法生成推送内容', 400);
  const r = await sendNotification(message, channel, format);
  return json({ success: true, message: '已推送', result: r });
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

  // 分流：standalone 任务单独发；其余按渠道合并
  const notified = [];
  const standaloneResults = results.filter(r => r.standalone && r.channel_id);
  const mergeResults = results.filter(r => !r.standalone);

  // 独立发送：每条一个消息
  for (const r of standaloneResults) {
    const channel = await storage.notify.findById(parseInt(r.channel_id, 10));
    if (!channel || !channel.enabled) continue;
    const returnType = r.return_type || 'text';
    const message = formatResults([r], returnType);
    const sendResult = await sendNotification(message, channel, returnType);
    notified.push({ channelId: r.channel_id, standalone: true, ...sendResult });
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
    const message = formatResults(group, returnType);
    const sendResult = await sendNotification(message, channel, returnType);
    notified.push({ channelId, ...sendResult });
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
  const now = nowCN(Date.now());
  const manual = !cron; // /cron 手动调用时 cron 为空，全部执行
  const summary = { at: `${now.dateStr} ${now.hour}:00`, monitor: null, fund: null, weight: null, asset: null };

  // 1. 监控任务：每个用户按自己 push_config(module=monitor) 的时间执行其启用任务
  try {
    const cfgs = await storage.push.listEnabledByModule('monitor');
    let total = 0;
    for (const cfg of cfgs) {
      if (!manual && !shouldRun('monitor', cfg, now)) continue;
      const tasks = (await storage.monitor.listByUser(cfg.user_id)).filter(t => t.enabled);
      if (tasks.length === 0) continue;
      await executeTasksAndNotify(env, storage, tasks);
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
    }
    summary.fund = await runModulePush(env, storage, 'fund', now, manual);
  } catch (err) { summary.fund = { error: err.message }; }

  // 3. 体重日报
  try { summary.weight = await runModulePush(env, storage, 'weight', now, manual); }
  catch (err) { summary.weight = { error: err.message }; }

  // 4. 资产月报
  try { summary.asset = await runModulePush(env, storage, 'asset', now, manual); }
  catch (err) { summary.asset = { error: err.message }; }

  return json({ success: true, message: '定时调度执行完成', ...summary });
}

/**
 * 执行某模块所有已启用且到点的用户推送
 * @param {Object} env
 * @param {Object} storage
 * @param {string} module - 'fund' | 'weight' | 'asset'
 * @param {Object} now - nowCN 结果
 * @param {boolean} manual - 手动触发则忽略时间判断
 * @returns {Promise<Object>} { sent }
 */
async function runModulePush(env, storage, module, now, manual) {
  const configs = await storage.push.listEnabledByModule(module);
  const sent = [];
  for (const cfg of configs) {
    if (!manual && !shouldRun(module, cfg, now)) continue;
    if (!cfg.channel_id) continue;
    const channel = await storage.notify.findById(cfg.channel_id);
    if (!channel || !channel.enabled) continue;
    const format = cfg.format || 'text';
    const message = await buildModuleMessage(env, storage, module, cfg.user_id, format);
    if (!message) continue;
    const r = await sendNotification(message, channel, format);
    sent.push({ user_id: cfg.user_id, ...r });
  }
  return { sent };
}

/**
 * 构造某模块某用户的推送消息（text/html，html 附 QuickChart 图）
 * @returns {Promise<string|null>} 无数据返回 null
 */
async function buildModuleMessage(env, storage, module, userId, format) {
  if (module === 'fund') {
    const funds = await storage.fund.listByUser(userId);
    if (funds.length === 0) return null;
    const navMap = await fetchNavBatch(funds.map(f => f.code));
    for (const [code, nav] of navMap) await storage.fund.upsertNav(code, nav);
    const portfolio = buildPortfolio(funds, navMap);
    const linkMap = await buildShareLinkMap(env, storage, funds);
    let msg = buildFundReport(portfolio, format, linkMap);
    if (format === 'html') {
      const labels = portfolio.items.map(i => i.name);
      const data = portfolio.items.map(i => i.value);
      msg += `<div><img src="${buildChartUrl({ type: 'doughnut', data: { labels, datasets: [{ data }] } })}" alt="持仓分布"></div>`;
    }
    return msg;
  }
  if (module === 'weight') {
    const members = await storage.weight.listMembers(userId);
    const records = await storage.weight.listRecords(userId);
    if (members.length === 0) return null;
    const user = await storage.users.findById(userId);
    const unit = (user && user.weight_unit) || 'jin';
    const base = env.PUBLIC_BASE_URL || '';
    const today = nowCN(Date.now()).dateStr;
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
    const base = env.PUBLIC_BASE_URL || '';
    let chartLink = '';
    if (base) {
      const reportToken = await storage.push.ensureReportToken(userId, 'asset', generateToken());
      const link = `${base}/ar/${reportToken}`;
      chartLink = format === 'html'
        ? `<p>📈 <a href="${link}">查看净资产趋势图</a></p>`
        : `\n📈 查看趋势图：${link}\n`;
    }
    return buildAssetReport(data, format, chartLink);
  }
  return null;
}

/**
 * 构造体重日报
 * 每个成员：已填当日则显示当日体重，未填则给快速填写链接；附最近7次历史；单位按用户设置；曲线给查看链接
 * @param {Array} members
 * @param {Array} records
 * @param {Object} opts - { format, unit, base, today, tokenMap, reportToken }
 * @returns {string}
 */
function buildWeightReport(members, records, opts) {
  const { format, unit, base, today, tokenMap, reportToken } = opts;
  const unitLabel = unit === 'kg' ? '公斤' : '斤';
  const disp = kg => unit === 'jin' ? Math.round(kg * 2 * 10) / 10 : kg;
  // 按成员分组、按日期排序
  const byMember = new Map();
  for (const r of records) {
    if (!byMember.has(r.member_id)) byMember.set(r.member_id, []);
    byMember.get(r.member_id).push(r);
  }
  for (const arr of byMember.values()) arr.sort((a, b) => a.record_date < b.record_date ? -1 : 1);

  const isHtml = format === 'html';
  const parts = [];
  for (const m of members) {
    const arr = byMember.get(m.id) || [];
    const todayRec = arr.find(r => r.record_date === today);
    const last7 = arr.slice(-7);
    let block = '';
    if (isHtml) {
      block += `<div style="margin:10px 0;padding:10px;background:#f8f9fa;border-radius:6px;">`;
      block += `<b>${m.name}</b><br>`;
      if (todayRec) {
        block += `今日：${disp(todayRec.weight)} ${unitLabel}<br>`;
      } else if (base) {
        block += `<span style="color:#cf1322;">今日未填</span> · <a href="${base}/w/${tokenMap[m.id]}">点此快速填写</a><br>`;
      } else {
        block += `今日未填<br>`;
      }
      if (last7.length) {
        block += `<span style="color:#888;font-size:13px;">最近记录：` +
          last7.map(r => `${r.record_date.slice(5)} ${disp(r.weight)}`).join(' · ') + ` ${unitLabel}</span>`;
      }
      block += `</div>`;
    } else {
      block += `【${m.name}】\n`;
      if (todayRec) block += `  今日：${disp(todayRec.weight)} ${unitLabel}\n`;
      else if (base) block += `  今日未填，快速填写：${base}/w/${tokenMap[m.id]}\n`;
      else block += `  今日未填\n`;
      if (last7.length) {
        block += `  最近：` + last7.map(r => `${r.record_date.slice(5)} ${disp(r.weight)}`).join(' · ') + ` ${unitLabel}\n`;
      }
    }
    parts.push(block);
  }

  if (isHtml) {
    let h = `<div style="font-family:-apple-system,sans-serif;max-width:600px;"><h2>⚖️ 体重日报</h2>`;
    h += parts.join('');
    if (base && reportToken) h += `<p>📈 <a href="${base}/wr/${reportToken}">查看完整曲线图</a></p>`;
    h += `</div>`;
    return h;
  }
  let t = `⚖️ 体重日报\n\n` + parts.join('\n');
  if (base && reportToken) t += `\n📈 查看曲线图：${base}/wr/${reportToken}\n`;
  return t;
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
