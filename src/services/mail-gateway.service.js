/**
 * 系统邮件网关：超管在系统设置配置一个 HTTP→SMTP 转发服务（仓库自带 mailrelay 或任意
 * 兼容接口），业务侧（邮箱验证码 / 找回密码）只与该网关通信，Workers/Node 双宿主均可 fetch。
 *
 * 约定接口（mailrelay POST /send 同构）：
 *   POST <url>
 *   Authorization: Bearer <token>（token 可空）
 *   {"to": "a@b.com", "subject": "...", "content": "纯文本正文"}
 *
 * 配置存 app_settings：mail_relay_url / mail_relay_token
 */

const SETTING_URL = 'mail_relay_url';
const SETTING_TOKEN = 'mail_relay_token';

// 收件人邮箱宽松校验（与 mailrelay isEmail 同口径，长度上限 254）
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(email) {
  return !!email && email.length <= 254 && EMAIL_RE.test(email);
}

/**
 * 读取系统邮件网关配置
 * @returns {Promise<{url:string, token:string}>}
 */
async function getMailGateway(storage) {
  const [url, token] = await Promise.all([
    storage.settings.get(SETTING_URL),
    storage.settings.get(SETTING_TOKEN)
  ]);
  return { url: (url || '').trim(), token: token || '' };
}

/**
 * 发送系统纯文本邮件；未配置网关抛错（调用方转 503）
 * @param {Object} storage
 * @param {string} to - 收件人（调用方已校验格式）
 * @param {string} subject
 * @param {string} text - 纯文本正文
 */
async function sendSystemMail(storage, to, subject, text) {
  const gw = await getMailGateway(storage);
  if (!gw.url) throw new Error('邮件服务未配置');
  try {
    const res = await fetch(gw.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(gw.token ? { Authorization: 'Bearer ' + gw.token } : {})
      },
      body: JSON.stringify({ to, subject, content: text })
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`邮件服务响应错误: ${res.status}${t ? ' ' + t.slice(0, 200) : ''}`);
    }
    const result = await res.json().catch(() => ({}));
    return result;
  } catch (err) {
    // 未配置错误直接抛；其余（网络层 DNS/拒连/TLS/超时、网关非 2xx）补全 cause 信息
    if (err.message === '邮件服务未配置') throw err;
    let cause = '';
    if (err && err.cause) {
      const c = err.cause;
      cause = ` [${c.code || c.name || 'cause'}: ${c.message || c}]`;
    }
    throw new Error(`邮件发送异常: ${err.message}${cause}`);
  }
}

/** 6 位邮箱验证码邮件正文（纯文本） */
function verificationMailText(code, purposeLabel) {
  return [
    `你正在进行「${purposeLabel}」操作，验证码为：`,
    '',
    `    ${code}`,
    '',
    '验证码 10 分钟内有效，请勿泄露给他人。',
    '如果这不是你本人的操作，请忽略本邮件。'
  ].join('\n');
}

/** 忘记密码邮件正文（纯文本）：含账号名与一次性重置链接 */
function resetPasswordMailText(username, resetUrl) {
  return [
    '你申请了重置生活面板账号密码。',
    '',
    `你的登录账号：${username}`,
    `重置链接（1 小时内有效，仅可使用一次）：${resetUrl}`,
    '',
    '打开链接即可设置新密码。如果这不是你本人的操作，请忽略本邮件。'
  ].join('\n');
}

export {
  getMailGateway, sendSystemMail, isValidEmail,
  verificationMailText, resetPasswordMailText
};
