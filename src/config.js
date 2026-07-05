/**
 * 全局常量与配置读取
 */

// 返回格式类型
const RETURN_TYPES = { TEXT: 'text', HTML: 'html' };

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

export {
  RETURN_TYPES, DEFAULT_TIMEOUT, DEFAULT_RESPONSE_TIMEOUT,
  DEFAULT_CONCURRENCY_LIMIT, DEFAULT_BATCH_DELAY, SESSION_TTL,
  DEFAULT_WEBHOOK_URL, getTimeoutConfig
};
