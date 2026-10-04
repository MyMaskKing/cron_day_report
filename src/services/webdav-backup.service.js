/**
 * WebDAV 自动备份编排
 * - runScheduledBackup: 每小时调度调用, 按开关与判时决定是否执行
 * - runBackupNow: 超管「立即备份」调用, 忽略开关与判时
 * 注意: 本文件从 backup.api.js 引入 buildBackupPayload, backup.api.js 的 handler
 * 又引入本文件——函数声明在 ESM 中提升且仅在运行时调用, 循环依赖安全。
 */

import { buildBackupPayload } from '../api/backup.api.js';
import { nowCN, shouldBackupRun } from './schedule.service.js';
import { createWebdavClient, joinUrl } from './webdav.service.js';
import { parseOffset } from './time.service.js';

// 配置缺省值（存储键名 = webdav_ + 键名）
const WEBDAV_DEFAULTS = {
  enabled: '0', url: '', dir: 'cron-day-report', user: '', pass: '',
  freq: 'daily', hour: '2', weekday: '1', monthday: '1', keep: '30'
};
// 保存文件夹留空时落的默认目录
const DEFAULT_DIR = WEBDAV_DEFAULTS.dir;

/**
 * 读全部 WebDAV 配置; app_settings 中缺失的键回默认值
 * @returns {Promise<Object>}
 */
async function readWebdavConfig(storage) {
  const out = {};
  for (const k of Object.keys(WEBDAV_DEFAULTS)) {
    const v = await storage.settings.get('webdav_' + k);
    out[k] = v == null ? WEBDAV_DEFAULTS[k] : v;
    // 老数据 dir 为空串也回默认目录（根目录直传在坚果云等服务上不可用）
    if (k === 'dir' && out[k] === '') out[k] = DEFAULT_DIR;
  }
  return out;
}

/**
 * 生成备份文件名（配置时区口径）: backup-YYYY-MM-DD-HH.json
 */
function backupFilename(now) {
  return 'backup-' + now.dateStr + '-' + String(now.hour).padStart(2, '0') + '.json';
}

/**
 * 保留清理: 成功记录按 id 倒序, 超出 keep 份的远端删除并删本地行;
 * 单个删除失败跳过, 下次备份再试
 */
async function pruneOldBackups(client, storage, keep) {
  const rows = await storage.backupLog.listSuccess();
  for (const row of rows.slice(keep)) {
    try {
      await client.deleteFile(row.filename);
      await storage.backupLog.delete(row.id);
    } catch {
      // 忽略单条删除失败
    }
  }
}

/**
 * 执行一次备份（不判开关/时间）; 失败不外抛, 落 fail 日志后返回 error
 * @returns {Promise<{filename:string, size?:number, error?:string}>}
 */
async function executeBackup(env, storage, now) {
  const cfg = await readWebdavConfig(storage);
  const filename = backupFilename(now);
  try {
    const payload = await buildBackupPayload(storage);
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    // 保存文件夹相对服务器地址的增量段（服务器地址指向的目录视为已存在）
    const dirSegs = String(cfg.dir || '').trim().replace(/^\/+/, '')
      .split('/').map(s => s.trim()).filter(Boolean);
    const target = joinUrl(cfg.url, dirSegs.join('/'));
    // 先探测服务器地址本身是否存在（诊断用，不阻断）
    const urlStatus = await createWebdavClient(cfg.url, cfg.user, cfg.pass).probe();
    const client = createWebdavClient(target, cfg.user, cfg.pass);
    // 逐级 MKCOL 创建保存文件夹，记录每级状态码供 PUT 失败时诊断
    const mkTrace = await client.ensureDir(cfg.url, dirSegs);
    try {
      await client.putFile(filename, bytes);
    } catch (e) {
      if (/HTTP 404/.test(e.message)) {
        const detail = mkTrace.map(t => t.seg + '→' + t.status).join('；');
        throw new Error('备份目录不存在（PUT 404）。服务器地址探测：' + urlStatus
          + '；建目录结果：' + detail
          + '。若地址探测为 404，请修改「服务器地址」；若为 401/403，账号无写入权限');
      }
      throw e;
    }
    await storage.backupLog.upsertSuccess(filename, bytes.length);
    const keep = parseInt(cfg.keep, 10);
    await pruneOldBackups(client, storage, Number.isInteger(keep) && keep > 0 ? keep : 30);
    return { filename, size: bytes.length };
  } catch (e) {
    const message = e && e.message ? e.message : String(e);
    await storage.backupLog.upsertFail(filename, message);
    return { filename, error: message };
  }
}

/**
 * 按计划执行（handleScheduled 调用）
 * - url/user/pass 缺失: skipped
 * - 非 manual: 要求 enabled='1' 且 shouldBackupRun 通过
 * - manual(/cron 手动触发): 忽略开关与判时
 */
async function runScheduledBackup(env, storage, now, manual) {
  const cfg = await readWebdavConfig(storage);
  if (!cfg.url || !cfg.user || !cfg.pass) {
    return { skipped: true, reason: 'WebDAV 未配置完整（地址/账号/密码）' };
  }
  if (!manual) {
    if (cfg.enabled !== '1') return { skipped: true, reason: '自动备份未启用' };
    if (!shouldBackupRun(cfg, now)) return { skipped: true, reason: '此刻不在备份计划时间' };
  }
  return await executeBackup(env, storage, now);
}

/**
 * 立即备份（超管 API 调用）; 未配置完整直接返回 error 结果
 */
async function runBackupNow(env, storage) {
  const cfg = await readWebdavConfig(storage);
  if (!cfg.url || !cfg.user || !cfg.pass) {
    return { error: 'WebDAV 未配置完整（地址/账号/密码），请先保存配置' };
  }
  const tzOffset = parseOffset(await storage.settings.get('tz_offset'));
  const now = nowCN(Date.now(), tzOffset);
  return await executeBackup(env, storage, now);
}

export { DEFAULT_DIR, readWebdavConfig, runScheduledBackup, runBackupNow };
