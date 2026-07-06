/**
 * 基金追踪 API（当前登录用户）
 * 持仓 CRUD、报表数据（含实时净值收益）、日报配置、手动发送日报
 */

import { json, error } from '../router.js';
import { getStorage } from '../storage/adapter.js';
import { requireAuth } from '../auth/middleware.js';
import { generateToken } from '../auth/password.js';
import {
  fetchFundNav, fetchNavBatch, buildPortfolio,
  analyzePortfolio, calcScenarios, applyBuy
} from '../services/fund.service.js';
import { sendNotification } from '../services/notify.service.js';
import { buildFundReport } from '../services/report.service.js';
import { parseOffset, fmtShort } from '../services/time.service.js';
import { resolveBaseUrl } from '../config.js';

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
  // 顺带更新净值缓存（并发写入）
  await Promise.all([...navMap].map(([code, nav]) => storage.fund.upsertNav(code, nav)));

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
async function sendReport({ request, env, url }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);

  const config = await storage.push.getConfig(auth.user_id, 'fund');
  if (!config || !config.channel_id) return error('请先配置日报通知渠道', 400);
  const channel = await storage.notify.findById(config.channel_id);
  if (!channel || channel.user_id !== auth.user_id) return error('通知渠道不存在', 400);

  const funds = await storage.fund.listByUser(auth.user_id);
  if (funds.length === 0) return error('暂无持仓，无法生成日报', 400);

  const navMap = await fetchNavBatch(funds.map(f => f.code));
  const portfolio = buildPortfolio(funds, navMap);
  const format = config.format || 'text';
  const tzOffset = parseOffset(await storage.settings.get('tz_offset'));

  // 生成每只基金的免密加仓链接（无 token 则生成持久化）
  const base = await resolveBaseUrl(storage, env, url);
  const linkMap = {};
  for (const f of funds) {
    let token = f.share_token;
    if (!token) { token = generateToken(); await storage.fund.setShareToken(f.id, token); }
    linkMap[f.id] = `${base}/f/${token}`;
  }
  const message = buildFundReport(portfolio, format, linkMap, tzOffset);
  const subject = `📈 基金持仓日报 ${fmtShort(Date.now(), tzOffset)}`;
  const result = await sendNotification(message, channel, format, subject);
  return json({ success: result.success, message: result.message });
}

/** GET /api/fund/analysis  规则化持仓分析（可带 stopLoss/takeProfit/concentration 查询参数） */
async function fundAnalysis({ request, env, url }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const funds = await storage.fund.listByUser(auth.user_id);
  if (funds.length === 0) {
    return json({ success: true, items: [], summary: [], rules: {}, disclaimer: '暂无持仓' });
  }
  const navMap = await fetchNavBatch(funds.map(f => f.code));
  const portfolio = buildPortfolio(funds, navMap);

  // 阈值可通过查询参数覆盖，非法则用默认
  const rules = {};
  const sl = parseFloat(url.searchParams.get('stopLoss'));
  const tp = parseFloat(url.searchParams.get('takeProfit'));
  const cc = parseFloat(url.searchParams.get('concentration'));
  if (!isNaN(sl)) rules.stopLoss = sl;
  if (!isNaN(tp)) rules.takeProfit = tp;
  if (!isNaN(cc)) rules.concentration = cc;

  const analysis = analyzePortfolio(portfolio, rules);
  return json({ success: true, ...analysis });
}

/** GET /api/fund/:id/share-link  获取/生成某持仓的免密加仓链接 */
async function getShareLink({ request, env, params, url }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const id = parseInt(params.id, 10);
  const fund = await storage.fund.findById(id);
  if (!fund || fund.user_id !== auth.user_id) return error('持仓不存在', 404);

  let token = fund.share_token;
  if (!token) {
    token = generateToken();
    await storage.fund.setShareToken(id, token);
  }
  const base = await resolveBaseUrl(storage, env, url);
  return json({ success: true, token, link: `${base}/f/${token}` });
}

/** POST /api/fund/scenario  情景测算（登录用户，非预测）
 * body: { amount, nav?, code?, scenarios?, takeProfit?, stopLoss? }
 * nav 缺省时用 code 实时拉取
 */
async function fundScenario({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  const amount = parseFloat(body.amount);
  if (isNaN(amount) || amount <= 0) return error('请填写有效的投入金额');

  let nav = parseFloat(body.nav);
  if (isNaN(nav) || nav <= 0) {
    if (!body.code) return error('请填写买入净值或基金代码');
    const info = await fetchFundNav(body.code);
    if (!info) return error('无法获取该基金净值，请手动填写买入净值');
    nav = info.gsz || info.nav;
  }

  const opts = {};
  if (Array.isArray(body.scenarios) && body.scenarios.length) {
    opts.scenarios = body.scenarios.map(Number).filter(n => !isNaN(n));
  }
  if (body.takeProfit != null && !isNaN(parseFloat(body.takeProfit))) opts.takeProfit = parseFloat(body.takeProfit);
  if (body.stopLoss != null && !isNaN(parseFloat(body.stopLoss))) opts.stopLoss = parseFloat(body.stopLoss);

  const result = calcScenarios(amount, nav, opts);
  return json({ success: true, ...result });
}

/** GET /api/public/fund/:token  免密查看基金信息（供加仓页展示） */
async function publicFundInfo({ env, params }) {
  const storage = getStorage(env);
  const fund = await storage.fund.findByShareToken(params.token);
  if (!fund) return error('链接无效或已失效', 404);

  const info = await fetchFundNav(fund.code);
  const currentNav = info ? (info.gsz || info.nav) : 0;
  return json({
    success: true,
    fund: {
      code: fund.code,
      name: (info && info.name) || fund.name || fund.code,
      shares: fund.shares,
      cost_nav: fund.cost_nav,
      current_nav: currentNav,
      gszzl: info ? info.gszzl : 0
    }
  });
}

/** POST /api/public/fund/:token/buy  免密加仓（按金额买入，累计份额并重算成本）
 * body: { amount, buyNav? }  buyNav 缺省用实时净值
 */
async function publicFundBuy({ request, env, params }) {
  const storage = getStorage(env);
  const fund = await storage.fund.findByShareToken(params.token);
  if (!fund) return error('链接无效或已失效', 404);

  const body = await request.json().catch(() => ({}));
  const amount = parseFloat(body.amount);
  if (isNaN(amount) || amount <= 0) return error('请填写有效的买入金额');

  let buyNav = parseFloat(body.buyNav);
  if (isNaN(buyNav) || buyNav <= 0) {
    const info = await fetchFundNav(fund.code);
    if (!info) return error('无法获取净值，请手动填写买入净值');
    buyNav = info.gsz || info.nav;
  }

  const res = applyBuy(fund, amount, buyNav);
  await storage.fund.updateHolding(fund.id, res.newShares, res.newCostNav);
  return json({
    success: true,
    message: '加仓成功',
    addShares: res.addShares,
    newShares: res.newShares,
    newCostNav: res.newCostNav,
    buyNav
  });
}

/** POST /api/fund/:id/buy  登录态页面内加仓（按金额买入，累计份额并重算成本）
 * body: { amount, buyNav? }  buyNav 缺省用实时净值
 */
async function buyFund({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const id = parseInt(params.id, 10);
  const fund = await storage.fund.findById(id);
  if (!fund || fund.user_id !== auth.user_id) return error('持仓不存在', 404);

  const body = await request.json().catch(() => ({}));
  const amount = parseFloat(body.amount);
  if (isNaN(amount) || amount <= 0) return error('请填写有效的买入金额');

  let buyNav = parseFloat(body.buyNav);
  if (isNaN(buyNav) || buyNav <= 0) {
    const info = await fetchFundNav(fund.code);
    if (!info) return error('无法获取净值，请手动填写买入净值');
    buyNav = info.gsz || info.nav;
  }

  const res = applyBuy(fund, amount, buyNav);
  await storage.fund.updateHolding(fund.id, res.newShares, res.newCostNav);
  return json({
    success: true, message: '加仓成功',
    addShares: res.addShares, newShares: res.newShares, newCostNav: res.newCostNav, buyNav
  });
}

export {
  listFunds, createFund, updateFund, removeFund,
  fundReport, getReportConfig, setReportConfig, sendReport, fundAnalysis,
  getShareLink, fundScenario, publicFundInfo, publicFundBuy, buyFund
};
