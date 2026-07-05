/**
 * 基金追踪 API（当前登录用户）
 * 持仓 CRUD、报表数据（含实时净值收益）、日报配置、手动发送日报
 */

import { json, error } from '../router.js';
import { getStorage } from '../storage/adapter.js';
import { requireAuth } from '../auth/middleware.js';
import { fetchFundNav, fetchNavBatch, buildPortfolio, buildFundReport } from '../services/fund.service.js';
import { sendNotification } from '../services/notify.service.js';

/** 校验持仓字段 */
function validateFund(f) {
  if (!f.code || !/^\d{6}$/.test(String(f.code))) return '请填写 6 位基金代码';
  if (f.shares == null || isNaN(parseFloat(f.shares)) || parseFloat(f.shares) < 0) return '份额需为非负数';
  if (f.cost_nav == null || isNaN(parseFloat(f.cost_nav)) || parseFloat(f.cost_nav) < 0) return '成本净值需为非负数';
  return null;
}

/** GET /api/fund/list  持仓列表（不含实时净值，轻量） */
async function listFunds({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const funds = await storage.fund.listByUser(auth.user_id);
  return json({ success: true, funds });
}

/** POST /api/fund  新增持仓（自动补全名称） */
async function createFund({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  const invalid = validateFund(body);
  if (invalid) return error(invalid);

  const storage = getStorage(env);
  // 拉一次净值补全名称
  const nav = await fetchFundNav(body.code);
  const payload = {
    code: body.code,
    name: body.name || (nav && nav.name) || '',
    shares: parseFloat(body.shares),
    cost_nav: parseFloat(body.cost_nav)
  };
  const id = await storage.fund.create(auth.user_id, payload);
  if (nav) await storage.fund.upsertNav(nav.code, nav);
  return json({ success: true, message: '持仓已添加', id });
}

/** PUT /api/fund/:id  更新持仓 */
async function updateFund({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  const invalid = validateFund(body);
  if (invalid) return error(invalid);

  const storage = getStorage(env);
  const id = parseInt(params.id, 10);
  const existing = await storage.fund.findById(id);
  if (!existing || existing.user_id !== auth.user_id) return error('持仓不存在', 404);

  await storage.fund.update(id, auth.user_id, {
    code: body.code,
    name: body.name || existing.name || '',
    shares: parseFloat(body.shares),
    cost_nav: parseFloat(body.cost_nav)
  });
  return json({ success: true, message: '持仓已更新' });
}

/** DELETE /api/fund/:id  删除持仓 */
async function removeFund({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const id = parseInt(params.id, 10);
  const existing = await storage.fund.findById(id);
  if (!existing || existing.user_id !== auth.user_id) return error('持仓不存在', 404);
  await storage.fund.remove(id, auth.user_id);
  return json({ success: true, message: '持仓已删除' });
}

/** GET /api/fund/report  报表数据（实时拉净值+计算收益） */
async function fundReport({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const funds = await storage.fund.listByUser(auth.user_id);
  if (funds.length === 0) return json({ success: true, items: [], totals: { cost: 0, value: 0, profit: 0, rate: 0 } });

  const navMap = await fetchNavBatch(funds.map(f => f.code));
  // 顺带更新净值缓存
  for (const [code, nav] of navMap) await storage.fund.upsertNav(code, nav);

  const portfolio = buildPortfolio(funds, navMap);
  return json({ success: true, ...portfolio });
}

/** GET /api/fund/report-config  读取日报配置 */
async function getReportConfig({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const config = await storage.fund.getReportConfig(auth.user_id);
  return json({ success: true, config: config || { channel_id: null, format: 'text', enabled: 0 } });
}

/** PUT /api/fund/report-config  保存日报配置 */
async function setReportConfig({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  const storage = getStorage(env);
  if (body.channel_id) {
    const ch = await storage.notify.findById(parseInt(body.channel_id, 10));
    if (!ch || ch.user_id !== auth.user_id) return error('通知渠道不存在', 400);
  }
  await storage.fund.setReportConfig(auth.user_id, {
    channel_id: body.channel_id || null,
    format: body.format === 'html' ? 'html' : 'text',
    enabled: !!body.enabled
  });
  return json({ success: true, message: '日报配置已保存' });
}

/** POST /api/fund/report/send  手动发送一次日报 */
async function sendReport({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);

  const config = await storage.fund.getReportConfig(auth.user_id);
  if (!config || !config.channel_id) return error('请先配置日报通知渠道', 400);
  const channel = await storage.notify.findById(config.channel_id);
  if (!channel || channel.user_id !== auth.user_id) return error('通知渠道不存在', 400);

  const funds = await storage.fund.listByUser(auth.user_id);
  if (funds.length === 0) return error('暂无持仓，无法生成日报', 400);

  const navMap = await fetchNavBatch(funds.map(f => f.code));
  const portfolio = buildPortfolio(funds, navMap);
  const format = config.format || 'text';
  const message = buildFundReport(portfolio, format);
  const result = await sendNotification(message, channel, format);
  return json({ success: result.success, message: result.message });
}

export {
  listFunds, createFund, updateFund, removeFund,
  fundReport, getReportConfig, setReportConfig, sendReport
};
