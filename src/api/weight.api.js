/**
 * 体重曲线 API
 * 成员 CRUD、记录增改删、曲线数据、免密快速填写、超管多用户对比
 */

import { json, error } from '../router.js';
import { getStorage } from '../storage/adapter.js';
import { requireAuth, requireAdmin } from '../auth/middleware.js';
import { generateToken } from '../auth/password.js';

/** 取北京时区当天 YYYY-MM-DD */
function todayCN() {
  const now = new Date(Date.now() + 8 * 3600 * 1000); // UTC+8
  return now.toISOString().slice(0, 10);
}

/** 计算坚持天数（从首次记录日期至今，含当天） */
function daysSince(firstDate) {
  if (!firstDate) return 1;
  const start = new Date(firstDate + 'T00:00:00Z');
  const today = new Date(todayCN() + 'T00:00:00Z');
  const diff = Math.floor((today - start) / (24 * 3600 * 1000)) + 1;
  return diff > 0 ? diff : 1;
}

/** 根据坚持天数生成鼓励标题 */
function streakTitle(days) {
  if (days <= 1) return '开始记录第 1 天，加油！';
  if (days < 7) return `已坚持 ${days} 天，继续保持！`;
  if (days < 30) return `已坚持 ${days} 天，习惯正在养成！`;
  if (days < 100) return `已坚持 ${days} 天，非常棒！`;
  return `已坚持 ${days} 天，了不起的毅力！`;
}

// ==================== 成员 ====================

/** GET /api/weight/members  列出成员 */
async function listMembers({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const members = await storage.weight.listMembers(auth.user_id);
  return json({ success: true, members });
}

/** POST /api/weight/members  新建成员  body: { name } */
async function createMember({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  const name = (body.name || '').trim();
  if (!name) return error('请填写成员名称');
  const storage = getStorage(env);
  const id = await storage.weight.createMember(auth.user_id, name);
  return json({ success: true, message: '成员已添加', id });
}

/** DELETE /api/weight/members/:id  删除成员 */
async function removeMember({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const id = parseInt(params.id, 10);
  const m = await storage.weight.findMember(id);
  if (!m || m.user_id !== auth.user_id) return error('成员不存在', 404);
  await storage.weight.removeMember(id, auth.user_id);
  return json({ success: true, message: '成员已删除' });
}

/** GET /api/weight/members/:id/share-link  获取/生成成员免密填写链接 */
async function getMemberShareLink({ request, env, params, url }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const id = parseInt(params.id, 10);
  const m = await storage.weight.findMember(id);
  if (!m || m.user_id !== auth.user_id) return error('成员不存在', 404);

  let token = m.share_token;
  if (!token) {
    token = generateToken();
    await storage.weight.setMemberShareToken(id, token);
  }
  const base = env.PUBLIC_BASE_URL || url.origin;
  return json({ success: true, token, link: `${base}/w/${token}` });
}

// ==================== 记录 ====================

/** GET /api/weight/chart  当前用户所有成员的曲线数据 */
async function weightChart({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const members = await storage.weight.listMembers(auth.user_id);
  const records = await storage.weight.listRecords(auth.user_id);
  return json({ success: true, members, records });
}

/** POST /api/weight/records  新增/更新记录（同一成员同一天覆盖）
 * body: { member_id, weight, record_date?, note? }
 */
async function addRecord({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  const memberId = parseInt(body.member_id, 10);
  const weight = parseFloat(body.weight);
  if (isNaN(weight) || weight <= 0) return error('请填写有效体重');

  const storage = getStorage(env);
  const m = await storage.weight.findMember(memberId);
  if (!m || m.user_id !== auth.user_id) return error('成员不存在', 404);

  const date = body.record_date || todayCN();
  const existing = await storage.weight.findRecordByMemberDate(memberId, date);
  if (existing) {
    await storage.weight.updateRecord(existing.id, weight, body.note);
    return json({ success: true, message: '记录已更新', id: existing.id });
  }
  const id = await storage.weight.addRecord({
    member_id: memberId, user_id: auth.user_id, weight, record_date: date, note: body.note
  });
  return json({ success: true, message: '记录已添加', id });
}

/** PUT /api/weight/records/:id  修改记录（本人）  body: { weight, note? } */
async function updateRecord({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  const weight = parseFloat(body.weight);
  if (isNaN(weight) || weight <= 0) return error('请填写有效体重');

  const storage = getStorage(env);
  const id = parseInt(params.id, 10);
  const rec = await storage.weight.findRecord(id);
  if (!rec || rec.user_id !== auth.user_id) return error('记录不存在', 404);
  await storage.weight.updateRecord(id, weight, body.note);
  return json({ success: true, message: '记录已更新' });
}

/** DELETE /api/weight/records/:id  删除记录 */
async function removeRecord({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const id = parseInt(params.id, 10);
  const rec = await storage.weight.findRecord(id);
  if (!rec || rec.user_id !== auth.user_id) return error('记录不存在', 404);
  await storage.weight.removeRecord(id, auth.user_id);
  return json({ success: true, message: '记录已删除' });
}

// ==================== 免密公开 ====================

/** GET /api/public/weight/:token  免密查看成员信息与历史（供快速填写页） */
async function publicMemberInfo({ env, params }) {
  const storage = getStorage(env);
  const m = await storage.weight.findMemberByShareToken(params.token);
  if (!m) return error('链接无效或已失效', 404);

  const firstDate = await storage.weight.getMemberFirstDate(m.id);
  const days = daysSince(firstDate);
  const records = await storage.weight.listRecords(m.user_id, m.id);
  const today = todayCN();
  const todayRecord = records.find(r => r.record_date === today);
  return json({
    success: true,
    member: { id: m.id, name: m.name },
    today, days, title: streakTitle(days),
    todayWeight: todayRecord ? todayRecord.weight : null,
    records
  });
}

/** POST /api/public/weight/:token  免密提交当天体重（日期锁定当天）
 * body: { weight, note? }
 */
async function publicSubmitWeight({ request, env, params }) {
  const storage = getStorage(env);
  const m = await storage.weight.findMemberByShareToken(params.token);
  if (!m) return error('链接无效或已失效', 404);

  const body = await request.json().catch(() => ({}));
  const weight = parseFloat(body.weight);
  if (isNaN(weight) || weight <= 0) return error('请填写有效体重');

  const date = todayCN(); // 强制当天，不接受前端传入
  const existing = await storage.weight.findRecordByMemberDate(m.id, date);
  if (existing) {
    await storage.weight.updateRecord(existing.id, weight, body.note);
  } else {
    await storage.weight.addRecord({
      member_id: m.id, user_id: m.user_id, weight, record_date: date, note: body.note
    });
  }
  return json({ success: true, message: '已记录今日体重' });
}

// ==================== 超管对比 ====================

/** GET /api/admin/weight/compare?userIds=1,2,3  多用户体重对比曲线 */
async function adminCompare({ request, env, url }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;
  const raw = url.searchParams.get('userIds') || '';
  const userIds = raw.split(',').map(s => parseInt(s, 10)).filter(n => !isNaN(n));
  if (userIds.length === 0) return json({ success: true, records: [] });

  const storage = getStorage(env);
  const records = await storage.weight.listRecordsByUsers(userIds);
  return json({ success: true, records });
}

export {
  listMembers, createMember, removeMember, getMemberShareLink,
  weightChart, addRecord, updateRecord, removeRecord,
  publicMemberInfo, publicSubmitWeight, adminCompare
};
