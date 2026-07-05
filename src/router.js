/**
 * 轻量路由器：支持 method + path 精确匹配与路径参数 (:param)
 * 用法:
 *   const r = new Router();
 *   r.get('/api/users/:id', handler);
 *   const res = await r.handle(request, env, ctx);
 */

class Router {
  constructor() {
    this.routes = [];  // { method, parts, handler }
  }

  add(method, pattern, handler) {
    this.routes.push({ method, parts: pattern.split('/').filter(Boolean), pattern, handler });
    return this;
  }
  get(p, h) { return this.add('GET', p, h); }
  post(p, h) { return this.add('POST', p, h); }
  put(p, h) { return this.add('PUT', p, h); }
  delete(p, h) { return this.add('DELETE', p, h); }

  /**
   * 匹配并执行。未命中返回 null（由调用方决定 404）
   * @returns {Promise<Response|null>}
   */
  async handle(request, env, ctx) {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);

    for (const route of this.routes) {
      if (route.method !== request.method) continue;
      if (route.parts.length !== pathParts.length) continue;

      const params = {};
      let matched = true;
      for (let i = 0; i < route.parts.length; i++) {
        const rp = route.parts[i];
        if (rp.startsWith(':')) {
          params[rp.slice(1)] = decodeURIComponent(pathParts[i]);
        } else if (rp !== pathParts[i]) {
          matched = false;
          break;
        }
      }
      if (matched) {
        const context = { request, env, ctx, params, url };
        return await route.handler(context);
      }
    }
    return null;
  }
}

/** JSON 响应辅助 */
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers }
  });
}

/** HTML 响应辅助 */
function html(content, status = 200, headers = {}) {
  return new Response(content, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...headers }
  });
}

/** 错误 JSON 响应 */
function error(message, status = 400) {
  return json({ success: false, message }, status);
}

export { Router, json, html, error };
