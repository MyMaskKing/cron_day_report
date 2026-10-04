/**
 * 数据全量备份与恢复（仅超管）
 * - GET  /api/admin/backup/export  下载全量业务数据 JSON（含净值缓存，不含运行日志/登录会话）
 * - POST /api/admin/backup/import  上传备份 JSON，全量覆盖当前库（单库内分块事务）
 * 备份文件可在 Cloudflare D1 与多个 Docker（better-sqlite3）实例间互导。
 */

import { json, error } from '../router.js';
import { getStorage } from '../storage/adapter.js';
import { requireAdmin } from '../auth/middleware.js';
import { readWebdavConfig, runBackupNow } from '../services/webdav-backup.service.js';
import { createWebdavClient, resolveDavUrl } from '../services/webdav.service.js';

const BACKUP_FORMAT = 'cron-day-report-backup';

/**
 * 构造全量备份载荷（手动导出与 WebDAV 自动备份共用，防格式分叉）
 * @param {Object} storage
 * @returns {Promise<{format:string, version:number, exported_at:string, tables:Object}>}
 */
async function buildBackupPayload(storage) {
  const tables = await storage.backup.dumpTables();
  return {
    format: BACKUP_FORMAT,
    version: 1,
    exported_at: new Date().toISOString(),
    tables
  };
}

/**
 * GET /api/admin/backup/export  导出全量备份文件
 */
async function exportBackup({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;

  const storage = getStorage(env);
  if (!storage.backup || !storage.backup.dumpTables) {
    return error('当前存储驱动不支持数据导出', 400);
  }

  const payload = await buildBackupPayload(storage);
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD（UTC）
  return new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="backup-${date}.json"`
    }
  });
}

/**
 * POST /api/admin/backup/import  全量覆盖导入
 * body: 备份文件解析后的对象（{ format, version, tables }）
 */
async function importBackup({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;

  const storage = getStorage(env);
  if (!storage.backup || !storage.backup.restoreTables) {
    return error('当前存储驱动不支持数据导入', 400);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return error('请求体不是合法 JSON，请上传备份文件', 400);
  }
  if (!body || body.format !== BACKUP_FORMAT || !body.tables || typeof body.tables !== 'object') {
    return error('文件格式不正确：不是本系统的备份文件', 400);
  }

  try {
    const counts = await storage.backup.restoreTables(body.tables);
    const total = Object.values(counts).reduce((s, n) => s + (Number(n) || 0), 0);
    return json({ success: true, message: `导入完成，共 ${total} 条记录`, counts, total });
  } catch (e) {
    return error('导入失败：' + (e && e.message ? e.message : String(e)), 500);
  }
}

// ==================== WebDAV 自动备份配置（仅超管） ====================

/**
 * GET /api/admin/backup/webdav  读配置（密码只回 hasPass）
 */
async function getWebdavConfig({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;
  const cfg = await readWebdavConfig(getStorage(env));
  return json({
    enabled: cfg.enabled, url: cfg.url, dir: cfg.dir, user: cfg.user,
    freq: cfg.freq, hour: cfg.hour, weekday: cfg.weekday,
    monthday: cfg.monthday, keep: cfg.keep, hasPass: !!cfg.pass
  });
}

/**
 * GET /api/admin/backup/webdav/raw  读含明文密码的完整配置（仅供一键复制；仅超管）
 */
async function getWebdavConfigRaw({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;
  const cfg = await readWebdavConfig(getStorage(env));
  return json({
    enabled: cfg.enabled, url: cfg.url, dir: cfg.dir, user: cfg.user, pass: cfg.pass,
    freq: cfg.freq, hour: cfg.hour, weekday: cfg.weekday,
    monthday: cfg.monthday, keep: cfg.keep
  });
}

/**
 * POST /api/admin/backup/webdav  保存配置（密码留空 = 不修改）
 */
async function saveWebdavConfig({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);

  let body;
  try {
    body = await request.json();
  } catch {
    return error('请求体不是合法 JSON', 400);
  }

  const url = String(body.url || '').trim();
  if (!/^https?:\/\//.test(url)) return error('服务器地址需以 http:// 或 https:// 开头', 400);
  const freq = String(body.freq || 'daily');
  if (!['daily', 'weekly', 'monthly'].includes(freq)) return error('备份周期不合法', 400);
  const hour = parseInt(body.hour, 10);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return error('备份小时需为 0–23 的整数', 400);
  const weekday = parseInt(body.weekday, 10);
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) return error('星期需为 1–7 的整数', 400);
  const monthday = parseInt(body.monthday, 10);
  if (!Number.isInteger(monthday) || monthday < 1 || monthday > 31) return error('日期需为 1–31 的整数', 400);
  const keep = parseInt(body.keep, 10);
  if (!Number.isInteger(keep) || keep < 1 || keep > 365) return error('保留份数需为 1–365 的整数', 400);
  const dir = String(body.dir == null ? '' : body.dir).trim().replace(/^\/+/, '');
  const user = String(body.user || '').trim();

  const sets = {
    webdav_enabled: body.enabled ? '1' : '0',
    webdav_url: url,
    webdav_dir: dir,
    webdav_user: user,
    webdav_freq: freq,
    webdav_hour: String(hour),
    webdav_weekday: String(weekday),
    webdav_monthday: String(monthday),
    webdav_keep: String(keep)
  };
  // 密码未传/空串 = 保留原密码; 非空才覆盖
  if (body.pass) sets.webdav_pass = String(body.pass);
  for (const [k, v] of Object.entries(sets)) await storage.settings.set(k, v);

  const cfg = await readWebdavConfig(storage);
  return json({
    enabled: cfg.enabled, url: cfg.url, dir: cfg.dir, user: cfg.user,
    freq: cfg.freq, hour: cfg.hour, weekday: cfg.weekday,
    monthday: cfg.monthday, keep: cfg.keep, hasPass: !!cfg.pass
  });
}

/**
 * POST /api/admin/backup/webdav/test  测试连接（支持未保存先测:
 * body 提供的字段优先, 缺省用已存配置）；业务失败 HTTP 仍 200, success:false
 */
async function testWebdav({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const saved = await readWebdavConfig(storage);
  const url = String(body.url != null && body.url !== '' ? body.url : saved.url).trim();
  const dir = String(body.dir != null && body.dir !== '' ? body.dir : saved.dir).trim().replace(/^\/+/, '');
  const user = String(body.user != null && body.user !== '' ? body.user : saved.user).trim();
  const pass = body.pass ? String(body.pass) : saved.pass;
  if (!url || !user || !pass) {
    return json({ success: false, message: '服务器地址、账号、密码不完整' });
  }
  if (!/^https?:\/\//.test(url)) {
    return json({ success: false, message: '服务器地址需以 http:// 或 https:// 开头' });
  }
  try {
    await createWebdavClient(resolveDavUrl(url, dir), user, pass).testConnection();
    return json({ success: true, message: '连接成功' });
  } catch (e) {
    const message = e && e.message ? e.message : String(e);
    // 子目录可能尚未创建: PROPFIND 404 时给出可操作提示，不视为认证/网络故障
    if (/HTTP 404/.test(message)) {
      return json({ success: false, message: '服务器可连通，但保存文件夹可能不存在（首次备份会自动尝试上传创建）' });
    }
    return json({ success: false, message });
  }
}

/**
 * POST /api/admin/backup/webdav/run-now  立即备份一次；失败结果 HTTP 仍 200
 */
async function runWebdavBackupNow({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;
  const result = await runBackupNow(env, getStorage(env));
  return json(result.error ? { success: false, ...result } : { success: true, ...result });
}

/**
 * GET /api/admin/backup/webdav/logs?limit=  执行历史（默认 30，上限 100）
 */
async function listWebdavLogs({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  const u = new URL(request.url);
  let limit = parseInt(u.searchParams.get('limit'), 10);
  if (!Number.isInteger(limit) || limit <= 0) limit = 30;
  if (limit > 100) limit = 100;
  const rows = await storage.backupLog.listRecent(limit);
  return json({ rows });
}

/**
 * DELETE /api/admin/backup/webdav/logs  一键清空全部备份日志
 * 仅清本地执行历史，不删除 WebDAV 上已上传的备份文件
 */
async function clearWebdavLogs({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;
  const storage = getStorage(env);
  await storage.backupLog.clear();
  return json({ success: true, message: '备份日志已清空' });
}

export {
  exportBackup, importBackup, buildBackupPayload,
  getWebdavConfig, getWebdavConfigRaw, saveWebdavConfig,
  testWebdav, runWebdavBackupNow, listWebdavLogs, clearWebdavLogs
};
