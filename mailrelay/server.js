/**
 * mailrelay：极简 HTTP→SMTP 邮件转发服务
 * - POST /send                 Bearer token 鉴权的发信接口（JSON）
 * - GET  /healthz              健康检查
 * - /login /logout /admin/*    管理员后台（cookie 会话）
 * 配置见 data/config.json（网页后台与手工编辑同源）
 */
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Store } from './store.js';
import {
  hashPassword, verifyPassword, createSession, isValidSession, destroySession,
  loginLockRemaining, loginFail, loginReset
} from './auth.js';
import { parseRecipients, sendViaSmtp, verifySmtp, sanitizeSmtpError, looksLikeHtml, htmlToText } from './mailer.js';
import { loginPage, adminPage } from './web.js';

const PORT = Number.parseInt(process.env.HTTP_PORT || '8080', 10) || 8080;
const DATA_DIR = process.env.DATA_DIR
  || path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'data');
const SEND_BODY_LIMIT = 256 * 1024;
const FORM_BODY_LIMIT = 64 * 1024;

const store = new Store(DATA_DIR, {
  username: process.env.ADMIN_USERNAME,
  password: process.env.ADMIN_PASSWORD
});
store.init();

class HttpError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

// ── 基础工具 ──

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff) return xff.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let len = 0;
    req.on('data', c => {
      len += c.length;
      if (len > limit) {
        reject(new HttpError(413, '请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function applySecurityHeaders(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'"
  );
}

function sendHtml(req, res, code, html) {
  applySecurityHeaders(req, res);
  res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function redirect(res, location) {
  res.writeHead(303, { Location: location });
  res.end();
}

function sessionCookie(req, sid) {
  const viaHttps = req.headers['x-forwarded-proto'] === 'https';
  let c = `sid=${sid}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${7 * 24 * 3600}`;
  if (viaHttps) c += '; Secure';
  return c;
}

/** 按当前请求推导自身对外地址（反代后取 X-Forwarded-Proto），供页面教程拼可复制 URL */
function selfOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  return `${proto}://${req.headers.host || 'localhost:8080'}`;
}

function requireAdmin(req, res) {
  const sid = parseCookies(req.headers.cookie).sid;
  if (!isValidSession(sid)) {
    redirect(res, '/login');
    return null;
  }
  return sid;
}

function flashLocation(search) {
  const msg = search.get('msg');
  const type = search.get('type') === 'ok' ? 'ok' : 'err';
  return msg ? { type, text: msg } : {};
}

// ── 发信接口 POST /send ──

async function handleSend(req, res, url) {
  // Authorization: Bearer <token>，或 ?token=<token>（curl 调试/面板 webhook 兜底）
  let rawToken = '';
  const authz = req.headers['authorization'] || '';
  if (/^Bearer\s+/i.test(authz)) rawToken = authz.replace(/^Bearer\s+/i, '').trim();
  else rawToken = url.searchParams.get('token') || '';

  const tokenItem = store.findToken(rawToken);
  if (!tokenItem) {
    sendJson(res, 401, { success: false, error: '无效或已停用的 token' });
    return;
  }

  let body;
  try {
    const buf = await readBody(req, SEND_BODY_LIMIT);
    body = JSON.parse(buf.toString('utf8') || '{}');
  } catch (e) {
    sendJson(res, e instanceof HttpError ? e.code : 400,
      { success: false, error: e instanceof HttpError ? e.message : '请求体不是合法 JSON' });
    return;
  }
  if (typeof body !== 'object' || body === null) {
    sendJson(res, 400, { success: false, error: '请求体必须是 JSON 对象' });
    return;
  }

  let to;
  try {
    to = parseRecipients(body.to);
  } catch (e) {
    sendJson(res, 400, { success: false, error: e.message });
    return;
  }

  // 内容判定（优先级）：
  //   1) 显式 html 字段 → 按 HTML；同时若给了 content/text 则其作为纯文本备选 part
  //   2) 只有 content 且嗅探为 HTML（含 <table>/<div>/<br> 等标签）→ 自动按 HTML 发送，
  //      并粗转一份 text 备选；纯文本内容（如 "<3"、代码里的尖括号）不会误判
  //   3) 否则按纯文本发送
  const content = typeof body.content === 'string' ? body.content
    : (typeof body.text === 'string' ? body.text : '');
  const explicitHtml = typeof body.html === 'string' ? body.html : '';
  let text = content, html = '';
  if (explicitHtml.trim()) {
    html = explicitHtml;
    if (!content.trim()) text = htmlToText(explicitHtml);
  } else if (looksLikeHtml(content)) {
    html = content;
    text = htmlToText(content);
  }
  if (!text.trim() && !html.trim()) {
    sendJson(res, 400, { success: false, error: 'content（或 html）不能为空' });
    return;
  }
  const subject = typeof body.subject === 'string' && body.subject.trim()
    ? body.subject.slice(0, 300) : '（无主题）';

  if (!store.isSmtpReady()) {
    sendJson(res, 503, { success: false, error: '服务端尚未配置 SMTP，请管理员先在后台配置' });
    return;
  }
  const smtp = store.getSmtp();
  const t0 = Date.now();
  try {
    const messageId = await sendViaSmtp(smtp, { to, subject, text, html });
    store.touchToken(tokenItem.id);
    log(`[send] token="${tokenItem.name}" to=${to.join(',')} subject="${subject}" ok ${Date.now() - t0}ms`);
    sendJson(res, 200, { success: true, messageId });
  } catch (err) {
    const detail = sanitizeSmtpError(err);
    log(`[send] token="${tokenItem.name}" to=${to.join(',')} FAIL ${detail}`);
    sendJson(res, 502, { success: false, error: detail });
  }
}

// ── 登录 / 登出 ──

async function handleLogin(req, res) {
  const ip = clientIp(req);
  const lockedMs = loginLockRemaining(ip);
  if (lockedMs > 0) {
    sendHtml(req, res, 429, loginPage(`失败次数过多，请 ${Math.ceil(lockedMs / 1000)} 秒后再试`));
    return;
  }
  let form;
  try {
    form = new URLSearchParams((await readBody(req, FORM_BODY_LIMIT)).toString('utf8'));
  } catch {
    sendHtml(req, res, 413, loginPage('请求体过大'));
    return;
  }
  const username = form.get('username') || '';
  const password = form.get('password') || '';
  const admin = store.getAdmin();
  if (admin && username === admin.username && verifyPassword(password, admin.passwordHash)) {
    loginReset(ip);
    const sid = createSession();
    res.setHeader('Set-Cookie', sessionCookie(req, sid));
    redirect(res, '/admin');
    return;
  }
  loginFail(ip);
  log(`[login] 登录失败 ip=${ip} user="${username}"`);
  sendHtml(req, res, 401, loginPage('用户名或密码错误'));
}

function handleLogout(req, res) {
  const sid = parseCookies(req.headers.cookie).sid;
  destroySession(sid);
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');
  redirect(res, '/login');
}

// ── 后台管理操作 ──

function handleAdminHome(req, res, url) {
  if (!requireAdmin(req, res)) return;
  sendHtml(req, res, 200, adminPage(
    store.getSmtpPublic(),
    store.listTokens(),
    flashLocation(url.searchParams),
    store.getAdmin().username,
    selfOrigin(req)
  ));
}

function validSmtpForm(smtp) {
  if (!smtp.host) return 'SMTP 服务器不能为空';
  if (!smtp.user) return '账号不能为空';
  if (!smtp.pass) return '首次配置必须填写授权码';
  return '';
}

async function handleAdminSmtp(req, res, url) {
  if (!requireAdmin(req, res)) return;
  const form = new URLSearchParams((await readBody(req, FORM_BODY_LIMIT)).toString('utf8'));
  const input = {
    host: form.get('host') || '',
    port: form.get('port') || '',
    secure: form.get('secure') === 'true',
    user: form.get('user') || '',
    pass: form.get('pass') || '',
    fromName: form.get('fromName') || ''
  };
  const merged = store.mergeSmtp(input);
  const bad = validSmtpForm(merged);
  if (bad) {
    redirect(res, `/admin?type=err&msg=${encodeURIComponent(bad)}`);
    return;
  }

  if (url.searchParams.get('action') === 'test') {
    let testTo;
    try {
      testTo = parseRecipients(form.get('testTo') || '');
    } catch (e) {
      redirect(res, `/admin?type=err&msg=${encodeURIComponent('测试收件邮箱无效：' + e.message)}`);
      return;
    }
    try {
      await verifySmtp(merged);
      await sendViaSmtp(merged, {
        to: testTo,
        subject: 'mailrelay 测试邮件',
        text: `这是一封测试邮件，发送于 ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}（北京时间）。\n收到说明 SMTP 配置正常。`
      });
      redirect(res, `/admin?type=ok&msg=${encodeURIComponent(`测试邮件已发送至 ${testTo.join(', ')}（配置未保存，确认无误请点“保存配置”）`)}`);
    } catch (err) {
      redirect(res, `/admin?type=err&msg=${encodeURIComponent('测试失败：' + sanitizeSmtpError(err))}`);
    }
    return;
  }

  store.saveSmtp(input);
  log(`[admin] SMTP 配置已更新 host=${merged.host} user=${merged.user}`);
  redirect(res, `/admin?type=ok&msg=${encodeURIComponent('SMTP 配置已保存')}`);
}

async function handleAdminPassword(req, res) {
  if (!requireAdmin(req, res)) return;
  const form = new URLSearchParams((await readBody(req, FORM_BODY_LIMIT)).toString('utf8'));
  const admin = store.getAdmin();
  const username = (form.get('username') || '').trim();
  const oldPw = form.get('oldPassword') || '';
  const newPw = form.get('newPassword') || '';
  const newPw2 = form.get('newPassword2') || '';

  if (!username) return redirect(res, `/admin?type=err&msg=${encodeURIComponent('用户名不能为空')}`);
  if (!verifyPassword(oldPw, admin.passwordHash))
    return redirect(res, `/admin?type=err&msg=${encodeURIComponent('旧密码不正确')}`);
  if (newPw.length < 8 || newPw.length > 128)
    return redirect(res, `/admin?type=err&msg=${encodeURIComponent('新密码长度需为 8–128 位')}`);
  if (newPw !== newPw2)
    return redirect(res, `/admin?type=err&msg=${encodeURIComponent('两次输入的新密码不一致')}`);

  store.setAdmin(username, hashPassword(newPw));
  log('[admin] 管理员账号/密码已修改');
  redirect(res, `/admin?type=ok&msg=${encodeURIComponent('账号密码已修改')}`);
}

async function handleAdminTokens(req, res, match) {
  if (!requireAdmin(req, res)) return;
  // POST /admin/tokens
  if (!match) {
    const form = new URLSearchParams((await readBody(req, FORM_BODY_LIMIT)).toString('utf8'));
    try {
      const item = store.addToken(form.get('name') || '');
      log(`[admin] 新增 token name="${item.name}"`);
      redirect(res, `/admin?type=ok&msg=${encodeURIComponent(`已生成 token「${item.name}」，请在列表中复制`)}`);
    } catch (e) {
      redirect(res, `/admin?type=err&msg=${encodeURIComponent(e.message)}`);
    }
    return;
  }
  // POST /admin/tokens/:id/toggle | /delete
  await readBody(req, FORM_BODY_LIMIT).catch(() => Buffer.alloc(0));
  const [, id, action] = match;
  if (action === 'toggle') {
    const t = store.listTokens().find(x => x.id === id);
    if (t) {
      // 注意：setTokenEnabled 直接改的是配置对象本体，t.enabled 会随之变化，
      // 动作文案必须在切换前算好，否则日志语义反转
      const actionText = t.enabled ? '已停用' : '已启用';
      store.setTokenEnabled(id, !t.enabled);
      log(`[admin] token "${t.name}" ${actionText}`);
    }
  } else if (action === 'delete') {
    const t = store.listTokens().find(x => x.id === id);
    if (store.deleteToken(id) && t) log(`[admin] token "${t.name}" 已删除`);
  }
  redirect(res, '/admin');
}

// ── 路由 ──

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  const m = req.method;
  try {
    if (m === 'GET' && p === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (m === 'POST' && p === '/send') return await handleSend(req, res, url);

    if (m === 'GET' && p === '/') return redirect(res, '/admin');
    if (m === 'GET' && p === '/login') {
      const sid = parseCookies(req.headers.cookie).sid;
      if (isValidSession(sid)) return redirect(res, '/admin');
      return sendHtml(req, res, 200, loginPage());
    }
    if (m === 'POST' && p === '/login') return await handleLogin(req, res);
    if (m === 'POST' && p === '/logout') return handleLogout(req, res);

    if (m === 'GET' && p === '/admin') return handleAdminHome(req, res, url);
    if (m === 'POST' && (p === '/admin/smtp')) return await handleAdminSmtp(req, res, url);
    if (m === 'POST' && p === '/admin/password') return await handleAdminPassword(req, res);
    const tokenMatch = p.match(/^\/admin\/tokens\/([^/]+)\/(toggle|delete)$/);
    if (m === 'POST' && (p === '/admin/tokens' || tokenMatch))
      return await handleAdminTokens(req, res, tokenMatch);

    sendHtml(req, res, 404, loginPage('404 页面不存在'));
  } catch (err) {
    log('[error]', err);
    if (!res.headersSent) sendJson(res, 500, { success: false, error: '服务器内部错误' });
  }
});

server.listen(PORT, () => {
  log(`mailrelay 已启动: http://0.0.0.0:${PORT}（配置目录 ${DATA_DIR}）`);
});
