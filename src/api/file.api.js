/**
 * 通用文件 API（业务无关）
 * - POST /api/files/upload          登录态个人文件上传（Markdown 内嵌图片/附件，files 表 source='user'，key 前缀 user/）
 * - GET  /todo-file/:fileToken      长期免密下载（file_token 全局唯一；key 前缀按行 source：todo/ 或 user/）
 * - GET  /api/public/attach-max-mb  单文件大小上限（前端预检，全局非敏感）
 * saveFile() 同时供待办任务附件（source='todo'）复用，业务鉴权在 todo.api.js。
 */

import { json, error } from '../router.js';
import { getStorage } from '../storage/adapter.js';
import { requireAuth } from '../auth/middleware.js';
import { generateToken } from '../auth/password.js';
import { getFileStore } from '../storage/file-store.js';

// 允许内联渲染的图片类型；SVG 永远不算图片（可内嵌脚本，强制下载）
const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const DEFAULT_ATTACH_MAX_MB = 5;

async function attachMaxMb(storage) {
  const raw = parseInt(await storage.settings.get('todo_attach_max_mb'), 10);
  return (!isNaN(raw) && raw >= 1 && raw <= 50) ? raw : DEFAULT_ATTACH_MAX_MB;
}

/** 存储行 → 对外 JSON（url 为长期免密下载地址；source='user' 的行 todo_id 为 null） */
function attachmentJson(r) {
  return {
    id: r.id, todo_id: r.todo_id == null ? null : r.todo_id, file_token: r.file_token, origin_name: r.origin_name,
    mime: r.mime, size: r.size, is_image: !!r.is_image, url: '/todo-file/' + r.file_token
  };
}

function imageExt(mime) {
  return ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp' })[mime] || '';
}

/**
 * 统一文件上传落库：限大小 → 读字节 → FILES.put(<source>/<token>) → files 落库。
 * @param {Object} p
 * @param {'todo'|'user'} p.source  todo=任务附件(需 todoId)，user=各模块 Markdown 内嵌文件
 * @param {number} p.ownerUid 归属用户（任务附件=任务归属人；用户文件=本人）
 * @param {number=} p.todoId source='todo' 时的任务 id
 * @param {number=} p.uploaderUid 实际上传者（共享分类成员/匿名留空）
 */
async function saveFile({ storage, files, source, ownerUid, todoId, uploaderUid, file }) {
  const src = source === 'todo' ? 'todo' : 'user';
  const maxMb = await attachMaxMb(storage);
  if (file.size > maxMb * 1048576) {
    return error('文件超过大小上限（' + maxMb + 'MB）', 413);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const fileToken = generateToken();
  const isImage = IMAGE_MIME.has(file.type || '');
  const id = await storage.file.create({
    owner_uid: ownerUid,
    source: src,
    todo_id: src === 'todo' ? todoId : null,
    uploader_uid: uploaderUid == null ? null : uploaderUid,
    file_token: fileToken,
    origin_name: file.name || '未命名文件',
    mime: file.type || null,
    size: file.size,
    is_image: isImage ? 1 : 0
  });
  await files.put(src + '/' + fileToken, bytes, { contentType: file.type || 'application/octet-stream' });
  const row = await storage.file.findById(id);
  return json({ success: true, attachment: attachmentJson(row) });
}

/** POST /api/files/upload  multipart: file  登录态通用上传（个人数据，不走共享数据源） */
async function uploadUserFile({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  let form;
  try { form = await request.formData(); }
  catch { return error('上传数据格式不正确', 400); }
  const file = form.get('file');
  if (!(file instanceof File) || file.size <= 0) return error('缺少上传文件', 400);
  const files = getFileStore(env);
  if (!files) return error('附件存储未配置，请联系管理员绑定 R2', 503);
  return await saveFile({ storage: getStorage(env), files, source: 'user', ownerUid: auth.user_id, file });
}

/** GET /todo-file/:fileToken  长期免密下载（file_token 全局唯一，R2 key 前缀按 source） */
async function fileDownload({ env, params }) {
  const storage = getStorage(env);
  const row = await storage.file.findByToken(params.fileToken);
  if (!row) return error('文件不存在或已删除', 404);
  const files = getFileStore(env);
  if (!files) return error('附件存储未配置', 503);
  const bytes = await files.get((row.source === 'todo' ? 'todo/' : 'user/') + row.file_token);
  if (!bytes) return error('文件不存在或已删除', 404);
  const mime = row.mime || 'application/octet-stream';
  const headers = {
    'Content-Type': mime,
    'Cache-Control': 'private, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff'
  };
  if (row.is_image) {
    headers['Content-Disposition'] = 'inline; filename="' + row.file_token + imageExt(mime) + '"';
  } else {
    const safeAscii = (row.origin_name || 'file').replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
    headers['Content-Disposition'] =
      "attachment; filename=\"" + safeAscii + "\"; filename*=UTF-8''" + encodeURIComponent(row.origin_name || 'file');
  }
  return new Response(bytes, { status: 200, headers });
}

/** GET /api/public/attach-max-mb  附件单文件上限（前端预检用，全局非敏感） */
async function publicAttachMaxMb({ env }) {
  const storage = getStorage(env);
  const mb = await attachMaxMb(storage);
  return json({ success: true, max_mb: mb });
}

export {
  IMAGE_MIME, attachMaxMb, attachmentJson, saveFile,
  uploadUserFile, fileDownload, publicAttachMaxMb
};
