/**
 * Node 宿主文件存储 shim：接口与 src/storage/file-store.js 的 R2FileStore 同构。
 * 根目录默认 DATA_DIR/files，key 形如 todo/<file_token>。
 * 仅桥接层使用 node:fs/path，业务 src/ 零改动。
 */
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve, sep } from 'node:path';

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
}
