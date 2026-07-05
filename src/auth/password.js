/**
 * 密码哈希与校验（WebCrypto PBKDF2-SHA256）
 * Cloudflare Worker 原生支持 crypto.subtle，无需依赖。
 * 存储格式: pbkdf2$<iterations>$<saltBase64>$<hashBase64>
 */

const ITERATIONS = 100000;
const KEY_LEN = 32; // 256 bit

function bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToBuf(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function deriveHash(password, salt, iterations) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial, KEY_LEN * 8
  );
  return new Uint8Array(bits);
}

/**
 * 生成密码哈希
 * @param {string} password
 * @returns {Promise<string>} 编码后的哈希串
 */
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveHash(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${bufToBase64(salt)}$${bufToBase64(hash)}`;
}

/**
 * 校验密码
 * @param {string} password
 * @param {string} stored - hashPassword 生成的串
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, stored) {
  try {
    const [scheme, iterStr, saltB64, hashB64] = stored.split('$');
    if (scheme !== 'pbkdf2') return false;
    const iterations = parseInt(iterStr, 10);
    const salt = base64ToBuf(saltB64);
    const expected = base64ToBuf(hashB64);
    const actual = await deriveHash(password, salt, iterations);
    if (actual.length !== expected.length) return false;
    // 恒定时间比较
    let diff = 0;
    for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}

/** 生成随机 token（用于会话/分享链接） */
function generateToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return bufToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export { hashPassword, verifyPassword, generateToken };
