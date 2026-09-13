/**
 * 超管「附件存储管理」API（双运行时：R2 / Docker 磁盘）
 *   GET  /api/admin/files/stats           占用统计（按 source 分组 + 单文件上限）
 *   GET  /api/admin/files?limit=&offset=  文件列表（倒序分页，带归属用户名）
 *   POST /api/admin/files/delete          批量删除已登记文件（对象 + DB 行）
 *   GET  /api/admin/files/orphans         扫描孤儿对象（对象有、files 表无记录）
 *   POST /api/admin/files/orphans/delete  批量清理孤儿对象（只删对象，不碰 DB）
 *
 * 全部 requireAdmin；文件本体经统一文件存储抽象 env.FILES（R2FileStore / FileStoreShim）。
 */
import { json, error } from '../router.js';
import { getStorage } from '../storage/adapter.js';
import { getFileStore } from '../storage/file-store.js';
import { requireAdmin } from '../auth/middleware.js';
import { attachMaxMb } from './file.api.js';

// 合法对象 key：<source>/<file_token>，token 为 16~64 位 base64url 字符（generateToken 产 32 位）
const KEY_RE = /^(todo|user)\/[A-Za-z0-9_-]{16,64}$/;
const MAX_DELETE_FILES = 200;
const MAX_DELETE_ORPHANS = 1000;

/** GET /api/admin/files/stats */
async function fileStats({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;

  const storage = getStorage(env);
  const groups = await storage.file.stats();
  const bySource = {
    todo: { count: 0, bytes: 0 },
    user: { count: 0, bytes: 0 }
  };
  let totalCount = 0;
  let totalBytes = 0;
  for (const g of groups) {
    if (bySource[g.source]) bySource[g.source] = { count: g.cnt, bytes: g.bytes };
    totalCount += g.cnt;
    totalBytes += g.bytes;
  }
  return json({
    success: true,
    totalCount,
    totalBytes,
    bySource,
    maxMb: await attachMaxMb(storage)
  });
}

function fileRowJson(r) {
  return {
    id: r.id,
    source: r.source,
    ownerUid: r.owner_uid,
    ownerName: r.owner_name || null,
    todoId: r.todo_id,
    fileToken: r.file_token,
    originName: r.origin_name,
    mime: r.mime,
    size: r.size,
    isImage: !!r.is_image,
    createdAt: r.created_at,
    url: '/todo-file/' + r.file_token
  };
}

/** GET /api/admin/files?limit=&offset= */
async function listAdminFiles({ request, env, url }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;

  let limit = parseInt(url.searchParams.get('limit') || '50', 10);
  let offset = parseInt(url.searchParams.get('offset') || '0', 10);
  if (!Number.isFinite(limit) || limit < 1) limit = 50;
  if (limit > 200) limit = 200;
  if (!Number.isFinite(offset) || offset < 0) offset = 0;

  const { rows, total } = await getStorage(env).file.listForAdmin({ limit, offset });
  return json({ success: true, rows: rows.map(fileRowJson), total });
}

/** POST /api/admin/files/delete  body: { ids: number[] } */
async function deleteAdminFiles({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;

  const files = getFileStore(env);
  if (!files) return error('附件存储未配置，请联系管理员绑定 R2', 503);

  let body;
  try { body = await request.json(); } catch { return error('请求数据格式不正确', 400); }
  const ids = Array.isArray(body && body.ids)
    ? [...new Set(body.ids.map(v => parseInt(v, 10)))].filter(v => Number.isInteger(v) && v > 0)
    : [];
  if (!ids.length) return error('未选择任何文件', 400);
  if (ids.length > MAX_DELETE_FILES) return error(`单次最多删除 ${MAX_DELETE_FILES} 个文件`, 400);

  const storage = getStorage(env);
  const rows = await storage.file.findByIds(ids);
  const okIds = [];
  const failed = [];
  for (const r of rows) {
    try {
      await files.delete((r.source === 'todo' ? 'todo/' : 'user/') + r.file_token);
      okIds.push(r.id);
    } catch (e) {
      // 对象删除失败则保留 DB 行，避免制造死链
      failed.push({ id: r.id, message: e && e.message ? e.message : '删除失败' });
    }
  }
  await storage.file.removeByIds(okIds);
  return json({ success: true, deletedCount: okIds.length, failed });
}

/** GET /api/admin/files/orphans */
async function scanOrphanFiles({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;

  const files = getFileStore(env);
  if (!files) return error('附件存储未配置，请联系管理员绑定 R2', 503);

  const [objects, tokens] = await Promise.all([
    files.list(''),
    getStorage(env).file.allTokens()
  ]);
  const known = new Set(tokens);
  const orphans = [];
  let totalBytes = 0;
  for (const o of objects) {
    const m = KEY_RE.exec(o.key);
    if (!m) continue; // 不合规 key（非本系统对象）一律忽略，避免误动 bucket 内其他数据
    const token = o.key.slice(o.key.indexOf('/') + 1);
    if (known.has(token)) continue;
    orphans.push({ key: o.key, source: m[1], token, size: o.size });
    totalBytes += o.size;
  }
  orphans.sort((a, b) => b.size - a.size);
  return json({ success: true, count: orphans.length, totalBytes, orphans });
}

/** POST /api/admin/files/orphans/delete  body: { keys: string[] } */
async function deleteOrphanFiles({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;

  const files = getFileStore(env);
  if (!files) return error('附件存储未配置，请联系管理员绑定 R2', 503);

  let body;
  try { body = await request.json(); } catch { return error('请求数据格式不正确', 400); }
  const keys = Array.isArray(body && body.keys) ? [...new Set(body.keys.map(v => String(v)))] : [];
  if (!keys.length) return error('未选择任何孤儿文件', 400);
  if (keys.length > MAX_DELETE_ORPHANS) return error(`单次最多清理 ${MAX_DELETE_ORPHANS} 个对象`, 400);
  // 白名单不过直接拒绝整请求，杜绝任意 key 删除
  if (keys.some(k => !KEY_RE.test(k))) return error('包含非法对象 key', 400);

  // 删除前二次查库：扫描后新登记的对象跳过不删
  const known = new Set(await getStorage(env).file.allTokens());
  const deleted = [];
  const skipped = [];
  const failed = [];
  for (const key of keys) {
    const token = key.slice(key.indexOf('/') + 1);
    if (known.has(token)) { skipped.push(key); continue; }
    try {
      await files.delete(key);
      deleted.push(key);
    } catch (e) {
      failed.push({ key, message: e && e.message ? e.message : '删除失败' });
    }
  }
  return json({ success: true, deleted, skipped, failed });
}

export { fileStats, listAdminFiles, deleteAdminFiles, scanOrphanFiles, deleteOrphanFiles };
