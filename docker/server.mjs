/**
 * 本地部署宿主：纯 Node + better-sqlite3，无 Miniflare/workerd
 *
 * 职责：
 *  1. 用 SQLite 文件模拟 D1 & KV（two 独立 sqlite 文件）
 *  2. 启动时按编号顺序执行 migrations/*.sql
 *  3. 直接 import src/index.js（业务代码零改动），走 http-adapter 桥接
 *  4. 内置每小时定时器直调 handleScheduled（不走 HTTP）+ /cron HTTP 端点保留（手动调试）
 *
 * 数据目录：DATA_DIR（默认 /data）
 *   ├── d1.sqlite          业务 D1 数据
 *   └── kv.sqlite          KV 单表存储
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, join } from 'node:path';

import { D1DatabaseShim } from './d1-shim.mjs';
import { KVNamespaceShim } from './kv-shim.mjs';
import { FileStoreShim } from './file-shim.mjs';
import { createHttpServer } from './http-adapter.mjs';
import { runMigrations } from './migrate.mjs';
import { register } from 'node:module';

// 注册 .sql 文本导入：src/storage/schema.js 直接 import migrations/*.sql
// （Workers 侧由 wrangler Text 模块规则处理）。必须在动态 import src/index.js 之前注册。
register('./sql-loader.mjs', import.meta.url);

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const PORT = parseInt(process.env.PORT || '8787', 10);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR || '/data';
const CRON_SECRET = process.env.CRON_SECRET || '';
const STORAGE_DRIVER = process.env.STORAGE_DRIVER || 'd1';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || '';
const ADMIN_BOOTSTRAP_TOKEN = process.env.ADMIN_BOOTSTRAP_TOKEN || '';

mkdirSync(DATA_DIR, { recursive: true });

// ==================== 初始化存储 ====================
const db = new D1DatabaseShim(join(DATA_DIR, 'd1.sqlite'));
const kv = new KVNamespaceShim(join(DATA_DIR, 'kv.sqlite'));
const files = new FileStoreShim(join(DATA_DIR, 'files'));

// ---------- 从 Cloudflare 迁移数据（可选，默认注释关闭）----------
// 把 wrangler d1 export --remote 生成的 dump.sql 放到 DATA_DIR/dump.sql,
// 打开下面 4 行,首次启动导入完毕后再注释回去
//
// import { importD1Dump } from './import.mjs';
// const imported = await importD1Dump(db, join(DATA_DIR, 'dump.sql'), join(ROOT, 'migrations'));
// if (imported) console.log('[import] D1 数据已导入，后续迁移将全部跳过');
// -----------------------------------------------------------------

await runMigrations(db, join(ROOT, 'migrations'));

// ==================== 构造 env / ctx，加载业务入口 ====================
const env = {
  DB: db,
  KV: kv,
  FILES: files,
  STORAGE_DRIVER,
  ...(PUBLIC_BASE_URL ? { PUBLIC_BASE_URL } : {}),
  ...(CRON_SECRET ? { CRON_SECRET } : {}),
  ...(ADMIN_BOOTSTRAP_TOKEN ? { ADMIN_BOOTSTRAP_TOKEN } : {})
};

/** 简化的 ctx：waitUntil 记录 promise, 供调度触发时 await */
function createCtx() {
  const promises = [];
  return {
    waitUntil(p) { promises.push(Promise.resolve(p)); },
    _promises: promises
  };
}

// 动态 import 业务入口（默认导出含 fetch / scheduled）
// Windows 下挂了 ESM loader hooks 后必须传 file:// URL（盘符裸路径会被 nextLoad 拒绝），
// pathToFileURL 在 Linux 容器内行为等价（file:///app/src/index.js）
const worker = (await import(pathToFileURL(join(ROOT, 'src', 'index.js')).href)).default;

// ==================== 启动 HTTP 服务 ====================
const server = createHttpServer((req, e, ctx) => worker.fetch(req, e, ctx), env, createCtx);
server.listen(PORT, HOST, () => {
  console.log(`✅ cron-day-report 本地部署已启动`);
  console.log(`   监听: http://${HOST}:${PORT}`);
  console.log(`   数据目录: ${DATA_DIR}`);
  console.log(`   存储驱动: ${STORAGE_DRIVER}`);
  console.log(`   首次访问 /  → setup 页 → 建超管 → 登录后到「系统设置」填 PUBLIC_BASE_URL`);
});

// ==================== 内置 cron 触发 ====================
// 直接调 worker.scheduled，不走 HTTP，避免自打自收 & 序列化开销
const CRON_INTERVAL_MS = 60 * 60 * 1000;
let cronTimer = null;

async function triggerCron() {
  const ctx = createCtx();
  try {
    // scheduled 里会 ctx.waitUntil(handleScheduled(...)),我们在此 await 完成
    worker.scheduled({ cron: '0 * * * *', scheduledTime: Date.now() }, env, ctx);
    await Promise.allSettled(ctx._promises);
    console.log(`[cron] ${new Date().toISOString()} done`);
  } catch (err) {
    console.error('[cron] failed:', err.message);
  }
}

function scheduleCron() {
  // 与 Cloudflare "0 * * * *" 对齐：整点触发。启动时先等到下一个整点，然后每小时一次。
  const now = new Date();
  const msToNextHour = (60 - now.getMinutes()) * 60 * 1000 - now.getSeconds() * 1000 - now.getMilliseconds();
  console.log(`[cron] next fire in ${Math.round(msToNextHour / 1000)}s`);
  setTimeout(() => {
    triggerCron();
    cronTimer = setInterval(triggerCron, CRON_INTERVAL_MS);
  }, msToNextHour);
}

scheduleCron();

// ==================== 优雅退出 ====================
async function shutdown(sig) {
  console.log(`\n[${sig}] 关闭中...`);
  if (cronTimer) clearInterval(cronTimer);
  server.close();
  db.close();
  kv.close();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
