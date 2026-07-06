/**
 * 时间格式化服务（平台无关）
 *
 * Worker 运行在 UTC，本项目面向指定时区（默认中国 UTC+8）。
 * 时区偏移由全局设置 app_settings.tz_offset 决定，超管可在画面修改。
 * 所有推送/报告内的时间戳统一经此处按偏移换算，避免各处硬编码 +8。
 */

/** 默认时区偏移（小时），中国时间 */
const DEFAULT_TZ_OFFSET = 8;

/**
 * 解析时区偏移为合法数值
 * @param {*} v - 原始值（字符串/数字）
 * @returns {number} -12~14 之间的整数，非法则回退默认
 */
function parseOffset(v) {
  const n = parseInt(v, 10);
  if (isNaN(n) || n < -12 || n > 14) return DEFAULT_TZ_OFFSET;
  return n;
}

/**
 * 按时区偏移取本地时间分量
 * @param {number} nowMs - UTC 毫秒时间戳
 * @param {number} offset - 时区偏移（小时）
 * @returns {Object} { hour, day, month, year, minute, dateStr }
 */
function localParts(nowMs, offset) {
  const d = new Date(nowMs + offset * 3600 * 1000);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    dateStr: d.toISOString().slice(0, 10)
  };
}

/** 两位补零 */
function pad2(n) {
  return (n < 10 ? '0' : '') + n;
}

/**
 * 格式化为 YYYY-MM-DD HH:mm（按时区偏移）
 * @param {number} nowMs - UTC 毫秒时间戳
 * @param {number} offset - 时区偏移（小时）
 * @returns {string}
 */
function fmtDateTime(nowMs, offset = DEFAULT_TZ_OFFSET) {
  const p = localParts(nowMs, offset);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)} ${pad2(p.hour)}:${pad2(p.minute)}`;
}

/**
 * 格式化为 MM-DD HH:mm（按时区偏移，用于较短的推送主题）
 * @param {number} nowMs
 * @param {number} offset
 * @returns {string}
 */
function fmtShort(nowMs, offset = DEFAULT_TZ_OFFSET) {
  const p = localParts(nowMs, offset);
  return `${pad2(p.month)}-${pad2(p.day)} ${pad2(p.hour)}:${pad2(p.minute)}`;
}

export { DEFAULT_TZ_OFFSET, parseOffset, localParts, fmtDateTime, fmtShort };
