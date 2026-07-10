/**
 * 资产报表 API
 * 钱包 CRUD、月度记录录入、报表、年度目标、免密录入
 */

import { json, error } from '../router.js';
import { getStorage } from '../storage/adapter.js';
import { requireAuth } from '../auth/middleware.js';
import { generateToken } from '../auth/password.js';
import { buildAssetReportData, calcGoalProgress, resolveInvestment, CREDIT_TYPE } from '../services/asset.service.js';
import { resolveBaseUrl } from '../config.js';

const WALLET_TYPES = ['bank', 'alipay', 'wechat', 'investment', 'credit', 'cash'];

/** 北京时区当前月 YYYY-MM */
function currentMonth() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 7);
}
/** 当前年份 */
function currentYear() {
  return currentMonth().slice(0, 4);
}

/** 计算某钱包录入记录字段（投资=输入总资产+收益, 反算本金；其余直接用 balance） */
function resolveRecordFields(type, body) {
  if (type === 'investment') {
    return resolveInvestment(body.total != null ? body.total : body.balance, body.profit);
  }
  return { balance: parseFloat(body.balance) || 0, principal: 0, profit: 0 };
}

// ==================== 钱包 ====================

/** GET /api/asset/wallets  钱包列表 */
async function listWallets({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const wallets = await storage.asset.listWallets(auth.user_id);
  return json({ success: true, wallets });
}

/** POST /api/asset/wallets  新建钱包  body: { type, name } */
async function createWallet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  if (!WALLET_TYPES.includes(body.type)) return error('钱包类型非法');
  const name = (body.name || '').trim();
  if (!name) return error('请填写钱包名称');
  const storage = getStorage(env);
  const id = await storage.asset.createWallet(auth.user_id, { type: body.type, name });
  return json({ success: true, message: '钱包已创建', id });
}

/** PUT /api/asset/wallets/:id  更新钱包  body: { type, name } */
async function updateWallet({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  if (!WALLET_TYPES.includes(body.type)) return error('钱包类型非法');
  const name = (body.name || '').trim();
  if (!name) return error('请填写钱包名称');
  const storage = getStorage(env);
  const id = parseInt(params.id, 10);
  const w = await storage.asset.findWallet(id);
  if (!w || w.user_id !== auth.user_id) return error('钱包不存在', 404);
  await storage.asset.updateWallet(id, auth.user_id, { type: body.type, name });
  return json({ success: true, message: '钱包已更新' });
}

/** DELETE /api/asset/wallets/:id  删除钱包 */
async function removeWallet({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const id = parseInt(params.id, 10);
  const w = await storage.asset.findWallet(id);
  if (!w || w.user_id !== auth.user_id) return error('钱包不存在', 404);
  await storage.asset.removeWallet(id, auth.user_id);
  return json({ success: true, message: '钱包已删除' });
}

/** GET /api/asset/wallets/:id/share-link  获取/生成钱包免密录入链接 */
async function getWalletShareLink({ request, env, params, url }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const id = parseInt(params.id, 10);
  const w = await storage.asset.findWallet(id);
  if (!w || w.user_id !== auth.user_id) return error('钱包不存在', 404);
  let token = w.share_token;
  // reset=1 时强制重置：重新生成 token 覆盖旧值，旧链接立即失效
  if (!token || url.searchParams.get('reset')) {
    token = generateToken();
    await storage.asset.setWalletShareToken(id, token);
  }
  const base = await resolveBaseUrl(storage, env, url);
  return json({ success: true, token, link: `${base}/a/${token}` });
}

// ==================== 记录 ====================

/** POST /api/asset/records  录入某钱包某月记录（新增一条，同钱包同月允许多条）
 * body: { wallet_id, month?, balance? | total?, profit? }
 */
async function saveRecord({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  const storage = getStorage(env);
  const walletId = parseInt(body.wallet_id, 10);
  const w = await storage.asset.findWallet(walletId);
  if (!w || w.user_id !== auth.user_id) return error('钱包不存在', 404);

  const month = body.month || currentMonth();
  if (!/^\d{4}-\d{2}$/.test(month)) return error('月份格式应为 YYYY-MM');
  const fields = resolveRecordFields(w.type, body);
  await storage.asset.addRecord({ wallet_id: walletId, user_id: auth.user_id, month, ...fields });
  return json({ success: true, message: '记录已保存' });
}

/** PUT /api/asset/records/:id  按 id 修改某条月度记录（可改月份）
 * body: { balance? | total?, profit?, month? }
 */
async function updateRecord({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const id = parseInt(params.id, 10);
  const rec = await storage.asset.findRecordById(id);
  if (!rec || rec.user_id !== auth.user_id) return error('记录不存在', 404);

  const w = await storage.asset.findWallet(rec.wallet_id);
  if (!w || w.user_id !== auth.user_id) return error('钱包不存在', 404);
  const body = await request.json().catch(() => ({}));
  const month = body.month || rec.month;
  if (!/^\d{4}-\d{2}$/.test(month)) return error('月份格式应为 YYYY-MM');
  const fields = resolveRecordFields(w.type, body);
  await storage.asset.updateRecordById(id, auth.user_id, { month, ...fields });
  return json({ success: true, message: '记录已更新' });
}

/** DELETE /api/asset/records/:id  删除某条月度记录 */
async function removeRecord({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const id = parseInt(params.id, 10);
  const rec = await storage.asset.findRecordById(id);
  if (!rec || rec.user_id !== auth.user_id) return error('记录不存在', 404);
  await storage.asset.removeRecord(id, auth.user_id);
  return json({ success: true, message: '记录已删除' });
}

/** GET /api/asset/report  报表数据（月度趋势 + 当前净资产 + 目标进度） */
async function assetReport({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const wallets = await storage.asset.listWallets(auth.user_id);
  const records = await storage.asset.listRecords(auth.user_id);
  const report = buildAssetReportData(wallets, records);

  const year = currentYear();
  const goalRow = await storage.asset.getGoal(auth.user_id, year);
  const goal = goalRow
    ? calcGoalProgress(goalRow.target_amount, report.latest.netWorth)
    : null;

  return json({ success: true, wallets, records, report, year, goal });
}

/** GET /api/asset/goal  读取当年目标 */
async function getGoal({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const year = currentYear();
  const row = await storage.asset.getGoal(auth.user_id, year);
  return json({ success: true, year, target_amount: row ? row.target_amount : 0 });
}

/** PUT /api/asset/goal  设置当年目标  body: { target_amount } */
async function setGoal({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  const amount = parseFloat(body.target_amount);
  if (isNaN(amount) || amount < 0) return error('请填写有效目标金额');
  const storage = getStorage(env);
  await storage.asset.setGoal(auth.user_id, currentYear(), amount);
  return json({ success: true, message: '目标已保存' });
}

// ==================== 免密录入 ====================

/** GET /api/public/asset/:token  免密查看钱包信息（供录入页）+ 当年该钱包月度余额曲线 */
async function publicWalletInfo({ env, params }) {
  const storage = getStorage(env);
  const w = await storage.asset.findWalletByShareToken(params.token);
  if (!w) return error('链接无效或已失效', 404);
  const month = currentMonth();
  const year = currentYear();
  // 当年该钱包各月余额（同钱包同月多条累加），按月升序，供录入页曲线
  const all = await storage.asset.listRecords(w.user_id);
  const sumByMonth = new Map();
  for (const r of all) {
    if (r.wallet_id !== w.id) continue;
    if (!(r.month || '').startsWith(year)) continue;
    sumByMonth.set(r.month, (sumByMonth.get(r.month) || 0) + (r.balance || 0));
  }
  const series = [...sumByMonth.entries()]
    .sort((a, b) => a[0] < b[0] ? -1 : 1)
    .map(([m, bal]) => ({ month: m, balance: Math.round((bal + Number.EPSILON) * 100) / 100 }));
  return json({
    success: true,
    wallet: { id: w.id, type: w.type, name: w.name },
    month, year, series
  });
}

/** POST /api/public/asset/:token  免密录入当月记录（新增一条，同月允许多条）
 * body: { balance? | total?, profit? }  月份锁当月
 */
async function publicSaveRecord({ request, env, params }) {
  const storage = getStorage(env);
  const w = await storage.asset.findWalletByShareToken(params.token);
  if (!w) return error('链接无效或已失效', 404);
  const body = await request.json().catch(() => ({}));
  const month = currentMonth();
  const fields = resolveRecordFields(w.type, body);
  await storage.asset.addRecord({ wallet_id: w.id, user_id: w.user_id, month, ...fields });
  return json({ success: true, message: '本月记录已保存' });
}

/** GET /api/public/asset-report/:token  免密查看资产趋势数据
 * token = push_config(module=asset).report_token
 */
async function publicAssetReport({ env, params }) {
  const storage = getStorage(env);
  const row = await storage.push.findByReportToken(params.token);
  if (!row || row.module !== 'asset') return error('链接无效或已失效', 404);
  const wallets = await storage.asset.listWallets(row.user_id);
  const records = await storage.asset.listRecords(row.user_id);
  const report = buildAssetReportData(wallets, records);
  return json({ success: true, report, wallets, records });
}

export {
  listWallets, createWallet, updateWallet, removeWallet, getWalletShareLink,
  saveRecord, updateRecord, removeRecord, assetReport, getGoal, setGoal,
  publicWalletInfo, publicSaveRecord, publicAssetReport
};
