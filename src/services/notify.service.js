/**
 * 通知服务：按渠道配置发送消息
 * 渠道类型: wechat(企业微信机器人) | webhook(通用/自定义POST) | email(通过webhook转发)
 * 迁移自原 index.js，扩展支持自定义 method/headers/body 模板。
 */

import { RETURN_TYPES } from '../config.js';

/**
 * 发送通知
 * @param {string} message - 消息内容
 * @param {Object} channel - 通知渠道 { type, url, method, headers_json, body_template, name }
 * @param {string} returnType - 'text' | 'html'
 * @param {string} subject - 邮件主题（仅 email 类型使用；含推送内容主题+时间）
 * @returns {Promise<Object>} { success, message }
 */
async function sendNotification(message, channel, returnType = 'text', subject = '') {
  if (!channel || !channel.url) {
    return { success: false, message: '未配置通知渠道' };
  }
  try {
    switch (channel.type) {
      case 'wechat':
        return await sendToWeChat(message, channel.url);
      case 'email':
        return await sendToEmail(message, channel, subject);
      case 'webhook':
      default:
        return await sendToWebhook(message, channel, returnType);
    }
  } catch (err) {
    return { success: false, message: `发送异常: ${err.message}` };
  }
}

/**
 * 企业微信机器人
 * @param {string} message
 * @param {string} webhookUrl
 * @returns {Promise<Object>}
 */
async function sendToWeChat(message, webhookUrl) {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msgtype: 'text', text: { content: message } })
    });
    const result = await response.json();
    return result.errcode === 0
      ? { success: true, message: '微信机器人消息发送成功' }
      : { success: false, message: `微信机器人发送失败: ${result.errmsg}` };
  } catch (err) {
    return { success: false, message: `微信机器人发送异常: ${err.message}` };
  }
}

/**
 * 通用 Webhook（支持自定义 method / headers / body 模板）
 * body_template 中的 {{content}} 会被替换为 message
 * @param {string} message
 * @param {Object} channel
 * @param {string} returnType
 * @returns {Promise<Object>}
 */
async function sendToWebhook(message, channel, returnType) {
  try {
    let headers = { 'Content-Type': returnType === RETURN_TYPES.HTML ? 'text/html' : 'text/plain' };
    if (channel.headers_json) {
      try { headers = { ...headers, ...JSON.parse(channel.headers_json) }; } catch { /* 忽略非法JSON */ }
    }

    let body;
    if (channel.body_template) {
      body = channel.body_template.replace(/\{\{content\}\}/g, jsonEscapeIfNeeded(message, headers));
    } else {
      body = message;
    }

    const response = await fetch(channel.url, {
      method: channel.method || 'POST',
      headers,
      body
    });
    return response.ok
      ? { success: true, message: 'Webhook消息发送成功' }
      : { success: false, message: `Webhook发送失败: ${response.status} ${response.statusText}` };
  } catch (err) {
    return { success: false, message: `Webhook发送异常: ${err.message}` };
  }
}

/**
 * 若 Content-Type 为 JSON 且使用模板，对内容做 JSON 字符串转义（去引号）
 * @param {string} message
 * @param {Object} headers
 * @returns {string}
 */
function jsonEscapeIfNeeded(message, headers) {
  const ct = (headers['Content-Type'] || headers['content-type'] || '').toLowerCase();
  if (ct.includes('json')) {
    const s = JSON.stringify(message);
    return s.slice(1, -1); // 去掉首尾引号，供模板内嵌
  }
  return message;
}

/**
 * 邮件（通过 webhook 转发，迁移自原实现）
 * @param {string} message
 * @param {Object} channel - 需含 url, 可用 body_template 携带 to/subject
 * @param {string} subject - 邮件主题（优先于 headers_json.subject）
 * @returns {Promise<Object>}
 */
async function sendToEmail(message, channel, subject = '') {
  try {
    if (!channel.url) return { success: false, message: 'Webhook地址未配置' };
    // 邮件元信息从 headers_json 读取（mailto/subject）
    let meta = {};
    if (channel.headers_json) {
      try { meta = JSON.parse(channel.headers_json); } catch { /* 忽略 */ }
    }
    const emailData = {
      to: meta.mailto || meta.to || '',
      subject: subject || meta.subject || '定时任务执行报告',
      content: message
    };
    const response = await fetch(channel.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emailData)
    });
    if (response.ok) {
      const result = await response.json().catch(() => ({}));
      return { success: true, message: '邮件发送成功', details: result };
    }
    const errorText = await response.text();
    return { success: false, message: `邮件服务响应错误: ${response.status}`, details: errorText };
  } catch (err) {
    return { success: false, message: `邮件发送异常: ${err.message}` };
  }
}

export { sendNotification, sendToWeChat, sendToWebhook, sendToEmail };
