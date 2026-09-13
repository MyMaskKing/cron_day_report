/**
 * 配置存储：data/config.json 是唯一事实源
 * - 网页后台与手工编辑文件均生效：每次读取按文件 mtime 热加载
 * - 写入采用 tmp + rename 原子写
 * - token 的 lastUsedAt 高频更新只改内存，最多每 60 秒落盘一次
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { hashPassword, constantTimeEqual } from './auth.js';

const TOUCH_FLUSH_MS = 60 * 1000;

/** 缺省配置骨架（同时用于补齐手工编辑缺失的字段） */
export function defaultConfig() {
  return {
    admin: null, // { username, passwordHash, updatedAt }
    smtp: { host: '', port: 465, secure: true, user: '', pass: '', fromName: '' },
    tokens: []
  };
}

/** 一层合并：以磁盘内容为准，缺失键补默认值（兼容老配置/手改漏字段） */
function mergeDefaults(cfg) {
  const d = defaultConfig();
  const out = {
    admin: cfg && cfg.admin ? { ...d.admin, ...cfg.admin } : null,
    smtp: { ...d.smtp, ...((cfg && cfg.smtp) || {}) },
    tokens: Array.isArray(cfg && cfg.tokens) ? cfg.tokens : []
  };
  // 端口/布尔强约束，防止手改写成非法值
  out.smtp.port = Number.parseInt(out.smtp.port, 10);
  if (!Number.isInteger(out.smtp.port) || out.smtp.port < 1 || out.smtp.port > 65535) out.smtp.port = 465;
  out.smtp.secure = !!out.smtp.secure;
  // token 条目补齐字段
  out.tokens = out.tokens.map(t => ({
    id: t.id || crypto.randomUUID(),
    token: String(t.token || ''),
    name: String(t.name || '未命名'),
    enabled: t.enabled !== false,
    createdAt: t.createdAt || null,
    lastUsedAt: t.lastUsedAt || null,
    _touchDirty: false
  })).filter(t => t.token);
  return out;
}

export class Store {
  /**
   * @param {string} dataDir 配置目录
   * @param {{username?:string, password?:string}} bootstrap 首次启动引导管理员
   */
  constructor(dataDir, bootstrap = {}) {
    this.dataDir = dataDir;
    this.file = path.join(dataDir, 'config.json');
    this.bootstrap = bootstrap;
    this.cfg = defaultConfig();
    this.lastMtimeMs = 0;
    this._flushTimer = null;
  }

  /** 启动：加载已有配置；不存在则用引导（或随机密码）初始化并落盘 */
  init() {
    fs.mkdirSync(this.dataDir, { recursive: true });
    let generatedPassword = '';
    if (fs.existsSync(this.file)) {
      this._readFromDisk();
    } else {
      const username = (this.bootstrap.username || 'admin').trim() || 'admin';
      let password = this.bootstrap.password || '';
      if (!password) {
        // 未提供初始密码则随机生成一个，仅在此处打印一次
        password = crypto.randomBytes(9).toString('base64url');
        generatedPassword = password;
      }
      this.cfg = defaultConfig();
      this.cfg.admin = {
        username,
        passwordHash: hashPassword(password),
        updatedAt: new Date().toISOString()
      };
      this._writeToDisk();
      if (generatedPassword) {
        console.log('──────────────────────────────────────────────────');
        console.log('  未设置 ADMIN_PASSWORD，已生成随机初始管理员密码：');
        console.log(`  用户名: ${username}`);
        console.log(`  密码:   ${generatedPassword}`);
        console.log('  （仅显示一次，请登录后立即在后台修改）');
        console.log('──────────────────────────────────────────────────');
      }
    }
    if (this._flushTimer) clearInterval(this._flushTimer);
    this._flushTimer = setInterval(() => this._flushTouch(), TOUCH_FLUSH_MS);
    this._flushTimer.unref?.();
    return generatedPassword;
  }

  /** 取配置（先看 mtime，文件被手工改过则热加载） */
  get() {
    try {
      const st = fs.statSync(this.file);
      if (st.mtimeMs !== this.lastMtimeMs) this._readFromDisk();
    } catch {
      /* 文件暂不可读时沿用内存配置 */
    }
    return this.cfg;
  }

  getAdmin() {
    return this.get().admin;
  }

  getSmtp() {
    return this.get().smtp;
  }

  /** SMTP 是否已填齐（host/user/pass 缺一不可） */
  isSmtpReady() {
    const s = this.getSmtp();
    return !!(s.host && s.user && s.pass);
  }

  /** 供页面渲染：不含密码明文，只告知是否已设置 */
  getSmtpPublic() {
    const s = this.getSmtp();
    return {
      host: s.host, port: s.port, secure: s.secure, user: s.user, fromName: s.fromName,
      hasPass: !!s.pass
    };
  }

  /**
   * 保存 SMTP 配置；pass 为空串/null 时保留原密码（页面密码框留空=不修改）
   * @param {{host?:string,port?:any,secure?:any,user?:string,pass?:string,fromName?:string}} input
   */
  /**
   * 纯合并：表单输入 + 现有配置算出新 SMTP 配置（不落盘）
   * pass 为空串/null 时保留原密码（页面密码框留空=不修改）
   * 供"保存"与"试发但不保存"共用
   */
  mergeSmtp(input) {
    const cur = this.get().smtp;
    const port = Number.parseInt(input.port, 10);
    return {
      host: String(input.host || '').trim(),
      port: Number.isInteger(port) && port >= 1 && port <= 65535 ? port : cur.port,
      secure: input.secure === true || input.secure === 'true',
      user: String(input.user || '').trim(),
      pass: input.pass ? String(input.pass) : cur.pass,
      fromName: String(input.fromName || '').trim()
    };
  }

  /** 保存 SMTP 配置 */
  saveSmtp(input) {
    this.get().smtp = this.mergeSmtp(input);
    this._writeToDisk();
    return this.get().smtp;
  }

  /** 生成新 token，返回完整条目（明文 token 仅此返回与配置文件中可见） */
  addToken(name) {
    const n = String(name || '').trim();
    if (!n) throw new Error('token 名称不能为空');
    const item = {
      id: crypto.randomUUID(),
      token: 'mr_' + crypto.randomBytes(24).toString('base64url'),
      name: n,
      enabled: true,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      _touchDirty: false
    };
    this.get().tokens.push(item);
    this._writeToDisk();
    return item;
  }

  listTokens() {
    return this.get().tokens;
  }

  /** 按明文 token 查启用中的条目（常量时间比较），找不到返回 null */
  findToken(raw) {
    if (!raw) return null;
    const hit = this.get().tokens.find(t => t.enabled && constantTimeEqual(t.token, raw));
    return hit || null;
  }

  /** 记录使用时间：只改内存并标脏，节流落盘 */
  touchToken(id) {
    const t = this.get().tokens.find(x => x.id === id);
    if (!t) return;
    t.lastUsedAt = new Date().toISOString();
    t._touchDirty = true;
  }

  _flushTouch() {
    const dirty = this.cfg.tokens.some(t => t._touchDirty);
    if (!dirty) return;
    this.cfg.tokens.forEach(t => { t._touchDirty = false; });
    this._writeToDisk();
  }

  setTokenEnabled(id, enabled) {
    const t = this.get().tokens.find(x => x.id === id);
    if (!t) return false;
    t.enabled = !!enabled;
    this._writeToDisk();
    return true;
  }

  deleteToken(id) {
    const before = this.get().tokens.length;
    this.get().tokens = this.get().tokens.filter(x => x.id !== id);
    if (this.get().tokens.length === before) return false;
    this._writeToDisk();
    return true;
  }

  /** 修改管理员用户名/密码（newPasswordHash 由调用方哈希好） */
  setAdmin(username, newPasswordHash) {
    this.get().admin = {
      username: String(username).trim(),
      passwordHash: newPasswordHash,
      updatedAt: new Date().toISOString()
    };
    this._writeToDisk();
  }

  _readFromDisk() {
    const raw = fs.readFileSync(this.file, 'utf8');
    this.cfg = mergeDefaults(JSON.parse(raw));
    this.lastMtimeMs = fs.statSync(this.file).mtimeMs;
  }

  _writeToDisk() {
    // 落盘去掉内存专用标记
    const clean = {
      admin: this.cfg.admin,
      smtp: this.cfg.smtp,
      tokens: this.cfg.tokens.map(({ _touchDirty, ...rest }) => rest)
    };
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(clean, null, 2) + '\n', 'utf8');
    fs.renameSync(tmp, this.file);
    this.lastMtimeMs = fs.statSync(this.file).mtimeMs;
  }
}
