/**
 * D1 自动建表 / 增量迁移（Cloudflare 部署用）
 *
 * 背景：wrangler deploy 自动预置创建的是空 D1，不会执行 migrations。
 * Worker 首次请求 / 定时唤醒时按 migrations/*.sql 顺序补齐结构，与 Docker 启动迁移
 * （docker/migrate.mjs）执行同一套文件、共用同一张 _migrations 去重表，零命令体验对齐。
 *
 * Workers 运行时无文件系统、不能 readdir，.sql 以文本模块形式进入：
 *  - Cloudflare：wrangler.toml 的 Text 模块规则把 .sql 构建期内联为字符串；
 *  - Node 宿主：docker/server.mjs 入口注册 docker/sql-loader.mjs 提供同语义默认导入。
 *
 * 新增 migrations/000N_xxx.sql 后，必须在下方 MIGRATIONS 列表追加 import 与登记行，
 * 否则该文件不会被打包、Worker 侧不会执行（静态打包固有限制；Docker 侧仍会扫盘执行）。
 */

import sql0001 from '../../migrations/0001_init.sql';
import sql0002 from '../../migrations/0002_todo_auto_parent.sql';
import sql0003 from '../../migrations/0003_todo_attachments.sql';
import sql0004 from '../../migrations/0004_files.sql';

// 显式迁移登记表：[文件名, SQL 文本]，数组顺序即执行顺序（新增 000N 时在此追加）
const MIGRATIONS = [
  ['0001_init.sql', sql0001],
  ['0002_todo_auto_parent.sql', sql0002],
  ['0003_todo_attachments.sql', sql0003],
  ['0004_files.sql', sql0004]
];

const MIGRATIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS _migrations (
  name       TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

/**
 * 拆分 SQL：剥掉以 -- 开头的整行注释，按 ";" 分句。
 * 与 docker/migrate.mjs#splitSql 同一口径（项目约定注释独立成行、语句内不含分号字符串常量）。
 * 不能直接把带注释的整串交给真实 D1 多语句执行：注释开头的多语句串会报
 * "incomplete input"（better-sqlite3 容忍，本地测不出来）。
 */
function splitSql(text) {
  const cleaned = text
    .split(/\r?\n/)
    .filter(line => !/^\s*--/.test(line))
    .join('\n');
  return cleaned
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);
}

let readyPromise = null;

/**
 * 确保数据库结构最新。每个 isolate 仅查一次 _migrations：全部已应用则后续请求零开销；
 * 有未应用文件（空库 / 老库增量 / 逐条执行中途失败的半库）时逐条独立提交：
 * 不用 batch 单事务——半库补齐时任一语句不兼容会整批回滚永远补不齐；
 * 仅忽略 "already exists/duplicate column"（与 docker/migrate.mjs 同口径），
 * 其他错误照常抛出且不写入 _migrations，允许下次请求重试收敛。
 * @param {Object} env Worker 环境（须含 DB binding）
 */
export async function ensureSchema(env) {
  if (!env || !env.DB) return;
  if (!readyPromise) {
    readyPromise = (async () => {
      await env.DB.prepare(MIGRATIONS_TABLE_SQL).run();
      const rows = await env.DB.prepare('SELECT name FROM _migrations').all();
      const applied = new Set((rows.results || []).map(r => r.name));
      for (const [name, sql] of MIGRATIONS) {
        if (applied.has(name)) continue;
        for (const stmt of splitSql(sql)) {
          try {
            await env.DB.prepare(stmt).run();
          } catch (err) {
            const msg = String((err && err.message) || err);
            if (/already exists|duplicate column/i.test(msg)) continue;
            throw err;
          }
        }
        await env.DB.prepare('INSERT OR IGNORE INTO _migrations (name) VALUES (?)').bind(name).run();
      }
    })().catch(err => { readyPromise = null; throw err; });
  }
  await readyPromise;
}
