/**
 * 文件存储抽象：业务只依赖 env.FILES 的统一接口，不感知 R2 / 本地磁盘。
 *   put(key, bytes, opts?)  bytes: Uint8Array/ArrayBuffer；opts.contentType 仅 R2 需要
 *   get(key) -> Uint8Array | null
 *   delete(key)
 * Cloudflare: wrangler.toml 绑定 R2 bucket 为 FILES（裸 R2Bucket，此处包一层）。
 * Docker/Node: docker/file-shim.mjs 的 FileStoreShim（带 _isFileShim 标记），直接返回。
 */

class R2FileStore {
  constructor(bucket) { this.bucket = bucket; }
  async put(key, bytes, opts) {
    const opt = opts && opts.contentType ? { httpContentType: opts.contentType } : undefined;
    await this.bucket.put(key, bytes, opt);
  }
  async get(key) {
    const obj = await this.bucket.get(key);
    if (!obj) return null;
    return new Uint8Array(await obj.arrayBuffer());
  }
  async delete(key) { await this.bucket.delete(key); }
}

/** 返回统一文件存储；未绑定 FILES（如忘记配 R2）时返回 null，调用方回 503 */
function getFileStore(env) {
  if (!env.FILES) return null;
  if (env.FILES._isFileShim) return env.FILES;
  return new R2FileStore(env.FILES);
}

export { getFileStore };
