/**
 * KV 封装：会话、体重免密分享 token、基金净值短期缓存
 * 所有键统一前缀，便于管理
 */

const SESSION_PREFIX = 'session:';
const WSHARE_PREFIX = 'wshare:';
const NAV_PREFIX = 'nav:';
const ANN_PREFIX = 'annread:';
// 邮箱验证码（register=注册 bind=登录后绑定/换绑）
const EMAIL_CODE_PREFIX = 'emailcode:';
// 忘记密码的一次性重置 token
const PWD_RESET_PREFIX = 'pwdreset:';
// 发信限频：60 秒冷却键 + 小时窗口计数键
const EMAIL_CD_PREFIX = 'emailcd:';
const EMAIL_WIN_PREFIX = 'emailwin:';

/**
 * 写入会话
 * @param {Object} kv - KV namespace binding
 * @param {string} token - 会话 token
 * @param {Object} data - 会话数据 {user_id, username, role, exp}
 * @param {number} ttlSeconds - 过期秒数
 */
async function kvSetSession(kv, token, data, ttlSeconds) {
  await kv.put(SESSION_PREFIX + token, JSON.stringify(data), { expirationTtl: ttlSeconds });
}

/**
 * 读取会话
 * 加 cacheTtl:60 让同一 POP 边缘缓存 60 秒内的重复读走缓存, 不计入 KV 读额度;
 * 副作用: 登出/切换身份最多有 60 秒延迟生效 (旧值在边缘缓存里)
 * @returns {Promise<Object|null>}
 */
async function kvGetSession(kv, token) {
  const raw = await kv.get(SESSION_PREFIX + token, { cacheTtl: 60 });
  return raw ? JSON.parse(raw) : null;
}

/** 删除会话 */
async function kvDeleteSession(kv, token) {
  await kv.delete(SESSION_PREFIX + token);
}

/**
 * 写入体重免密分享 token
 * @param {Object} data - {user_id, member_scope}
 * @param {number|null} ttlSeconds - 过期秒数，null 表示永久
 */
async function kvSetShare(kv, token, data, ttlSeconds) {
  const opts = ttlSeconds ? { expirationTtl: ttlSeconds } : {};
  await kv.put(WSHARE_PREFIX + token, JSON.stringify(data), opts);
}

/** 读取体重分享 token */
async function kvGetShare(kv, token) {
  const raw = await kv.get(WSHARE_PREFIX + token);
  return raw ? JSON.parse(raw) : null;
}

/** 删除体重分享 token */
async function kvDeleteShare(kv, token) {
  await kv.delete(WSHARE_PREFIX + token);
}

/** 净值缓存写入（短期，默认10分钟） */
async function kvSetNav(kv, code, data, ttlSeconds = 600) {
  await kv.put(NAV_PREFIX + code, JSON.stringify(data), { expirationTtl: ttlSeconds });
}

/** 净值缓存读取 */
async function kvGetNav(kv, code) {
  const raw = await kv.get(NAV_PREFIX + code);
  return raw ? JSON.parse(raw) : null;
}

/**
 * 写入用户的公告已读版本（值为 announcement_updated_at 毫秒时间戳字符串，永久有效）
 * @param {number|string} userId
 * @param {string} version - 当前公告版本号
 */
async function kvSetAnnRead(kv, userId, version) {
  await kv.put(ANN_PREFIX + userId, String(version));
}

/** 读取用户的公告已读版本；未读任何版本返回 '' */
async function kvGetAnnRead(kv, userId) {
  return (await kv.get(ANN_PREFIX + userId)) || '';
}

// ==================== 邮箱验证码 / 密码重置（临时凭证，TTL 过期，不进业务库） ====================

/**
 * 写入邮箱验证码（覆盖同邮箱同用途的旧码）
 * @param {string} purpose - register | bind
 * @param {string} email - 已归一化（trim+小写）
 * @param {string} code - 6 位数字码
 * @param {number} ttlSeconds - 有效期（默认 10 分钟）
 * @returns {Promise<number>} 过期 Unix 秒（回写错误次数时据此计算剩余 TTL，不续期）
 */
async function kvSetEmailCode(kv, purpose, email, code, ttlSeconds = 600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  await kv.put(
    EMAIL_CODE_PREFIX + purpose + ':' + email,
    JSON.stringify({ c: code, a: 0, exp }),
    { expirationTtl: ttlSeconds }
  );
  return exp;
}

/** 读取验证码记录 {c,a,exp}；不存在/已过期返回 null */
async function kvGetEmailCode(kv, purpose, email) {
  const raw = await kv.get(EMAIL_CODE_PREFIX + purpose + ':' + email);
  if (!raw) return null;
  try {
    const rec = JSON.parse(raw);
    if (rec && rec.exp && rec.exp < Math.floor(Date.now() / 1000)) return null;
    return rec;
  } catch {
    return null;
  }
}

/**
 * 回写验证码记录（错误次数 +1 时用；TTL 按原过期时间收敛，不延长有效期）
 */
async function kvPutEmailCode(kv, purpose, email, rec) {
  const ttl = Math.max((rec.exp || 0) - Math.floor(Date.now() / 1000), 1);
  await kv.put(
    EMAIL_CODE_PREFIX + purpose + ':' + email,
    JSON.stringify(rec),
    { expirationTtl: ttl }
  );
}

async function kvDelEmailCode(kv, purpose, email) {
  await kv.delete(EMAIL_CODE_PREFIX + purpose + ':' + email);
}

/**
 * 写入一次性密码重置 token
 * @param {string} token - 明文随机 token（仅出现在邮件链接中，库内 key 即明文，与会话 token 同口径）
 * @param {{uid:number, email:string}} data
 * @param {number} ttlSeconds - 默认 1 小时
 */
async function kvSetPwdReset(kv, token, data, ttlSeconds = 3600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  await kv.put(
    PWD_RESET_PREFIX + token,
    JSON.stringify({ uid: data.uid, email: data.email, exp }),
    { expirationTtl: ttlSeconds }
  );
}

async function kvGetPwdReset(kv, token) {
  const raw = await kv.get(PWD_RESET_PREFIX + token);
  if (!raw) return null;
  try {
    const rec = JSON.parse(raw);
    if (rec && rec.exp && rec.exp < Math.floor(Date.now() / 1000)) return null;
    return rec;
  } catch {
    return null;
  }
}

async function kvDelPwdReset(kv, token) {
  await kv.delete(PWD_RESET_PREFIX + token);
}

/**
 * 发信限频检查（不写入）：冷却中或窗口内次数已达上限返回 true
 * @param {string} scope - register | bind | reset
 * @param {{cooldownSec?:number, windowSec?:number, windowMax?:number}} [opts]
 */
async function kvEmailRateBlocked(kv, scope, email, opts = {}) {
  const cooldownSec = opts.cooldownSec || 60;
  const windowSec = opts.windowSec || 3600;
  const windowMax = opts.windowMax || 5;
  if (await kv.get(EMAIL_CD_PREFIX + scope + ':' + email)) return true;
  const raw = await kv.get(EMAIL_WIN_PREFIX + scope + ':' + email);
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.filter(t => t > Date.now() - windowSec * 1000).length >= windowMax) {
        return true;
      }
    } catch { /* 计数串损坏按未限流处理 */ }
  }
  return false;
}

/**
 * 发信成功后记一次限频：写冷却键 + 向小时窗口追加当前时间戳
 */
async function kvEmailRateMark(kv, scope, email, opts = {}) {
  const cooldownSec = opts.cooldownSec || 60;
  const windowSec = opts.windowSec || 3600;
  await kv.put(EMAIL_CD_PREFIX + scope + ':' + email, '1', { expirationTtl: cooldownSec });
  const now = Date.now();
  let arr = [];
  const raw = await kv.get(EMAIL_WIN_PREFIX + scope + ':' + email);
  if (raw) {
    try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) arr = parsed; } catch { /* 同上 */ }
  }
  arr = arr.filter(t => t > now - windowSec * 1000);
  arr.push(now);
  await kv.put(EMAIL_WIN_PREFIX + scope + ':' + email, JSON.stringify(arr), { expirationTtl: windowSec });
}

export {
  kvSetSession, kvGetSession, kvDeleteSession,
  kvSetShare, kvGetShare, kvDeleteShare,
  kvSetNav, kvGetNav,
  kvSetAnnRead, kvGetAnnRead,
  kvSetEmailCode, kvGetEmailCode, kvPutEmailCode, kvDelEmailCode,
  kvSetPwdReset, kvGetPwdReset, kvDelPwdReset,
  kvEmailRateBlocked, kvEmailRateMark
};
