/**
 * 认证 API：注册 / 登录 / 登出 / 当前用户 / 初始化超管
 */

import { json, error } from '../router.js';
import { getStorage } from '../storage/adapter.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { parseOffset } from '../services/time.service.js';
import { nowCN } from '../services/schedule.service.js';
import {
  createSession, destroySession, getSession,
  getTokenFromRequest, buildSessionCookie, buildClearCookie
} from '../auth/session.js';

/** 校验用户名/密码基本规则 */
function validateCredentials(username, password) {
  if (!username || typeof username !== 'string' || username.length < 3 || username.length > 32) {
    return '用户名需为 3-32 个字符';
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return '密码至少 6 位';
  }
  return null;
}

// 界面主题合法值（与前端 data-theme 取值一致）；非法值回退 light
const THEMES = ['light', 'dark', 'eye'];
// 每日勉励卡风格：a=极光能量(默认) c=手账打气 h1=战书令 h2=最后通牒；非法值回退 a
const MOTTO_STYLES = ['a', 'c', 'h1', 'h2'];
// 座右铭正文字数口径：去除行内样式标记后按码点计数（与 layout.js 卡片分档、设置页计数同一正则）
function mottoPlainLen(s) {
  return Array.from(String(s).replace(/\*\*|~~|__|\+\+|\[f:y\]|\[\/f\]|~/g, '')).length;
}
// 分设备展示频率白名单（daily=每天一次 every=每次打开 off=不展示）；缺失/非法回退 daily
const MOTTO_FREQS = ['daily', 'every', 'off'];
const MOTTO_DEVICES = ['pc', 'mobile', 'app'];
function normalizeMottoFreq(v) {
  const out = { pc: 'daily', mobile: 'daily', app: 'daily' };
  if (v && typeof v === 'object') {
    for (const d of MOTTO_DEVICES) {
      if (MOTTO_FREQS.includes(v[d])) out[d] = v[d];
    }
  }
  return out;
}
function parseMottoJson(v) {
  if (!v || typeof v !== 'string') return {};
  try { const o = JSON.parse(v); return o && typeof o === 'object' ? o : {}; } catch { return {}; }
}

// 待办视图 id 白名单（顺序即系统默认循环）：card=卡片 accordion=手风琴 tree=完整树
const TODO_VIEW_IDS = ['card', 'accordion', 'tree'];
/**
 * 归一化用户视图循环列表：解析 JSON → 白名单过滤、去重保序；非法/空 → []（= 系统三循环）
 */
function normalizeTodoViewList(raw) {
  let arr = null;
  if (typeof raw === 'string') {
    try { arr = JSON.parse(raw); } catch { arr = null; }
  } else if (Array.isArray(raw)) {
    arr = raw;
  }
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const v of arr) {
    if (TODO_VIEW_IDS.includes(v) && !out.includes(v)) out.push(v);
  }
  return out;
}

// 注册人数上限相关 app_settings 键
const SETTING_REG_LIMIT = 'register_limit';
const SETTING_REG_LIMIT_MSG = 'register_limit_msg';
// 达到上限时的默认提示（markdown），超管未自定义时使用
const DEFAULT_REG_LIMIT_MSG = '**注册人数已满**\n\n本站已达到注册人数上限，暂时无法注册新账号。\n如需开通，请联系管理员。';

/**
 * 读取注册人数上限配置
 * @param {Object} storage - 存储适配器
 * @returns {Promise<{limit:number, msg:string}>} limit 为 0 表示不限制；msg 为 markdown 提示词
 */
async function readRegisterLimit(storage) {
  const raw = await storage.settings.get(SETTING_REG_LIMIT);
  const n = parseInt(raw, 10);
  const limit = (!isNaN(n) && n > 0) ? Math.floor(n) : 0;
  const custom = (await storage.settings.get(SETTING_REG_LIMIT_MSG)) || '';
  return { limit, msg: custom.trim() ? custom : DEFAULT_REG_LIMIT_MSG };
}

/**
 * POST /api/auth/register  注册普通用户
 * body: { username, password }
 */
async function register({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const { username, password } = body;
  const nickname = (body.nickname || '').trim() || username;
  const invalid = validateCredentials(username, password);
  if (invalid) return error(invalid);

  const storage = getStorage(env);

  // 注册人数上限：limit>0 且现存用户数已达上限则拒绝（msg 为 markdown 提示词）
  const { limit, msg } = await readRegisterLimit(storage);
  if (limit > 0) {
    const count = await storage.users.count();
    if (count >= limit) {
      return json({ success: false, limited: true, message: '注册人数已满', msg }, 403);
    }
  }

  const existing = await storage.users.findByName(username);
  if (existing) return error('用户名已存在');

  const password_hash = await hashPassword(password);
  const id = await storage.users.create({ username, password_hash, role: 'user', nickname });
  return json({ success: true, message: '注册成功', user: { id, username, role: 'user' } });
}

/**
 * POST /api/auth/login  登录
 * body: { username, password }
 */
async function login({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const { username, password } = body;
  if (!username || !password) return error('请输入用户名和密码');

  const storage = getStorage(env);
  const user = await storage.users.findByName(username);
  if (!user) return error('用户名或密码错误', 401);
  if (user.status === 'disabled') return error('账号已被禁用', 403);

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return error('用户名或密码错误', 401);

  const token = await createSession(env, user);
  // 记录最后登录时间 (UTC now); 用于超管用户管理页展示
  await storage.users.updateLastLogin(user.id);
  return json(
    { success: true, message: '登录成功', user: { id: user.id, username: user.username, role: user.role } },
    200,
    { 'Set-Cookie': buildSessionCookie(token, request) }
  );
}

/**
 * POST /api/auth/logout  登出
 */
async function logout({ request, env }) {
  const token = getTokenFromRequest(request);
  await destroySession(env, token);
  return json({ success: true, message: '已登出' }, 200, { 'Set-Cookie': buildClearCookie(request) });
}

/**
 * GET /api/auth/me  当前登录用户
 */
async function me({ request, env }) {
  const token = getTokenFromRequest(request);
  const session = await getSession(env, token);
  if (!session) return error('未登录', 401);
  const storage = getStorage(env);
  const u = await storage.users.findById(session.user_id);
  const nickname = (u && u.nickname) || session.nickname || session.username;
  return json({
    success: true,
    user: { id: session.user_id, username: session.username, nickname, role: session.role }
  });
}

/**
 * GET /api/auth/profile  当前用户资料
 */
async function getProfile({ request, env }) {
  const token = getTokenFromRequest(request);
  const session = await getSession(env, token);
  if (!session) return error('未登录', 401);
  const storage = getStorage(env);
  const u = await storage.users.findById(session.user_id);
  if (!u) return error('用户不存在', 404);
  return json({ success: true, profile: {
    username: u.username,
    nickname: u.nickname || u.username,
    restrict_quicklogin: u.restrict_quicklogin != null ? u.restrict_quicklogin : 1,
    theme: THEMES.includes(u.theme) ? u.theme : 'light',
    todo_auto_parent: u.todo_auto_parent === 0 ? 0 : 1,
    todo_view_list: normalizeTodoViewList(u.todo_view_list),
    motto: u.motto || '',
    motto_style: MOTTO_STYLES.includes(u.motto_style) ? u.motto_style : 'a',
    motto_freq: normalizeMottoFreq(parseMottoJson(u.motto_freq))
  } });
}

/**
 * PUT /api/auth/theme  保存自己的界面主题  body: { theme: 'light'|'dark'|'eye' }
 */
async function updateTheme({ request, env }) {
  const token = getTokenFromRequest(request);
  const session = await getSession(env, token);
  if (!session) return error('未登录', 401);
  const body = await request.json().catch(() => ({}));
  const theme = body.theme;
  if (!THEMES.includes(theme)) return error('主题值非法', 400);
  const storage = getStorage(env);
  await storage.users.updateTheme(session.user_id, theme);
  return json({ success: true, message: '主题已保存' });
}

/**
 * PUT /api/auth/profile  修改昵称  body: { nickname }
 */
async function updateProfile({ request, env }) {
  const token = getTokenFromRequest(request);
  const session = await getSession(env, token);
  if (!session) return error('未登录', 401);
  const body = await request.json().catch(() => ({}));
  const nickname = (body.nickname || '').trim();
  if (!nickname || nickname.length > 32) return error('昵称需为 1-32 个字符');
  const storage = getStorage(env);
  await storage.users.updateNickname(session.user_id, nickname);
  return json({ success: true, message: '昵称已更新' });
}

/**
 * PUT /api/auth/password  修改自己的密码  body: { oldPassword, newPassword }
 */
async function changePassword({ request, env }) {
  const token = getTokenFromRequest(request);
  const session = await getSession(env, token);
  if (!session) return error('未登录', 401);
  const body = await request.json().catch(() => ({}));
  const { oldPassword, newPassword } = body;
  if (!newPassword || newPassword.length < 6) return error('新密码至少 6 位');

  const storage = getStorage(env);
  const u = await storage.users.findById(session.user_id);
  if (!u) return error('用户不存在', 404);
  const ok = await verifyPassword(oldPassword || '', u.password_hash);
  if (!ok) return error('原密码错误', 401);

  const password_hash = await hashPassword(newPassword);
  await storage.users.updatePassword(session.user_id, password_hash);
  return json({ success: true, message: '密码已修改' });
}

/**
 * GET /api/auth/setup-status  查询是否需要初始化超管（供 /setup 页面判断）
 * 判断依据是"是否已存在超管"，而非是否有任何用户
 * 返回 { needSetup: bool, tokenRequired: bool }
 */
async function setupStatus({ env }) {
  const storage = getStorage(env);
  const adminCount = await storage.users.countAdmins();
  return json({
    success: true,
    needSetup: adminCount === 0,
    tokenRequired: !!env.ADMIN_BOOTSTRAP_TOKEN
  });
}

/**
 * GET /api/auth/register-status  公开接口：注册是否已达人数上限
 * 供登录/注册页在未登录状态下查询，limited 时展示满员提示词（markdown）并禁用注册
 */
async function registerStatus({ env }) {
  const storage = getStorage(env);
  const { limit, msg } = await readRegisterLimit(storage);
  let limited = false;
  if (limit > 0) {
    const count = await storage.users.count();
    limited = count >= limit;
  }
  return json({ success: true, limited, limit, msg });
}

/**
 * POST /api/auth/bootstrap  初始化超管（仅当系统尚无超管时可用）
 * body: { username, password, token }
 * 若配置了 env.ADMIN_BOOTSTRAP_TOKEN 则校验 token；未配置则仅凭"系统无超管"即可创建。
 * 若用户名已存在（如已注册的普通用户），则将其提升为超管。
 */
async function bootstrap({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const { username, password, token } = body;

  // 令牌可选：仅在配置了 secret 时才强制校验
  if (env.ADMIN_BOOTSTRAP_TOKEN && token !== env.ADMIN_BOOTSTRAP_TOKEN) {
    return error('初始化令牌错误', 403);
  }

  const storage = getStorage(env);
  const adminCount = await storage.users.countAdmins();
  if (adminCount > 0) return error('系统已存在超管，无法重复初始化', 409);

  const invalid = validateCredentials(username, password);
  if (invalid) return error(invalid);

  // 用户名已存在：提升为超管（沿用原密码）；否则新建超管
  const existing = await storage.users.findByName(username);
  if (existing) {
    await storage.users.updateRole(existing.id, 'admin');
    return json({ success: true, message: '已将现有用户提升为超管（请用原注册密码登录）', user: { id: existing.id, username, role: 'admin' } });
  }
  const password_hash = await hashPassword(password);
  const id = await storage.users.create({ username, password_hash, role: 'admin' });
  return json({ success: true, message: '超管初始化成功', user: { id, username, role: 'admin' } });
}

/**
 * POST /api/public/quick-login/:kind/:token  免密页快速登录
 * 按免密 token 定位其所属用户并签发正式会话（谁的链接就登入谁的账号）
 * kind ∈ fund | weight | asset | todo | weight-report | asset-report | fund-report | todo-report
 */
async function quickLoginByToken({ request, env, params }) {
  const storage = getStorage(env);
  const { kind, token } = params;
  let userId = null;
  if (kind === 'fund') {
    const f = await storage.fund.findByShareToken(token);
    if (f) userId = f.user_id;
  } else if (kind === 'weight') {
    const m = await storage.weight.findMemberByShareToken(token);
    if (m) userId = m.user_id;
  } else if (kind === 'asset') {
    const w = await storage.asset.findWalletByShareToken(token);
    if (w) userId = w.user_id;
  } else if (kind === 'todo') {
    const t = await storage.todo.findByShareToken(token);
    if (t) userId = t.user_id;
  } else if (kind === 'weight-report' || kind === 'asset-report' || kind === 'fund-report' || kind === 'todo-report') {
    const row = await storage.push.findByReportToken(token);
    if (row) userId = row.user_id;
  } else {
    return error('登录类型非法', 400);
  }
  if (userId == null) return error('链接无效或已失效', 404);

  const user = await storage.users.findById(userId);
  if (!user) return error('用户不存在', 404);
  if (user.status === 'disabled') return error('账号已被禁用', 403);

  const REDIRECT = {
    fund: '/fund', weight: '/weight', asset: '/asset', todo: '/todo',
    'weight-report': '/weight', 'asset-report': '/asset', 'fund-report': '/fund', 'todo-report': '/todo'
  };
  // kind 归一到模块，用于受限会话仅放行对应模块页
  const MODULE_OF = {
    fund: 'fund', 'fund-report': 'fund',
    weight: 'weight', 'weight-report': 'weight',
    asset: 'asset', 'asset-report': 'asset',
    todo: 'todo', 'todo-report': 'todo'
  };
  // 该用户开启限制则会话仅能访问对应模块页；关闭则为完整会话
  const extra = user.restrict_quicklogin ? { quicklogin_module: MODULE_OF[kind] } : {};
  const sessionToken = await createSession(env, user, extra);
  // 免密链接换正式会话也算一次登录; 用户管理页可据此定位活跃度
  await storage.users.updateLastLogin(user.id);
  return json(
    { success: true, redirect: REDIRECT[kind] || '/dashboard' },
    200,
    { 'Set-Cookie': buildSessionCookie(sessionToken, request) }
  );
}

/**
 * PUT /api/auth/todo-auto-parent  设置待办偏好：子任务全部完成后是否自动完成父任务  body: { enabled }
 */
async function updateTodoAutoParent({ request, env }) {
  const token = getTokenFromRequest(request);
  const session = await getSession(env, token);
  if (!session) return error('未登录', 401);
  const body = await request.json().catch(() => ({}));
  const storage = getStorage(env);
  await storage.users.updateTodoAutoParent(session.user_id, body.enabled ? 1 : 0);
  return json({ success: true, message: '设置已保存' });
}

/**
 * PUT /api/auth/todo-view-list  保存自定义待办视图循环  body: { list: string[] }
 * 空数组/非法 → 存 null（恢复系统三循环）；返回归一化列表
 */
async function updateTodoViewList({ request, env }) {
  const token = getTokenFromRequest(request);
  const session = await getSession(env, token);
  if (!session) return error('未登录', 401);
  const body = await request.json().catch(() => ({}));
  const list = normalizeTodoViewList(body.list);
  const storage = getStorage(env);
  await storage.users.updateTodoViewList(session.user_id, list.length ? JSON.stringify(list) : null);
  return json({ success: true, message: '设置已保存', list });
}

/**
 * PUT /api/auth/motto  保存自己的每日勉励卡  body: { motto, style, freq? }
 * motto 去空白后正文 0-80 字（空=清空，不再弹卡）；style 白名单见 MOTTO_STYLES；
 * freq 可选 {pc,mobile,app} ∈ daily|every|off，缺省/非法回退 daily
 */
async function updateMotto({ request, env }) {
  const token = getTokenFromRequest(request);
  const session = await getSession(env, token);
  if (!session) return error('未登录', 401);
  const body = await request.json().catch(() => ({}));
  const motto = typeof body.motto === 'string' ? body.motto.trim() : '';
  // 80 字限的是正文（不含样式标记）；500 是含标记原始串的防滥用硬上限
  if (mottoPlainLen(motto) > 80) return error('座右铭最多 80 个字（加粗、字体等样式标记不计入字数）', 400);
  if (motto.length > 500) return error('座右铭内容过长', 400);
  const style = MOTTO_STYLES.includes(body.style) ? body.style : 'a';
  const freq = normalizeMottoFreq(body.freq);
  const storage = getStorage(env);
  await storage.users.updateMotto(session.user_id, motto, style, JSON.stringify(freq));
  return json({ success: true, message: '座右铭已保存' });
}

/**
 * POST /api/auth/motto-seen  上报今日勉励卡已读（关闭弹卡时调用） body: { device: pc|mobile|app }
 * 已读按设备独立记录；app 设备类型以 X-App-Shell 头为权威（该数据无安全意义，仅纠正自报）。
 * 日期由服务端按全局 tz_offset 计算；失败静默（次日还会再弹）
 */
async function markMottoSeen({ request, env }) {
  const token = getTokenFromRequest(request);
  const session = await getSession(env, token);
  if (!session) return error('未登录', 401);
  const body = await request.json().catch(() => ({}));
  let device = MOTTO_DEVICES.includes(body.device) ? body.device : null;
  const isApp = request.headers.get('X-App-Shell') === '1';
  if (isApp) device = 'app';
  else if (!device) device = 'pc';
  const storage = getStorage(env);
  const tzOffset = parseOffset(await storage.settings.get('tz_offset'));
  const today = nowCN(Date.now(), tzOffset).dateStr;
  // 读改写 motto_seen JSON（保留其他设备的已读日期）
  const u = await storage.users.findById(session.user_id);
  const seen = parseMottoJson(u && u.motto_seen);
  seen[device] = today;
  await storage.users.updateMottoSeen(session.user_id, JSON.stringify(seen));
  return json({ success: true, device, date: today });
}

/**
 * PUT /api/auth/quicklogin-restrict  设置免密登录访问限制  body: { enabled }
 */
async function updateQuickloginRestrict({ request, env }) {
  const token = getTokenFromRequest(request);
  const session = await getSession(env, token);
  if (!session) return error('未登录', 401);
  const body = await request.json().catch(() => ({}));
  const storage = getStorage(env);
  await storage.users.updateQuickloginRestrict(session.user_id, body.enabled ? 1 : 0);
  return json({ success: true, message: '设置已保存' });
}

export {
  register, login, logout, me, bootstrap, setupStatus, registerStatus,
  getProfile, updateProfile, changePassword, quickLoginByToken, updateQuickloginRestrict,
  updateTheme, updateTodoAutoParent, updateTodoViewList, updateMotto, markMottoSeen
};
