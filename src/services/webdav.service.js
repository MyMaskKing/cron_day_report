/**
 * WebDAV 客户端（仅依赖全局 fetch / btoa，Cloudflare 与 Node 宿主通用）
 * - putFile        PUT 上传文件
 * - deleteFile     DELETE 删除文件（404 视为成功，幂等）
 * - testConnection PROPFIND 探测目录（只看状态码，不解析 XML）
 */

/**
 * 拼接目录 URL 与文件名：目录末尾不带 / 时补 /
 * @param {string} base
 * @param {string} name
 * @returns {string}
 */
function joinUrl(base, name) {
  return (base.endsWith('/') ? base : base + '/') + name;
}

/**
 * 计算最终备份目录: dir 为空用 url; 非空去掉前导斜杠后拼到 url 之后
 * （去前导斜杠防止 dir 变成 host 根绝对路径; 允许多级 a/b）
 * @param {string} url 服务器地址
 * @param {string} dir 保存子目录（可空）
 * @returns {string}
 */
function resolveDavUrl(url, dir) {
  const d = String(dir || '').trim().replace(/^\/+/, '');
  return d ? joinUrl(url, d) : url;
}

/**
 * @param {string} baseUrl WebDAV 最终目录地址
 * @param {string} user
 * @param {string} pass
 */
function createWebdavClient(baseUrl, user, pass) {
  const auth = 'Basic ' + btoa(user + ':' + pass);

  async function request(url, method, opts = {}) {
    return await fetch(url, {
      method,
      headers: { Authorization: auth, ...(opts.headers || {}) },
      body: opts.body
    });
  }

  return {
    async putFile(filename, bytes) {
      const res = await request(joinUrl(baseUrl, filename), 'PUT', {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: bytes
      });
      if (res.status === 404) {
        throw new Error('备份目录不存在（HTTP 404），系统会先尝试自动创建目录，仍失败请检查服务器地址与保存文件夹');
      }
      if (![200, 201, 204].includes(res.status)) {
        throw new Error('WebDAV 上传失败：HTTP ' + res.status);
      }
    },
    /**
     * 逐级创建备份目录（MKCOL）:
     * 201=创建成功; 405=目录已存在(RFC4918); 200=部分服务器对已存在目录的响应
     */
    async ensureDir() {
      const u = new URL(baseUrl);
      let cur = u.origin;
      const segs = u.pathname.split('/').filter(Boolean);
      for (const seg of segs) {
        cur = cur + '/' + seg;
        const res = await request(cur, 'MKCOL');
        if ([200, 201, 405].includes(res.status)) continue;
        if ([401, 403].includes(res.status)) {
          throw new Error('无权限创建备份目录（HTTP ' + res.status + '）');
        }
        throw new Error('无法创建备份目录：HTTP ' + res.status);
      }
    },
    async deleteFile(filename) {
      const res = await request(joinUrl(baseUrl, filename), 'DELETE');
      if (res.status === 404) return;
      if (![200, 202, 204].includes(res.status)) {
        throw new Error('WebDAV 删除失败：HTTP ' + res.status);
      }
    },
    async testConnection() {
      const res = await request(baseUrl, 'PROPFIND', { headers: { Depth: '0' } });
      if ([200, 207].includes(res.status)) return;
      if ([401, 403].includes(res.status)) {
        throw new Error('认证失败或无权限（HTTP ' + res.status + '）');
      }
      throw new Error('连接失败：HTTP ' + res.status);
    }
  };
}

export { createWebdavClient, joinUrl, resolveDavUrl };
