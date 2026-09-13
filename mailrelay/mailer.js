/**
 * 邮件发送：nodemailer transporter 按 SMTP 配置缓存，配置变化才重建
 */
import nodemailer from 'nodemailer';

let _transport = null;
let _transportKey = '';

/** 收件人邮箱的宽松校验（够挡明显的拼写错误，不追求 RFC 完全合规） */
export function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
}

/**
 * 解析收件人：数组 / 逗号、分号、空白分隔的字符串均可，去重去空并校验
 * @param {string|string[]} input
 * @returns {string[]}
 * @throws {Error} 含非法邮箱时抛出（消息可直接回给调用方）
 */
export function parseRecipients(input) {
  let arr;
  if (Array.isArray(input)) {
    arr = input.flatMap(x => String(x).split(/[,;\s]+/));
  } else {
    arr = String(input || '').split(/[,;\s]+/);
  }
  const list = [...new Set(arr.map(x => x.trim()).filter(Boolean))];
  if (list.length === 0) throw new Error('收件人 to 不能为空');
  if (list.length > 50) throw new Error('收件人数量不能超过 50 个');
  const bad = list.find(x => !isEmail(x));
  if (bad) throw new Error(`收件人邮箱格式不正确: ${bad}`);
  return list;
}

function transportKey(smtp) {
  return JSON.stringify([smtp.host, smtp.port, smtp.secure, smtp.user, smtp.pass]);
}

function buildTransport(smtp) {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: !!smtp.secure, // true=SSL(465)；false=STARTTLS(587)
    auth: { user: smtp.user, pass: smtp.pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
}

/** 取 transporter（同配置复用连接池） */
export function getTransport(smtp) {
  const k = transportKey(smtp);
  if (!_transport || _transportKey !== k) {
    _transport = buildTransport(smtp);
    _transportKey = k;
  }
  return _transport;
}

/**
 * 校验 SMTP 连通性/账号密码（不实际发信）
 * @param {object} smtp store 中的 smtp 配置（含密码）
 */
export async function verifySmtp(smtp) {
  await getTransport(smtp).verify();
}

/**
 * 发送邮件
 * @param {object} smtp store 中的 smtp 配置（含密码）
 * @param {{to:string[], subject:string, text?:string, html?:string}} mail
 * @returns {Promise<string>} messageId
 */
export async function sendViaSmtp(smtp, mail) {
  const from = smtp.fromName
    ? { name: smtp.fromName, address: smtp.user }
    : smtp.user;
  const info = await getTransport(smtp).sendMail({
    from,
    to: mail.to.join(', '),
    subject: mail.subject,
    text: mail.text || '',
    ...(mail.html ? { html: mail.html } : {})
  });
  return info.messageId;
}

/**
 * SMTP 错误脱敏：只保留 code/command 与首行消息，避免回传任何鉴权细节
 * @param {any} err
 * @returns {string}
 */
export function sanitizeSmtpError(err) {
  const tag = err?.code || err?.command || 'SMTP';
  const firstLine = String(err?.message || err || '未知错误').split('\n')[0].slice(0, 200);
  return `${tag}: ${firstLine}`;
}
