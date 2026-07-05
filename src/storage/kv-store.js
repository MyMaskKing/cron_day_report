/**
 * KV 封装：会话、体重免密分享 token、基金净值短期缓存
 * 所有键统一前缀，便于管理
 */

const SESSION_PREFIX = 'session:';
const WSHARE_PREFIX = 'wshare:';
const NAV_PREFIX = 'nav:';

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
 * @returns {Promise<Object|null>}
 */
async function kvGetSession(kv, token) {
  const raw = await kv.get(SESSION_PREFIX + token);
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

export {
  kvSetSession, kvGetSession, kvDeleteSession,
  kvSetShare, kvGetShare, kvDeleteShare,
  kvSetNav, kvGetNav
};
