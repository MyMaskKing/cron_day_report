/**
 * WebDAV 客户端（仅依赖全局 fetch / btoa，Cloudflare 与 Node 宿主通用）
 * - putFile        PUT 上传文件
 * - deleteFile     DELETE 删除文件（404 视为成功，幂等）
 * - testConnection PROPFIND 探测目录（只看状态码，不解析 XML）
 */

/**
 * 压缩 URL 中多余的连续斜杠（保留 http:// 协议头的双斜杠）
 * @param {string} u
 * @returns {string}
 */
function collapseSlashes(u) {
  const m = /^(https?:\/\/)/.exec(u);
  const head = m ? m[0] : '';
  return head + u.slice(head.length).replace(/\/{2,}/g, '/');
}

/**
 * 拼接目录 URL 与文件名：目录末尾不带 / 时补 /；文件名前导斜杠去掉；
 * 拼接后整体压缩多余斜杠
 * @param {string} base
 * @param {string} name
 * @returns {string}
 */
function joinUrl(base, name) {
  const b = String(base == null ? '' : base);
  const n = String(name == null ? '' : name).replace(/^\/+/, '');
  return collapseSlashes((b.endsWith('/') ? b : b + '/') + n);
}

/**
 * 计算最终备份目录: dir 为空用 url; 非空去掉前导斜杠后拼到 url 之后
 * （去前导斜杠防止 dir 变成 host 根绝对路径; 允许多级 a/b）
 * @param {string} url 服务器地址
 * @param {string} dir 保存子目录（可空）
 * @returns {string}
 */
function resolveDavUrl(url, dir) {
  const d = String(dir || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
  if (d) return joinUrl(url, d);
  // dir 为空: 去掉 url 多余尾斜杠，但主机根（https://a.com/）保留唯一斜杠
  const isHostRoot = /^https?:\/\/[^/]+\/$/.test(url);
  return isHostRoot ? url : String(url).replace(/\/+$/, '');
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
      if (![200, 201, 204].includes(res.status)) {
        throw new Error('WebDAV 上传失败：HTTP ' + res.status);
      }
    },
    /**
     * 逐级创建保存文件夹（MKCOL），只创建相对服务器地址的增量段。
     * 乐观继续（403/405/409 不阻断，PUT 是最终裁判），但记录每一级的
     * 真实状态码返回给调用方——PUT 失败时用于诊断，不再静默吞因。
     * @param {string} existingBase - 服务器地址指向的目录（不发 MKCOL）
     * @param {string[]} segments - 保存文件夹的路径段
     * @returns {Promise<Array<{seg:string, status:string}>>}
     */
    async ensureDir(existingBase, segments) {
      const trace = [];
      let cur = existingBase;
      for (const seg of segments) {
        cur = joinUrl(cur, seg);
        let status;
        try {
          let res = await request(cur, 'MKCOL');
          status = String(res.status);
          // 部分服务器要求集合 URL 带尾斜杠: 未成功且非"已存在"时补 "/" 再试一次
          if (![200, 201, 405].includes(res.status) && !cur.endsWith('/')) {
            res = await request(cur + '/', 'MKCOL');
            if ([200, 201, 405].includes(res.status)) status = String(res.status) + '(带斜杠)';
          }
        } catch (e) {
          status = '网络错误:' + (e && e.message ? e.message : String(e));
        }
        trace.push({ seg, status });
      }
      return trace;
    },
    async deleteFile(filename) {
      const res = await request(joinUrl(baseUrl, filename), 'DELETE');
      if (res.status === 404) return;
      if (![200, 202, 204].includes(res.status)) {
        throw new Error('WebDAV 删除失败：HTTP ' + res.status);
      }
    },
    /**
     * 探测目录是否存在（PROPFIND），只回状态码不抛错，供备份前诊断
     */
    async probe() {
      try {
        const res = await request(baseUrl, 'PROPFIND', { headers: { Depth: '0' } });
        return String(res.status);
      } catch (e) {
        return '网络错误:' + (e && e.message ? e.message : String(e));
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
