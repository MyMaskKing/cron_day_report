/**
 * 体重曲线 API
 * 成员 CRUD、记录增改删、曲线数据、免密快速填写、超管多用户对比
 */

import { json, error } from '../router.js';
import { getStorage } from '../storage/adapter.js';
import { requireAuth, requireAdmin } from '../auth/middleware.js';
import { generateToken } from '../auth/password.js';
import { resolveBaseUrl } from '../config.js';
import { requireDataContext } from './share.api.js';

/** 取北京时区当天 YYYY-MM-DD */
function todayCN() {
  const now = new Date(Date.now() + 8 * 3600 * 1000); // UTC+8
  return now.toISOString().slice(0, 10);
}

/** 本年累计打卡天数（按记录日期去重，仅计当年，跨年归零） */
function yearCheckins(records, today) {
  const year = (today || '').slice(0, 4);
  if (!year) return 0;
  return new Set(
    records.filter(r => (r.record_date || '').slice(0, 4) === year).map(r => r.record_date)
  ).size;
}

/** 根据本年累计打卡天数生成鼓励标题 */
function streakTitle(days) {
  if (days <= 1) return '今年开始记录第 1 天，加油！';
  if (days < 7) return `今年已累计打卡 ${days} 天，继续保持！`;
  if (days < 30) return `今年已累计打卡 ${days} 天，习惯正在养成！`;
  if (days < 100) return `今年已累计打卡 ${days} 天，非常棒！`;
  return `今年已累计打卡 ${days} 天，了不起的毅力！`;
}

// ==================== 成员 ====================

/** GET /api/weight/members  列出成员（无成员时自动创建默认成员=当前用户名） */
async function listMembers({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const dc = await requireDataContext(storage, auth, 'weight', request);
  if (dc instanceof Response) return dc;
  let members = await storage.weight.listMembers(dc.uid);
  if (members.length === 0) {
    await storage.weight.createMember(dc.uid, (dc.owner && dc.owner.nickname) || auth.username);
    members = await storage.weight.listMembers(dc.uid);
  }
  return json({ success: true, members });
}

/** POST /api/weight/members  新建成员  body: { name, restore? }
 * 若存在同名的已归档（软删）成员：restore=true → 恢复并关联历史数据；否则返回 needConfirm 由前端确认
 */
async function createMember({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  const name = (body.name || '').trim();
  if (!name) return error('请填写成员名称');
  const storage = getStorage(env);
  const dc = await requireDataContext(storage, auth, 'weight', request);
  if (dc instanceof Response) return dc;
  const archived = await storage.weight.findArchivedByName(dc.uid, name);
  if (archived) {
    if (body.restore) {
      await storage.weight.restoreMember(archived.id);
      return json({ success: true, message: '已恢复成员及其历史记录', id: archived.id, restored: true });
    }
    return json({ success: true, needConfirm: true, archivedId: archived.id, archivedName: archived.name });
  }
  const id = await storage.weight.createMember(dc.uid, name);
  return json({ success: true, message: '成员已添加', id });
}

/** PUT /api/weight/members/:id  修改成员名 / 禁用启用  body: { name?, disabled? } */
async function updateMember({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  const storage = getStorage(env);
  const dc = await requireDataContext(storage, auth, 'weight', request);
  if (dc instanceof Response) return dc;
  const id = parseInt(params.id, 10);
  const m = await storage.weight.findMember(id);
  if (!m || !(await storage.weight.canAccessMember(dc.uid, id))) return error('成员不存在', 404);
  // 禁用/启用仅属主可操作
  if (typeof body.disabled === 'boolean') {
    if (m.user_id !== dc.uid) return error('只有成员属主可以停用/启用', 403);
    await storage.weight.setMemberDisabled(id, dc.uid, body.disabled);
  }
  // 对好友可见开关仅属主可操作；已停用成员必须先启用才能对好友开放
  if (typeof body.friend_visible === 'boolean') {
    if (m.user_id !== dc.uid) return error('只有成员属主可以设置好友可见', 403);
    if (body.friend_visible && m.disabled) return error('该成员已停用，请先启用再对好友开放', 400);
    await storage.weight.setMemberFriendVisible(id, dc.uid, body.friend_visible);
  }
  // 改名作用于成员本身（属主与共享方共用同一条），故按属主 user_id 更新
  const name = (body.name || '').trim();
  if (name) await storage.weight.updateMember(id, m.user_id, name);
  return json({ success: true, message: '成员已更新' });
}

/** PUT /api/weight/members/reorder  调整成员顺序  body: { ids: [id,...] }（仅属主自己的成员） */
async function reorderMembers({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids)
    ? body.ids.map(n => parseInt(n, 10)).filter(n => !isNaN(n))
    : [];
  if (ids.length === 0) return error('参数错误');
  const storage = getStorage(env);
  const dc = await requireDataContext(storage, auth, 'weight', request);
  if (dc instanceof Response) return dc;
  await storage.weight.reorderMembers(dc.uid, ids);
  return json({ success: true, message: '顺序已保存' });
}

/** DELETE /api/weight/members/:id?purge=1  删除成员
 * 属主默认软删（归档：界面移除但历史数据保留，新建同名可恢复）；purge=1 → 真删成员+全部记录+引用。
 * 共享方删除 → 仅解除自己的引用。
 */
async function removeMember({ request, env, params, url }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const dc = await requireDataContext(storage, auth, 'weight', request);
  if (dc instanceof Response) return dc;
  const id = parseInt(params.id, 10);
  const m = await storage.weight.findMember(id);
  if (!m || !(await storage.weight.canAccessMember(dc.uid, id))) return error('成员不存在', 404);
  if (m.user_id === dc.uid) {
    if (url.searchParams.get('purge') === '1') {
      await storage.weight.removeMemberCascade(id);
      return json({ success: true, message: '成员及全部记录已删除' });
    }
    await storage.weight.archiveMember(id);
    return json({ success: true, message: '成员已移除（历史数据保留，新建同名可恢复）' });
  }
  await storage.weight.unshareMember(id, dc.uid);
  return json({ success: true, message: '已移除共享成员' });
}

/** GET /api/weight/members/:id/share-link  获取/生成成员免密填写链接 */
async function getMemberShareLink({ request, env, params, url }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const id = parseInt(params.id, 10);
  const m = await storage.weight.findMember(id);
  if (!m || !(await storage.weight.canAccessMember(auth.user_id, id))) return error('成员不存在', 404);

  let token = m.share_token;
  // reset=1 时强制重置：重新生成 token 覆盖旧值，旧链接立即失效
  if (!token || url.searchParams.get('reset')) {
    token = generateToken();
    await storage.weight.setMemberShareToken(id, token);
  }
  const base = await resolveBaseUrl(storage, env, url);
  return json({ success: true, token, link: `${base}/w/${token}` });
}

// ==================== 记录 ====================

/** GET /api/weight/chart  当前用户所有成员的曲线数据（带单位偏好）
 * 本人上下文：含体重好友的可见成员（只读）；X-Data-As 共享上下文：仅数据源主人数据，不带其好友 */
async function weightChart({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const dc = await requireDataContext(storage, auth, 'weight', request);
  if (dc instanceof Response) return dc;
  let members, records;
  if (dc.shared) {
    members = await storage.weight.listMembers(dc.uid);
    if (members.length === 0) {
      await storage.weight.createMember(dc.uid, (dc.owner && dc.owner.nickname) || auth.username);
      members = await storage.weight.listMembers(dc.uid);
    }
    records = await storage.weight.listRecords(dc.uid);
  } else {
    members = await storage.weight.listMembersWithFriends(auth.user_id);
    if (members.length === 0) {
      await storage.weight.createMember(auth.user_id, auth.username);
      members = await storage.weight.listMembersWithFriends(auth.user_id);
    }
    records = await storage.weight.listRecordsWithFriends(auth.user_id);
  }
  const user = await storage.users.findById(dc.uid);
  return json({ success: true, members, records, weight_unit: (user && user.weight_unit) || 'jin' });
}

/** GET /api/weight/unit  读取当前用户体重单位 */
async function getUnit({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const dc = await requireDataContext(storage, auth, 'weight', request);
  if (dc instanceof Response) return dc;
  const user = await storage.users.findById(dc.uid);
  return json({ success: true, weight_unit: (user && user.weight_unit) || 'jin' });
}

/** PUT /api/weight/unit  设置体重单位  body: { weight_unit: 'jin'|'kg' } */
async function setUnit({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  const unit = body.weight_unit === 'kg' ? 'kg' : 'jin';
  const storage = getStorage(env);
  const dc = await requireDataContext(storage, auth, 'weight', request);
  if (dc instanceof Response) return dc;
  await storage.users.updateWeightUnit(dc.uid, unit);
  return json({ success: true, message: '单位已更新', weight_unit: unit });
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
  const dc = await requireDataContext(storage, auth, 'weight', request);
  if (dc instanceof Response) return dc;
  const m = await storage.weight.findMember(memberId);
  if (!m || !(await storage.weight.canAccessMember(dc.uid, memberId))) return error('成员不存在', 404);

  const date = body.record_date || todayCN();
  const existing = await storage.weight.findRecordByMemberDate(memberId, date);
  if (existing) {
    await storage.weight.updateRecord(existing.id, weight, body.note);
    return json({ success: true, message: '记录已更新', id: existing.id });
  }
  // 记录归属成员属主 user_id（共享方与属主写入同一份数据）
  const id = await storage.weight.addRecord({
    member_id: memberId, user_id: m.user_id, weight, record_date: date, note: body.note
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
  const dc = await requireDataContext(storage, auth, 'weight', request);
  if (dc instanceof Response) return dc;
  const id = parseInt(params.id, 10);
  const rec = await storage.weight.findRecord(id);
  if (!rec || !(await storage.weight.canAccessMember(dc.uid, rec.member_id))) return error('记录不存在', 404);

  const newDate = body.record_date;
  if (newDate && newDate !== rec.record_date) {
    // 改日期：检查目标日期是否已有该成员记录，避免同成员同日重复
    const conflict = await storage.weight.findRecordByMemberDate(rec.member_id, newDate);
    if (conflict && conflict.id !== id) return error('该成员在目标日期已有记录', 400);
    await storage.weight.updateRecordWithDate(id, weight, body.note, newDate);
  } else {
    await storage.weight.updateRecord(id, weight, body.note);
  }
  return json({ success: true, message: '记录已更新' });
}

/** DELETE /api/weight/records/:id  删除记录 */
async function removeRecord({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const dc = await requireDataContext(storage, auth, 'weight', request);
  if (dc instanceof Response) return dc;
  const id = parseInt(params.id, 10);
  const rec = await storage.weight.findRecord(id);
  if (!rec || !(await storage.weight.canAccessMember(dc.uid, rec.member_id))) return error('记录不存在', 404);
  await storage.weight.removeRecord(id, rec.user_id);
  return json({ success: true, message: '记录已删除' });
}

// ==================== 免密公开 ====================

/** GET /api/public/weight/:token  免密查看成员信息与历史（供快速填写页） */
async function publicMemberInfo({ env, params }) {
  const storage = getStorage(env);
  const m = await storage.weight.findMemberByShareToken(params.token);
  if (!m) return error('链接无效或已失效', 404);
  if (m.disabled || m.archived) return error('该成员已停用，链接暂不可用', 403);

  await storage.users.updateLastPublic(m.user_id);
  const records = await storage.weight.listRecords(m.user_id, m.id);
  const today = todayCN();
  const days = yearCheckins(records, today);
  const todayRecord = records.find(r => r.record_date === today);
  // 本月已打卡天数（按记录日期去重，YYYY-MM 匹配当月）
  const month = today.slice(0, 7);
  const monthDays = new Set(records.filter(r => (r.record_date || '').slice(0, 7) === month).map(r => r.record_date)).size;
  const owner = await storage.users.findById(m.user_id);
  return json({
    success: true,
    member: { id: m.id, name: m.name },
    today, days, title: streakTitle(days), monthDays,
    weight_unit: (owner && owner.weight_unit) || 'jin',
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
  if (m.disabled || m.archived) return error('该成员已停用，链接暂不可用', 403);

  const body = await request.json().catch(() => ({}));
  const weight = parseFloat(body.weight);
  if (isNaN(weight) || weight <= 0) return error('请填写有效体重');

  const date = todayCN(); // 强制当天，不接受前端传入
  const existing = await storage.weight.findRecordByMemberDate(m.id, date);
  if (existing) return error('今日已录入，不可重复录入', 400);
  await storage.weight.addRecord({
    member_id: m.id, user_id: m.user_id, weight, record_date: date, note: body.note
  });
  return json({ success: true, message: '已记录今日体重' });
}

/** GET /api/public/weight-report/:token  免密查看该用户全部成员曲线数据
 * token 优先匹配 push_config(module=weight).report_token（推送链接用），
 * 回退兼容任一成员的 share_token（定位到所属用户）
 */
async function publicWeightReport({ env, params }) {
  const storage = getStorage(env);
  let userId = null;
  const pushRow = await storage.push.findByReportToken(params.token);
  if (pushRow && pushRow.module === 'weight') {
    userId = pushRow.user_id;
  } else {
    const m = await storage.weight.findMemberByShareToken(params.token);
    if (m) userId = m.user_id;
  }
  if (userId == null) return error('链接无效或已失效', 404);

  await storage.users.updateLastPublic(userId);
  const members = await storage.weight.listMembers(userId);
  const records = await storage.weight.listRecords(userId);
  const owner = await storage.users.findById(userId);
  return json({
    success: true,
    members, records,
    weight_unit: (owner && owner.weight_unit) || 'jin'
  });
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

/** GET /api/admin/weight/all-members  超管：列全部成员（含属主名），供引用勾选 */
async function adminAllMembers({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const members = await storage.weight.listAllMembersWithOwner();
  return json({ success: true, members });
}

/** POST /api/admin/weight/share  超管：把某成员引用到自己名下  body: { member_id } */
async function adminShareMember({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  const memberId = parseInt(body.member_id, 10);
  if (isNaN(memberId)) return error('请选择成员');
  const storage = getStorage(env);
  const m = await storage.weight.findMember(memberId);
  if (!m) return error('成员不存在', 404);
  if (m.user_id === auth.user_id) return error('该成员已属于你', 400);
  await storage.weight.shareMember(memberId, auth.user_id);
  return json({ success: true, message: '已引用成员' });
}

// ==================== 体重好友（用户级双向只读）====================

/** 拼好友邀请落地链接（/weight?wlink=token，未登录访问会被页面鉴权拦去登录） */
async function friendInviteLink(storage, env, url, token) {
  const base = await resolveBaseUrl(storage, env, url);
  return `${base || ''}/weight?wlink=${token}`;
}

/** POST /api/weight/friend-invite  生成/重置我的好友邀请链接  body: { reset? } */
async function friendInvite({ request, env, url }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  const storage = getStorage(env);
  let inv = await storage.weight.findFriendInviteByOwner(auth.user_id);
  if (!inv || body.reset) {
    const token = generateToken();
    await storage.weight.upsertFriendInvite(auth.user_id, token);
    inv = { token };
  }
  return json({ success: true, token: inv.token, link: await friendInviteLink(storage, env, url, inv.token) });
}

/** GET /api/weight/friends  好友列表 + 我的邀请 */
async function listFriends({ request, env, url }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const rows = await storage.weight.listFriends(auth.user_id);
  const inv = await storage.weight.findFriendInviteByOwner(auth.user_id);
  const invite = inv
    ? { token: inv.token, link: await friendInviteLink(storage, env, url, inv.token) }
    : null;
  return json({
    success: true,
    friends: rows.map(f => ({
      uid: f.uid, username: f.username, nickname: f.nickname || f.username, created_at: f.created_at
    })),
    invite
  });
}

/** POST /api/weight/friends/accept  凭邀请链接成为双向好友  body: { token } */
async function acceptFriend({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  const token = (body.token || '').trim();
  if (!token) return error('请提供邀请链接');
  const storage = getStorage(env);
  const inv = await storage.weight.findFriendInviteByToken(token);
  if (!inv) return error('邀请链接无效或已失效');
  if (inv.owner_user_id === auth.user_id) return error('这是你自己的邀请链接，无需接受');
  await storage.weight.addFriendPair(auth.user_id, inv.owner_user_id);
  // 接受即默认互见：双方各自动开放一个成员（最早创建的启用成员，通常即本人）；
  // 已手动开放过则尊重原选择。开放错了可在「好友 → 谁对好友可见」关闭/改开其他成员
  await storage.weight.ensureSelfMemberVisible(auth.user_id);
  await storage.weight.ensureSelfMemberVisible(inv.owner_user_id);
  const owner = await storage.users.findById(inv.owner_user_id);
  return json({
    success: true,
    message: `已与「${owner ? (owner.nickname || owner.username) : ''}」成为体重好友，双方默认互见本人成员曲线（仅可读）。其他成员默认隐藏，可在「成员 → 👥 好友 → 谁对好友可见」调整`
  });
}

/** DELETE /api/weight/friends/:uid  解除好友（一行对称关系，双方同时解除） */
async function removeFriend({ request, env, params }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const uid = parseInt(params.uid, 10);
  if (isNaN(uid)) return error('参数错误');
  const storage = getStorage(env);
  const friendIds = await storage.weight.friendIdSet(auth.user_id);
  if (!friendIds.includes(uid)) return error('对方不是你的体重好友', 404);
  await storage.weight.removeFriendPair(auth.user_id, uid);
  return json({ success: true, message: '已解除好友关系' });
}

export {
  listMembers, createMember, updateMember, reorderMembers, removeMember, getMemberShareLink,
  weightChart, addRecord, updateRecord, removeRecord,
  publicMemberInfo, publicSubmitWeight, publicWeightReport, adminCompare, adminAllMembers, adminShareMember,
  friendInvite, listFriends, acceptFriend, removeFriend,
  getUnit, setUnit
};
