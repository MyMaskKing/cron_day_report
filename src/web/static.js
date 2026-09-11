/**
 * 静态资源服务（CSS/JS 外链 + 浏览器长缓存）
 *
 * 页面不再内联大段 CSS/JS，而是通过 /s/<name> 外链这些字符串常量；
 * 响应带 immutable 强缓存。版本号用「文件内容 hash」自动生成（?v=<hash>）：
 *   内容不变 → hash 不变 → 浏览器持续命中缓存（零传输）；
 *   内容一改 → hash 自动变 → URL 变化 → 浏览器自动重新下载。
 * 精确到单个文件，且无需发版时手动 bump 版本号。
 *
 * 注意：本模块与 layout.js 相互 import（循环依赖）。所有对 BASE_CSS 等跨模块
 * 常量的访问都放在函数体内（请求时才执行），ESM live binding 下模块已全部就绪，
 * 不在顶层求值期触碰，避免循环初始化拿到 undefined。
 *
 * 双运行时（Workers / Docker Node）都走 fetch 路由，无需物理静态文件。
 */
import { BASE_CSS, FAVICON_SVG } from './layout.js';
import {
  COMMON_JS, LOGIN_JS, DASHBOARD_JS, ADMIN_JS, SETUP_JS, MONITOR_JS, FUND_JS,
  PUBLIC_BUY_JS, WEIGHT_JS, PUBLIC_WEIGHT_JS, SETTINGS_JS, ASSET_JS, PUBLIC_ASSET_JS, CHANNELS_JS,
  WEIGHT_REPORT_JS, ASSET_REPORT_JS, FUND_REPORT_JS,
  TODO_TREE_CORE, TODO_JS, PUBLIC_TODO_JS, TODO_REPORT_JS, TODO_COLLAB_JS
} from './assets.js';

const JS = 'application/javascript';
const CSS = 'text/css';

// /s/<name> 白名单（惰性构造：函数体内引用 BASE_CSS，规避循环依赖顶层求值）
function buildAssets() {
  return {
    'core.css': { body: BASE_CSS, type: CSS },
    'favicon.svg': { body: FAVICON_SVG, type: 'image/svg+xml' },
    'common.js': { body: COMMON_JS, type: JS },
    'todo-core.js': { body: TODO_TREE_CORE, type: JS },
    'page-login.js': { body: LOGIN_JS, type: JS },
    'page-dashboard.js': { body: DASHBOARD_JS, type: JS },
    'page-admin.js': { body: ADMIN_JS, type: JS },
    'page-setup.js': { body: SETUP_JS, type: JS },
    'page-monitor.js': { body: MONITOR_JS, type: JS },
    'page-channels.js': { body: CHANNELS_JS, type: JS },
    'page-fund.js': { body: FUND_JS, type: JS },
    'page-fund-buy.js': { body: PUBLIC_BUY_JS, type: JS },
    'page-fund-report.js': { body: FUND_REPORT_JS, type: JS },
    'page-weight.js': { body: WEIGHT_JS, type: JS },
    'page-weight-public.js': { body: PUBLIC_WEIGHT_JS, type: JS },
    'page-weight-report.js': { body: WEIGHT_REPORT_JS, type: JS },
    'page-asset.js': { body: ASSET_JS, type: JS },
    'page-asset-public.js': { body: PUBLIC_ASSET_JS, type: JS },
    'page-asset-report.js': { body: ASSET_REPORT_JS, type: JS },
    'page-settings.js': { body: SETTINGS_JS, type: JS },
    'page-todo.js': { body: TODO_JS, type: JS },
    'page-todo-public.js': { body: PUBLIC_TODO_JS, type: JS },
    'page-todo-report.js': { body: TODO_REPORT_JS, type: JS },
    'page-todo-collab.js': { body: TODO_COLLAB_JS, type: JS }
  };
}

let _assets = null;
function assets() { return _assets || (_assets = buildAssets()); }

// FNV-1a 32 位哈希 → base36 短串。非加密用途，仅作缓存版本键；
// 几十个文件碰撞概率可忽略，最坏后果也只是该文件多下载一次（无害）。
function contentHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const _verCache = new Map();
/** 取某静态资源的内容版本（hash），结果缓存；非白名单返回 null */
function assetVer(name) {
  if (_verCache.has(name)) return _verCache.get(name);
  const a = assets()[name];
  const v = a ? contentHash(a.body) : null;
  _verCache.set(name, v);
  return v;
}

/** 生成带内容版本的外链 URL，如 /s/common.js?v=ab12cd34 */
function assetUrl(name) {
  const v = assetVer(name);
  return v ? `/s/${name}?v=${v}` : `/s/${name}`;
}

/** 按文件名取静态资源 Response；不在白名单返回 null（调用方按 404 处理） */
function serveStaticAsset(name) {
  const a = assets()[name];
  if (!a) return null;
  return new Response(a.body, {
    headers: {
      'Content-Type': a.type + '; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

export { serveStaticAsset, assetUrl, assetVer };
