/**
 * 推送日志 API (超管)
 * - GET  /api/admin/push-log        列表 + 分页 + 筛选
 * - GET  /api/admin/push-log/count  按区间统计条数 (删除前二次确认)
 * - POST /api/admin/push-log/delete-range  按区间删除
 *
 * 时间字段 from / to 走 UTC 'YYYY-MM-DD HH:mm:ss', 前端负责按时区偏移换算好再传入。
 */

import { json, error } from '../router.js';
import { getStorage } from '../storage/adapter.js';
import { requireAdmin } from '../auth/middleware.js';

/** 校验 UTC 时间字符串, 允许 'YYYY-MM-DD HH:mm[:ss]' 及 'YYYY-MM-DDTHH:mm[:ss]', 返回规范化 'YYYY-MM-DD HH:mm:ss' 或 null */
function normalizeUtc(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return 'INVALID';
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6] || '00'}`;
}

/** GET /api/admin/push-log?module=&user_id=&success=&limit=&offset= */
async function listPushLogs({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;
  const url = new URL(request.url);
  const module = url.searchParams.get('module') || null;
  const userId = url.searchParams.get('user_id');
  const success = url.searchParams.get('success');
  const limit = parseInt(url.searchParams.get('limit'), 10);
  const offset = parseInt(url.searchParams.get('offset'), 10);
  const storage = getStorage(env);
  const { rows, total } = await storage.pushLog.list({
    module,
    userId: userId ? parseInt(userId, 10) : null,
    success: success == null || success === '' ? null : success,
    limit: isNaN(limit) ? 100 : limit,
    offset: isNaN(offset) ? 0 : offset
  });
  return json({ success: true, rows, total });
}

/** GET /api/admin/push-log/count?from=&to=  返回 { count } */
async function countPushLogs({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;
  const url = new URL(request.url);
  const from = normalizeUtc(url.searchParams.get('from'));
  const to = normalizeUtc(url.searchParams.get('to'));
  if (from === 'INVALID' || to === 'INVALID') return error('时间格式非法');
  if (!from && !to) return error('起始时间与结束时间至少填一个');
  if (from && to && from > to) return error('起始时间不能晚于结束时间');
  const storage = getStorage(env);
  const count = await storage.pushLog.countRange({ from, to });
  return json({ success: true, count });
}

/** POST /api/admin/push-log/delete-range  body: { from?, to? }  返回 { deleted } */
async function deletePushLogsRange({ request, env }) {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;
  const body = await request.json().catch(() => ({}));
  const from = normalizeUtc(body.from);
  const to = normalizeUtc(body.to);
  if (from === 'INVALID' || to === 'INVALID') return error('时间格式非法');
  if (!from && !to) return error('起始时间与结束时间至少填一个');
  if (from && to && from > to) return error('起始时间不能晚于结束时间');
  const storage = getStorage(env);
  const deleted = await storage.pushLog.deleteRange({ from, to });
  return json({ success: true, message: `已删除 ${deleted} 条日志`, deleted });
}

export { listPushLogs, countPushLogs, deletePushLogsRange };
