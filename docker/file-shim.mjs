/**
 * Node 宿主文件存储 shim：接口与 src/storage/file-store.js 的 R2FileStore 同构。
 * 根目录默认 DATA_DIR/files，key 形如 todo/<file_token>。
 * 仅桥接层使用 node:fs/path，业务 src/ 零改动。
 */
import { mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, sep, relative } from 'node:path';

export class FileStoreShim {
  constructor(root) {
    this.root = resolve(root);
    this._isFileShim = true;
    mkdirSync(this.root, { recursive: true });
  }

  _safePath(key) {
    const p = resolve(this.root, key);
    if (p !== this.root && !p.startsWith(this.root + sep)) {
      throw new Error('非法文件 key: ' + key);
    }
    return p;
  }

  async put(key, bytes) {
    const p = this._safePath(key);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, bytes);
  }

  async get(key) {
    try {
      return new Uint8Array(readFileSync(this._safePath(key)));
    } catch (e) {
      if (e && e.code === 'ENOENT') return null;
      throw e;
    }
  }

  async delete(key) {
    try { rmSync(this._safePath(key), { force: true }); } catch { /* 与 R2 delete 幂等对齐 */ }
  }

  // 列举对象，接口与 R2FileStore.list 同构：prefix 形如 '' 或 'todo/'，返回 posix key
  async list(prefix = '') {
    const dir = prefix ? this._safePath(prefix.replace(/\/$/, '')) : this.root;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); }
    catch (e) { if (e && e.code === 'ENOENT') return []; throw e; }
    const out = [];
    for (const ent of entries) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) {
        for (const sub of await this._walk(full)) out.push(sub);
      } else if (ent.isFile()) {
        const st = statSync(full);
        out.push({ key: this._toKey(full), size: st.size, uploaded: Math.floor(st.mtimeMs / 1000) });
      }
    }
    return out;
  }

  async _walk(dir) {
    const out = [];
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) {
        for (const sub of await this._walk(full)) out.push(sub);
      } else if (ent.isFile()) {
        const st = statSync(full);
        out.push({ key: this._toKey(full), size: st.size, uploaded: Math.floor(st.mtimeMs / 1000) });
      }
    }
    return out;
  }

  _toKey(full) {
    return relative(this.root, full).split(sep).join('/');
  }
}
