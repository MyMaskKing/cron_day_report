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
 * 规则（支持多选，hours/days 为逗号分隔字符串）：
 *   fund / weight / monitor = 每天在 hours 任一小时执行
 *   asset                   = 每月 days 任一天的 hours 任一小时执行
 */
function shouldRun(module, cfg, now) {
  if (!cfg) return false;
  // 优先用多值 hours/days，回退单值 hour/day
  const hoursStr = cfg.hours != null && cfg.hours !== '' ? String(cfg.hours) : String(cfg.hour != null ? cfg.hour : 9);
  const hours = hoursStr.split(',').map(s => parseInt(s, 10)).filter(n => !isNaN(n));
  if (!hours.includes(now.hour)) return false;
  if (module === 'asset') {
    const daysStr = cfg.days != null && cfg.days !== '' ? String(cfg.days) : String(cfg.day != null ? cfg.day : 15);
    const days = daysStr.split(',').map(s => parseInt(s, 10)).filter(n => !isNaN(n));
    return days.includes(now.day);
  }
  return true;
}

export { nowCN, shouldRun };
