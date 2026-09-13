/**
 * 鉴权模块：管理员密码 scrypt 哈希、内存会话、登录失败限速、token 常量时间比较
 * 无外部依赖（node:crypto 内置）
 */
import crypto from 'node:crypto';

const SESSION_TTL_MS = 7 * 24 * 3600 * 1000; // 会话 7 天
const LOGIN_MAX_FAIL = 5;                    // 连续失败 5 次
const LOGIN_LOCK_MS = 15 * 60 * 1000;        // 锁定 15 分钟

/**
 * 哈希密码，格式 scrypt$<saltHex>$<hashHex>
 * @param {string} pw
 * @returns {string}
 */
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(String(pw), salt, 64);
  return `scrypt$${salt.toString('hex')}$${h.toString('hex')}`;
}

/**
 * 校验密码（恒定时间）
 * @param {string} pw 待验证明文
 * @param {string} stored hashPassword 生成的串
 * @returns {boolean}
 */
export function verifyPassword(pw, stored) {
  try {
    const [scheme, saltHex, hashHex] = String(stored || '').split('$');
    if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
    const ref = Buffer.from(hashHex, 'hex');
    const h = crypto.scryptSync(String(pw), Buffer.from(saltHex, 'hex'), ref.length);
    return h.length === ref.length && crypto.timingSafeEqual(h, ref);
  } catch {
    return false;
  }
}

/** 常量时间字符串比较（长度不同立即返回 false，token 鉴权用） */
export function constantTimeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// ── 内存会话（重启服务需重新登录；个人单用户够用） ──
const sessions = new Map(); // sid -> { ts }

/** 创建会话，返回 sid（写 cookie 用） */
export function createSession() {
  const sid = crypto.randomBytes(32).toString('hex');
  sessions.set(sid, { ts: Date.now() });
  return sid;
}

/** 会话有效返回 true，过期/不存在返回 false（惰性清理过期项） */
export function isValidSession(sid) {
  if (!sid) return false;
  const s = sessions.get(sid);
  if (!s) return false;
  if (Date.now() - s.ts > SESSION_TTL_MS) {
    sessions.delete(sid);
    return false;
  }
  return true;
}

export function destroySession(sid) {
  if (sid) sessions.delete(sid);
}

// ── 登录失败限速（按 IP） ──
const loginFails = new Map(); // ip -> { count, until }

/**
 * 该 IP 当前是否被锁，返回剩余锁定毫秒数（0 = 未锁）
 * @returns {number}
 */
export function loginLockRemaining(ip) {
  const r = loginFails.get(ip);
  if (!r) return 0;
  return r.until > Date.now() ? r.until - Date.now() : 0;
}

/** 记录一次失败，达到阈值后上锁 */
export function loginFail(ip) {
  const now = Date.now();
  let r = loginFails.get(ip);
  // until === 0 表示从未上锁，计数必须继续累积；只有"锁过期后"才重新计数
  if (!r || (r.until !== 0 && r.until <= now)) r = { count: 0, until: 0 };
  r.count += 1;
  if (r.count >= LOGIN_MAX_FAIL) r.until = now + LOGIN_LOCK_MS;
  loginFails.set(ip, r);
}

/** 登录成功后清除失败计数 */
export function loginReset(ip) {
  loginFails.delete(ip);
}
