/**
 * 全局常量与配置读取
 */

// 返回格式类型
const RETURN_TYPES = { TEXT: 'text', HTML: 'html' };

// 推送报告可选格式（markdown 仅企业微信/通用 webhook 有意义，email 收到按纯文本发）
const ALLOWED_FORMATS = ['text', 'html', 'markdown'];

// 默认超时/并发配置（毫秒）
const DEFAULT_TIMEOUT = 30000;
const DEFAULT_RESPONSE_TIMEOUT = 60000;
const DEFAULT_CONCURRENCY_LIMIT = 5;
const DEFAULT_BATCH_DELAY = 1000;

// 会话有效期（秒）：7 天
const SESSION_TTL = 7 * 24 * 3600;

// 企业微信机器人默认地址
const DEFAULT_WEBHOOK_URL = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send';

/**
 * 获取超时配置
 * @param {Object} env - 环境变量对象
 * @returns {Object} 超时配置
 */
function getTimeoutConfig(env) {
  return {
    timeout: parseInt(env.REQUEST_TIMEOUT) || DEFAULT_TIMEOUT,
    responseTimeout: parseInt(env.RESPONSE_TIMEOUT) || DEFAULT_RESPONSE_TIMEOUT,
    concurrencyLimit: parseInt(env.CONCURRENCY_LIMIT) || DEFAULT_CONCURRENCY_LIMIT,
    batchDelay: parseInt(env.BATCH_DELAY) || DEFAULT_BATCH_DELAY
  };
}

/**
 * 解析站点公开地址：DB 设置优先，其次配置文件 env，最后 url.origin 兜底
 * @param {Object} storage - 存储适配器
 * @param {Object} env - Worker 环境
 * @param {URL} [url] - 请求 URL（调度上下文无 request 时传 undefined）
 * @returns {Promise<string>} 站点基址（可能为空字符串）
 */
async function resolveBaseUrl(storage, env, url) {
  const fromDb = await storage.settings.get('public_base_url');
  if (fromDb) return fromDb;
  if (env.PUBLIC_BASE_URL) return env.PUBLIC_BASE_URL;
  return url ? url.origin : '';
}

/**
 * 按渠道类型计算有效推送格式（自动降级）
 * email: 支持 text/html，markdown 无意义降级为 text
 * wechat/webhook: 支持 text/markdown，html 无意义降级为 text
 * @param {string} format - 用户选择的格式 text|html|markdown
 * @param {string} channelType - 渠道类型 email|wechat|webhook
 * @returns {string} 该渠道实际使用的格式
 */
function effectiveFormat(format, channelType) {
  if (channelType === 'email') return format === 'markdown' ? 'text' : format;
  return format === 'html' ? 'text' : format;
}

export {
  RETURN_TYPES, ALLOWED_FORMATS, DEFAULT_TIMEOUT, DEFAULT_RESPONSE_TIMEOUT,
  DEFAULT_CONCURRENCY_LIMIT, DEFAULT_BATCH_DELAY, SESSION_TTL,
  DEFAULT_WEBHOOK_URL, getTimeoutConfig, resolveBaseUrl, effectiveFormat
};
