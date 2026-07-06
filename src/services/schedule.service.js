/**
 * 定时调度判断（平台无关的纯函数）
 *
 * 设计目的：Worker 每小时被唤醒一次，读数据库里各用户的推送配置，
 * 用 shouldRun 判断"此刻是否到点该发"。判断逻辑与平台无关——
 * 将来迁移到 Node/crontab 等，只需换"每小时唤醒"的触发方式，此文件原样复用。
 */

/**
 * 取北京时区当前时间的 { hour, day, month, dateStr }
 * @param {number} nowMs - 当前毫秒时间戳（由调用方传入，便于测试）
 * @returns {Object}
 */
function nowCN(nowMs) {
  const d = new Date(nowMs + 8 * 3600 * 1000); // UTC+8
  return {
    hour: d.getUTCHours(),
    day: d.getUTCDate(),
    month: d.getUTCMonth() + 1,
    dateStr: d.toISOString().slice(0, 10)
  };
}

/**
 * 判断某模块的推送配置此刻是否应执行
 * @param {string} module - 'fund' | 'weight' | 'asset'
 * @param {Object} cfg - push_config 记录 { hour, day }
 * @param {Object} now - nowCN() 结果
 * @returns {boolean}
 * 规则：
 *   fund / weight  = 每天在 cfg.hour 那一小时执行
 *   asset          = 每月 cfg.day 号的 cfg.hour 那一小时执行
 */
function shouldRun(module, cfg, now) {
  if (!cfg) return false;
  const hour = cfg.hour != null ? cfg.hour : 9;
  if (module === 'asset') {
    const day = cfg.day != null ? cfg.day : 15;
    return now.day === day && now.hour === hour;
  }
  // daily 类：fund / weight
  return now.hour === hour;
}

export { nowCN, shouldRun };
