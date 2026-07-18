/**
 * D1 (SQLite) 存储适配器
 * 实现 adapter.js 中定义的接口契约
 */

import { shiftDate } from '../services/todo.service.js';

/**
 * @param {Object} env - Worker 环境，需含 env.DB (D1 binding)
 * @returns {Object} 适配器实例
 */
function createD1Adapter(env) {
  const db = env.DB;
  if (!db) throw new Error('D1 数据库未绑定 (env.DB)');

  return {
    // ==================== 用户 ====================
    users: {
      async findByName(username) {
        return await db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
      },
      async findById(id) {
        return await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
      },
      async create({ username, password_hash, role = 'user', nickname = null }) {
        const res = await db.prepare(
          'INSERT INTO users (username, password_hash, role, nickname) VALUES (?, ?, ?, ?)'
        ).bind(username, password_hash, role, nickname || username).run();
        return res.meta.last_row_id;
      },
      async list() {
        const { results } = await db.prepare(
          'SELECT id, username, nickname, role, status, created_at, last_login_at, last_public_at FROM users ORDER BY id'
        ).all();
        return results || [];
      },
      async updateLastLogin(id) {
        await db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").bind(id).run();
      },
      async updateLastPublic(id) {
        await db.prepare("UPDATE users SET last_public_at = datetime('now') WHERE id = ?").bind(id).run();
      },
      async updateNickname(id, nickname) {
        await db.prepare('UPDATE users SET nickname = ? WHERE id = ?').bind(nickname, id).run();
      },
      async updateRole(id, role) {
        await db.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, id).run();
      },
      async updateStatus(id, status) {
        await db.prepare('UPDATE users SET status = ? WHERE id = ?').bind(status, id).run();
      },
      async updatePassword(id, passwordHash) {
        await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(passwordHash, id).run();
      },
      async updateWeightUnit(id, unit) {
        await db.prepare('UPDATE users SET weight_unit = ? WHERE id = ?').bind(unit, id).run();
      },
      async updateQuickloginRestrict(id, v) {
        await db.prepare('UPDATE users SET restrict_quicklogin = ? WHERE id = ?').bind(v ? 1 : 0, id).run();
      },
      async count() {
        const row = await db.prepare('SELECT COUNT(*) AS c FROM users').first();
        return row ? row.c : 0;
      },
      async countAdmins() {
        const row = await db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'").first();
        return row ? row.c : 0;
      }
    },

    // ==================== 通知渠道 ====================
    notify: {
      async listByUser(userId) {
        const { results } = await db.prepare(
          'SELECT * FROM notify_channels WHERE user_id = ? ORDER BY id'
        ).bind(userId).all();
        return results || [];
      },
      async findById(id) {
        return await db.prepare('SELECT * FROM notify_channels WHERE id = ?').bind(id).first();
      },
      async create(userId, c) {
        const res = await db.prepare(
          `INSERT INTO notify_channels (user_id, name, type, url, method, headers_json, body_template, enabled)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          userId, c.name, c.type || 'wechat', c.url, c.method || 'POST',
          c.headers_json || null, c.body_template || null, c.enabled === false ? 0 : 1
        ).run();
        return res.meta.last_row_id;
      },
      async update(id, userId, c) {
        await db.prepare(
          `UPDATE notify_channels SET name=?, type=?, url=?, method=?, headers_json=?, body_template=?, enabled=?
           WHERE id=? AND user_id=?`
        ).bind(
          c.name, c.type, c.url, c.method || 'POST',
          c.headers_json || null, c.body_template || null, c.enabled ? 1 : 0, id, userId
        ).run();
      },
      async remove(id, userId) {
        await db.prepare('DELETE FROM notify_channels WHERE id=? AND user_id=?').bind(id, userId).run();
      }
    },

    // ==================== 监控任务 ====================
    monitor: {
      async listByUser(userId) {
        const { results } = await db.prepare(
          'SELECT * FROM monitor_tasks WHERE user_id = ? ORDER BY id'
        ).bind(userId).all();
        return results || [];
      },
      async listEnabledAll() {
        const { results } = await db.prepare(
          'SELECT * FROM monitor_tasks WHERE enabled = 1 ORDER BY user_id, id'
        ).all();
        return results || [];
      },
      async findById(id) {
        return await db.prepare('SELECT * FROM monitor_tasks WHERE id = ?').bind(id).first();
      },
      async create(userId, t) {
        const res = await db.prepare(
          `INSERT INTO monitor_tasks (user_id, name, url, return_type, channel_id, enabled, standalone)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          userId, t.name, t.url, t.return_type || 'text',
          t.channel_id || null, t.enabled === false ? 0 : 1, t.standalone ? 1 : 0
        ).run();
        return res.meta.last_row_id;
      },
      async update(id, userId, t) {
        await db.prepare(
          `UPDATE monitor_tasks SET name=?, url=?, return_type=?, channel_id=?, enabled=?, standalone=?
           WHERE id=? AND user_id=?`
        ).bind(
          t.name, t.url, t.return_type || 'text', t.channel_id || null,
          t.enabled ? 1 : 0, t.standalone ? 1 : 0, id, userId
        ).run();
      },
      async remove(id, userId) {
        await db.prepare('DELETE FROM monitor_tasks WHERE id=? AND user_id=?').bind(id, userId).run();
      },
      async addLog(log) {
        await db.prepare(
          `INSERT INTO monitor_logs (task_id, user_id, success, status, status_text, response_time, response_size)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          log.task_id, log.user_id, log.success ? 1 : 0, String(log.status || ''),
          log.status_text || '', log.response_time || 0, log.response_size || 0
        ).run();
      },
      async listLogs(taskId, limit = 50) {
        const { results } = await db.prepare(
          'SELECT * FROM monitor_logs WHERE task_id = ? ORDER BY id DESC LIMIT ?'
        ).bind(taskId, limit).all();
        return results || [];
      }
    },

    // ==================== 基金 ====================
    fund: {
      async listByUser(userId) {
        const { results } = await db.prepare(
          'SELECT * FROM funds WHERE user_id = ? ORDER BY id'
        ).bind(userId).all();
        return results || [];
      },
      async listAllCodes() {
        const { results } = await db.prepare('SELECT DISTINCT code FROM funds').all();
        return (results || []).map(r => r.code);
      },
      async listUserIdsWithFunds() {
        const { results } = await db.prepare('SELECT DISTINCT user_id FROM funds').all();
        return (results || []).map(r => r.user_id);
      },
      async findById(id) {
        return await db.prepare('SELECT * FROM funds WHERE id = ?').bind(id).first();
      },
      async create(userId, f) {
        const res = await db.prepare(
          'INSERT INTO funds (user_id, code, name, shares, cost_nav) VALUES (?, ?, ?, ?, ?)'
        ).bind(userId, f.code, f.name || '', f.shares || 0, f.cost_nav || 0).run();
        return res.meta.last_row_id;
      },
      async update(id, userId, f) {
        await db.prepare(
          'UPDATE funds SET code=?, name=?, shares=?, cost_nav=? WHERE id=? AND user_id=?'
        ).bind(f.code, f.name || '', f.shares || 0, f.cost_nav || 0, id, userId).run();
      },
      async remove(id, userId) {
        await db.prepare('DELETE FROM funds WHERE id=? AND user_id=?').bind(id, userId).run();
      },
      async findByShareToken(token) {
        return await db.prepare('SELECT * FROM funds WHERE share_token = ?').bind(token).first();
      },
      async setShareToken(id, token) {
        await db.prepare('UPDATE funds SET share_token=? WHERE id=?').bind(token, id).run();
      },
      async clearShareTokens(userId) {
        await db.prepare('UPDATE funds SET share_token=NULL WHERE user_id=?').bind(userId).run();
      },
      async updateHolding(id, shares, costNav) {
        await db.prepare('UPDATE funds SET shares=?, cost_nav=? WHERE id=?').bind(shares, costNav, id).run();
      },
      async upsertNav(code, nav) {
        await db.prepare(
          `INSERT INTO fund_nav_cache (code, nav, gsz, nav_date, updated_at)
           VALUES (?, ?, ?, ?, datetime('now'))
           ON CONFLICT(code) DO UPDATE SET nav=excluded.nav, gsz=excluded.gsz,
             nav_date=excluded.nav_date, updated_at=datetime('now')`
        ).bind(code, nav.nav || 0, nav.gsz || 0, nav.navDate || '').run();
      },
      async getNav(code) {
        return await db.prepare('SELECT * FROM fund_nav_cache WHERE code = ?').bind(code).first();
      },
      async upsertProfitDaily(userId, date, t) {
        await db.prepare(
          `INSERT INTO fund_profit_daily (user_id, record_date, cost, value, profit, created_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(user_id, record_date) DO UPDATE SET cost=excluded.cost,
             value=excluded.value, profit=excluded.profit, created_at=datetime('now')`
        ).bind(userId, date, t.cost || 0, t.value || 0, t.profit || 0).run();
      },
      async listProfitDaily(userId) {
        const { results } = await db.prepare(
          'SELECT record_date, cost, value, profit FROM fund_profit_daily WHERE user_id=? ORDER BY record_date'
        ).bind(userId).all();
        return results || [];
      },
      async getLatestTwoProfit(userId) {
        const { results } = await db.prepare(
          'SELECT record_date, profit FROM fund_profit_daily WHERE user_id=? ORDER BY record_date DESC LIMIT 2'
        ).bind(userId).all();
        return results || [];
      },
      async getReportConfig(userId) {
        return await db.prepare('SELECT * FROM fund_report_config WHERE user_id = ?').bind(userId).first();
      },
      async setReportConfig(userId, cfg) {
        await db.prepare(
          `INSERT INTO fund_report_config (user_id, channel_id, format, enabled)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET channel_id=excluded.channel_id,
             format=excluded.format, enabled=excluded.enabled`
        ).bind(userId, cfg.channel_id || null, cfg.format || 'text', cfg.enabled ? 1 : 0).run();
      },
      async listReportEnabled() {
        const { results } = await db.prepare(
          'SELECT * FROM fund_report_config WHERE enabled = 1'
        ).all();
        return results || [];
      }
    },

    // ==================== 体重 ====================
    weight: {
      // 可访问成员 = 自己拥有的(user_id=me) ∪ 共享给自己的(weight_member_shares)
      // 共享来的行附 shared=1，自己拥有的 shared=0
      async listMembers(userId) {
        const { results } = await db.prepare(
          `SELECT m.*, 0 AS shared FROM weight_members m WHERE m.user_id = ?
           UNION
           SELECT m.*, 1 AS shared FROM weight_members m
             JOIN weight_member_shares s ON s.member_id = m.id
             WHERE s.user_id = ?
           ORDER BY id`
        ).bind(userId, userId).all();
        return results || [];
      },
      // 该成员是否属于或共享给该用户
      async canAccessMember(userId, memberId) {
        const row = await db.prepare(
          `SELECT 1 AS ok FROM weight_members WHERE id = ? AND user_id = ?
           UNION
           SELECT 1 AS ok FROM weight_member_shares WHERE member_id = ? AND user_id = ?
           LIMIT 1`
        ).bind(memberId, userId, memberId, userId).first();
        return !!row;
      },
      // 登记引用（幂等）
      async shareMember(memberId, userId) {
        await db.prepare(
          'INSERT OR IGNORE INTO weight_member_shares (member_id, user_id) VALUES (?, ?)'
        ).bind(memberId, userId).run();
      },
      // 解除某用户对某成员的引用（不影响属主与数据）
      async unshareMember(memberId, userId) {
        await db.prepare(
          'DELETE FROM weight_member_shares WHERE member_id = ? AND user_id = ?'
        ).bind(memberId, userId).run();
      },
      async findMember(id) {
        return await db.prepare('SELECT * FROM weight_members WHERE id = ?').bind(id).first();
      },
      async createMember(userId, name) {
        const res = await db.prepare(
          'INSERT INTO weight_members (user_id, name) VALUES (?, ?)'
        ).bind(userId, name).run();
        return res.meta.last_row_id;
      },
      async updateMember(id, userId, name) {
        await db.prepare('UPDATE weight_members SET name=? WHERE id=? AND user_id=?').bind(name, id, userId).run();
      },
      async removeMember(id, userId) {
        // 先删该成员的体重记录, 再删成员, 避免外键约束失败
        await db.prepare('DELETE FROM weight_records WHERE member_id=? AND user_id=?').bind(id, userId).run();
        await db.prepare('DELETE FROM weight_members WHERE id=? AND user_id=?').bind(id, userId).run();
      },
      // 属主级联真删：记录 + 全部引用 + 成员本身（不限 records.user_id，清干净共享写入的记录）
      async removeMemberCascade(id) {
        await db.prepare('DELETE FROM weight_records WHERE member_id=?').bind(id).run();
        await db.prepare('DELETE FROM weight_member_shares WHERE member_id=?').bind(id).run();
        await db.prepare('DELETE FROM weight_members WHERE id=?').bind(id).run();
      },
      async listRecords(userId, memberId = null) {
        let stmt;
        if (memberId) {
          stmt = db.prepare(
            'SELECT * FROM weight_records WHERE member_id=? ORDER BY record_date'
          ).bind(memberId);
        } else {
          // 按可访问成员集合查（含共享），而非 records.user_id
          stmt = db.prepare(
            `SELECT * FROM weight_records WHERE member_id IN (
               SELECT id FROM weight_members WHERE user_id=?
               UNION
               SELECT member_id FROM weight_member_shares WHERE user_id=?
             ) ORDER BY record_date`
          ).bind(userId, userId);
        }
        const { results } = await stmt.all();
        return results || [];
      },
      async addRecord(r) {
        const res = await db.prepare(
          'INSERT INTO weight_records (member_id, user_id, weight, record_date, note) VALUES (?, ?, ?, ?, ?)'
        ).bind(r.member_id, r.user_id, r.weight, r.record_date, r.note || '').run();
        return res.meta.last_row_id;
      },
      async updateRecord(id, weight, note) {
        await db.prepare('UPDATE weight_records SET weight=?, note=? WHERE id=?').bind(weight, note || '', id).run();
      },
      async updateRecordWithDate(id, weight, note, date) {
        await db.prepare('UPDATE weight_records SET weight=?, note=?, record_date=? WHERE id=?').bind(weight, note || '', date, id).run();
      },
      async findRecord(id) {
        return await db.prepare('SELECT * FROM weight_records WHERE id = ?').bind(id).first();
      },
      async findRecordByMemberDate(memberId, date) {
        return await db.prepare(
          'SELECT * FROM weight_records WHERE member_id=? AND record_date=?'
        ).bind(memberId, date).first();
      },
      async removeRecord(id, userId) {
        await db.prepare('DELETE FROM weight_records WHERE id=? AND user_id=?').bind(id, userId).run();
      },
      async findMemberByShareToken(token) {
        return await db.prepare('SELECT * FROM weight_members WHERE share_token = ?').bind(token).first();
      },
      async setMemberShareToken(id, token) {
        await db.prepare('UPDATE weight_members SET share_token=? WHERE id=?').bind(token, id).run();
      },
      async clearShareTokens(userId) {
        await db.prepare('UPDATE weight_members SET share_token=NULL WHERE user_id=?').bind(userId).run();
      },
      async getMemberFirstDate(memberId) {
        const row = await db.prepare(
          'SELECT MIN(record_date) AS first_date FROM weight_records WHERE member_id=?'
        ).bind(memberId).first();
        return row ? row.first_date : null;
      },
      async listRecordsByUsers(userIds) {
        if (!userIds || userIds.length === 0) return [];
        const placeholders = userIds.map(() => '?').join(',');
        const { results } = await db.prepare(
          `SELECT r.*, m.name AS member_name, m.user_id AS owner_id
           FROM weight_records r JOIN weight_members m ON r.member_id = m.id
           WHERE m.user_id IN (${placeholders}) ORDER BY r.record_date`
        ).bind(...userIds).all();
        return results || [];
      },
      // 超管用：全部成员（仅真属主行，不含引用），附属主用户名，供新建用户时勾选引用
      async listAllMembersWithOwner() {
        const { results } = await db.prepare(
          `SELECT m.id, m.name, m.user_id, u.username AS owner_name, u.nickname AS owner_nick
           FROM weight_members m JOIN users u ON m.user_id = u.id
           ORDER BY u.username, m.id`
        ).all();
        return results || [];
      }
    },

    // ==================== 资产 ====================
    asset: {
      async listWallets(userId) {
        const { results } = await db.prepare(
          'SELECT * FROM wallets WHERE user_id = ? ORDER BY id'
        ).bind(userId).all();
        return results || [];
      },
      async findWallet(id) {
        return await db.prepare('SELECT * FROM wallets WHERE id = ?').bind(id).first();
      },
      async findWalletByShareToken(token) {
        return await db.prepare('SELECT * FROM wallets WHERE share_token = ?').bind(token).first();
      },
      async createWallet(userId, w) {
        const res = await db.prepare(
          'INSERT INTO wallets (user_id, type, name) VALUES (?, ?, ?)'
        ).bind(userId, w.type, w.name).run();
        return res.meta.last_row_id;
      },
      async updateWallet(id, userId, w) {
        await db.prepare('UPDATE wallets SET type=?, name=? WHERE id=? AND user_id=?')
          .bind(w.type, w.name, id, userId).run();
      },
      async removeWallet(id, userId) {
        // 先删该钱包的月度记录, 再删钱包, 避免外键约束失败
        await db.prepare('DELETE FROM wallet_records WHERE wallet_id=? AND user_id=?').bind(id, userId).run();
        await db.prepare('DELETE FROM wallets WHERE id=? AND user_id=?').bind(id, userId).run();
      },
      async setWalletShareToken(id, token) {
        await db.prepare('UPDATE wallets SET share_token=? WHERE id=?').bind(token, id).run();
      },
      async clearShareTokens(userId) {
        await db.prepare('UPDATE wallets SET share_token=NULL WHERE user_id=?').bind(userId).run();
      },
      // 用户所有钱包的全部月度记录
      async listRecords(userId) {
        const { results } = await db.prepare(
          'SELECT * FROM wallet_records WHERE user_id = ? ORDER BY month'
        ).bind(userId).all();
        return results || [];
      },
      async findRecord(walletId, month) {
        return await db.prepare(
          'SELECT * FROM wallet_records WHERE wallet_id=? AND month=?'
        ).bind(walletId, month).first();
      },
      async findRecordById(id) {
        return await db.prepare('SELECT * FROM wallet_records WHERE id = ?').bind(id).first();
      },
      // 新增一条月度记录（同钱包同月允许多条）
      async addRecord(r) {
        const res = await db.prepare(
          'INSERT INTO wallet_records (wallet_id, user_id, month, balance, principal, profit) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(r.wallet_id, r.user_id, r.month, r.balance || 0, r.principal || 0, r.profit || 0).run();
        return res.meta.last_row_id;
      },
      // 按 id 修改某条月度记录（可改月份）
      async updateRecordById(id, userId, r) {
        await db.prepare(
          "UPDATE wallet_records SET month=?, balance=?, principal=?, profit=?, created_at=datetime('now') WHERE id=? AND user_id=?"
        ).bind(r.month, r.balance || 0, r.principal || 0, r.profit || 0, id, userId).run();
      },
      async removeRecord(id, userId) {
        await db.prepare('DELETE FROM wallet_records WHERE id=? AND user_id=?').bind(id, userId).run();
      },
      async getGoal(userId, year) {
        return await db.prepare('SELECT * FROM asset_goals WHERE user_id=? AND year=?').bind(userId, year).first();
      },
      async setGoal(userId, year, amount) {
        await db.prepare(
          `INSERT INTO asset_goals (user_id, year, target_amount) VALUES (?, ?, ?)
           ON CONFLICT(user_id, year) DO UPDATE SET target_amount=excluded.target_amount`
        ).bind(userId, year, amount).run();
      }
    },

    // ==================== 推送配置 ====================
    push: {
      async getConfig(userId, module) {
        return await db.prepare('SELECT * FROM push_config WHERE user_id=? AND module=?').bind(userId, module).first();
      },
      async setConfig(userId, module, cfg) {
        // hours/days 为逗号分隔字符串；hour/day 保留首值兼容
        const hours = cfg.hours || String(cfg.hour != null ? cfg.hour : 9);
        const days = cfg.days || String(cfg.day != null ? cfg.day : 15);
        const firstHour = parseInt(hours.split(',')[0], 10) || 9;
        const firstDay = parseInt(days.split(',')[0], 10) || 15;
        // channel_ids 为逗号分隔多值；channel_id 存首值兼容
        const channelIds = cfg.channel_ids || (cfg.channel_id != null ? String(cfg.channel_id) : '');
        const firstChannel = channelIds ? (parseInt(channelIds.split(',')[0], 10) || null) : null;
        await db.prepare(
          `INSERT INTO push_config (user_id, module, channel_id, channel_ids, format, enabled, hour, day, hours, days)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, module) DO UPDATE SET channel_id=excluded.channel_id,
             channel_ids=excluded.channel_ids,
             format=excluded.format, enabled=excluded.enabled, hour=excluded.hour, day=excluded.day,
             hours=excluded.hours, days=excluded.days`
        ).bind(
          userId, module, firstChannel, channelIds || null, cfg.format || 'text',
          cfg.enabled ? 1 : 0, firstHour, firstDay, hours, days
        ).run();
      },
      async listEnabledByModule(module) {
        const { results } = await db.prepare(
          'SELECT * FROM push_config WHERE module=? AND enabled=1'
        ).bind(module).all();
        return results || [];
      },
      async findByReportToken(token) {
        return await db.prepare('SELECT * FROM push_config WHERE report_token=?').bind(token).first();
      },
      async clearReportToken(userId, module) {
        await db.prepare('UPDATE push_config SET report_token=NULL WHERE user_id=? AND module=?').bind(userId, module).run();
      },
      async ensureReportToken(userId, module, token) {
        // 若无 token 则写入；配置行不存在时先建一条最小行
        const row = await db.prepare('SELECT report_token FROM push_config WHERE user_id=? AND module=?').bind(userId, module).first();
        if (row && row.report_token) return row.report_token;
        if (row) {
          await db.prepare('UPDATE push_config SET report_token=? WHERE user_id=? AND module=?').bind(token, userId, module).run();
        } else {
          await db.prepare('INSERT INTO push_config (user_id, module, report_token) VALUES (?, ?, ?)').bind(userId, module, token).run();
        }
        return token;
      }
    },

    // ==================== 待办任务 ====================
    todo: {
      async listByUser(userId) {
        const { results } = await db.prepare(
          'SELECT * FROM todos WHERE user_id=? ORDER BY sort_order, id'
        ).bind(userId).all();
        return results || [];
      },
      async findById(id) {
        return await db.prepare('SELECT * FROM todos WHERE id=?').bind(id).first();
      },
      async create(userId, t) {
        // 仅顶层任务(parent_id 空)允许 recurrence 非空; 子任务强制置 null
        const rec = (t.parent_id == null && t.recurrence) ? t.recurrence : null;
        // recur_interval: [1..99], 无 recurrence 时强制置 null
        const rawIv = t.recur_interval != null ? parseInt(t.recur_interval, 10) : null;
        const iv = (rec && rawIv >= 1) ? Math.min(rawIv, 99) : null;
        // monthly_nth_weekday 伴生列: 仅该周期启用时保留, 其它一律 null
        const nth = (rec === 'monthly_nth_weekday' && t.recur_nth != null) ? parseInt(t.recur_nth, 10) : null;
        const wd = (rec === 'monthly_nth_weekday' && t.recur_weekday != null) ? parseInt(t.recur_weekday, 10) : null;
        const res = await db.prepare(
          'INSERT INTO todos (user_id, parent_id, title, priority, due_date, category, note, sort_order, recurrence, recur_interval, recur_nth, recur_weekday) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          userId, t.parent_id != null ? t.parent_id : null, t.title,
          t.priority != null ? t.priority : 1,
          t.due_date || null, t.category || null, t.note || null, t.sort_order != null ? t.sort_order : 0,
          rec, iv, nth, wd
        ).run();
        return res.meta.last_row_id;
      },
      async update(id, userId, t) {
        // 若 t.recurrence 显式传入(含 null), 则更新; 未传时保持原值不变
        const hasRec = Object.prototype.hasOwnProperty.call(t, 'recurrence');
        if (hasRec) {
          // 仅顶层允许 recurrence; 子任务强制 null (API 已过滤, 此处再保险)
          const cur = await db.prepare('SELECT parent_id FROM todos WHERE id=? AND user_id=?').bind(id, userId).first();
          const rec = (cur && cur.parent_id == null) ? (t.recurrence || null) : null;
          // recur_interval: 与 rec 同步更新; 无 rec 时强制 null
          const rawIv = t.recur_interval != null ? parseInt(t.recur_interval, 10) : null;
          const iv = (rec && rawIv >= 1) ? Math.min(rawIv, 99) : null;
          // monthly_nth_weekday 伴生列: 仅该周期启用时保留
          const nth = (rec === 'monthly_nth_weekday' && t.recur_nth != null) ? parseInt(t.recur_nth, 10) : null;
          const wd = (rec === 'monthly_nth_weekday' && t.recur_weekday != null) ? parseInt(t.recur_weekday, 10) : null;
          await db.prepare(
            'UPDATE todos SET title=?, priority=?, due_date=?, category=?, note=?, recurrence=?, recur_interval=?, recur_nth=?, recur_weekday=? WHERE id=? AND user_id=?'
          ).bind(t.title, t.priority != null ? t.priority : 1, t.due_date || null, t.category || null, t.note || null, rec, iv, nth, wd, id, userId).run();
        } else {
          await db.prepare(
            'UPDATE todos SET title=?, priority=?, due_date=?, category=?, note=? WHERE id=? AND user_id=?'
          ).bind(t.title, t.priority != null ? t.priority : 1, t.due_date || null, t.category || null, t.note || null, id, userId).run();
        }
      },
      // 同级重排：按 orderedIds 顺序批量写 sort_order=0..n
      // 双校验 user_id + parent_id，越权或跨级的 id 不会被更新；parentId 为 null 表顶层
      async reorder(userId, parentId, orderedIds) {
        if (!orderedIds || orderedIds.length === 0) return;
        const parentCond = parentId == null ? 'parent_id IS NULL' : 'parent_id=?';
        const stmts = orderedIds.map((id, i) => {
          const stmt = db.prepare(
            `UPDATE todos SET sort_order=? WHERE id=? AND user_id=? AND ${parentCond}`
          );
          return parentId == null
            ? stmt.bind(i, id, userId)
            : stmt.bind(i, id, userId, parentId);
        });
        await db.batch(stmts);
      },
      // 批量置完成状态（勾选父任务级联子树时用）；done=1 写完成日期，done=0 清空
      async setDone(idList, done, doneAt) {
        if (!idList || idList.length === 0) return;
        const placeholders = idList.map(() => '?').join(',');
        await db.prepare(
          `UPDATE todos SET done=?, done_at=? WHERE id IN (${placeholders})`
        ).bind(done ? 1 : 0, done ? (doneAt || null) : null, ...idList).run();
      },
      // 完成/取消完成, 若命中"顶层重复任务且 done=1", 自动 clone 一条新任务(含子树)
      // 返回 { cloned: boolean, next_id?, next_due? }
      // done=0 或非顶层重复走原有级联逻辑, cloned=false
      // userId 双校验用: 目标不属该用户视为无效, cloned=false 且不写任何数据
      async markDoneWithRecur(id, userId, done, jumpToCurrent, todayStr) {
        const self = await db.prepare('SELECT * FROM todos WHERE id=? AND user_id=?').bind(id, userId).first();
        if (!self) return { cloned: false };
        // 先处理原有的级联完成
        const desc = await this.collectDescendantIds(id);
        await this.setDone([id, ...desc], !!done, todayStr);
        // 判断是否需要 clone: 必须 done=1, 顶层, 有 recurrence, 有 due_date
        if (!done) return { cloned: false };
        if (self.parent_id != null) return { cloned: false };
        if (!self.recurrence) return { cloned: false };
        if (!self.due_date) return { cloned: false };
        const nextDue = shiftDate(self.due_date, self.recurrence, !!jumpToCurrent, todayStr, self.recur_interval, self.recur_nth, self.recur_weekday);
        const newRootId = await this._cloneSubtreeForRecur(self, nextDue, userId, todayStr);
        return { cloned: true, next_id: newRootId, next_due: nextDue };
      },
      // 内部: 递归克隆 rootOld 及其全部后代, 返回新 root id
      // 新任务全部 done=0, done_at=null, share_token=null, recur_from_id 指向原 id
      // rootOld 是完整行对象(含 recurrence 等), 需 SELECT * 后再传入
      async _cloneSubtreeForRecur(rootOld, nextDue, userId, todayStr) {
        // 1. 插入新 root; 保留 recurrence/recur_interval/recur_nth/recur_weekday, 保证下次循环仍按同规则
        const rootRes = await db.prepare(
          'INSERT INTO todos (user_id, parent_id, title, done, priority, due_date, category, sort_order, share_token, note, done_at, recurrence, recur_interval, recur_nth, recur_weekday, recur_from_id) VALUES (?, NULL, ?, 0, ?, ?, ?, ?, NULL, ?, NULL, ?, ?, ?, ?, ?)'
        ).bind(
          userId, rootOld.title,
          rootOld.priority != null ? rootOld.priority : 1,
          nextDue,
          rootOld.category || null,
          rootOld.sort_order != null ? rootOld.sort_order : 0,
          rootOld.note || null,
          rootOld.recurrence,
          rootOld.recur_interval != null ? rootOld.recur_interval : null,
          rootOld.recur_nth != null ? rootOld.recur_nth : null,
          rootOld.recur_weekday != null ? rootOld.recur_weekday : null,
          rootOld.id
        ).run();
        const newRootId = rootRes.meta.last_row_id;
        // 2. 递归子孙: 读原子树(不含 root 本身), 按 sort_order+id 顺序 clone
        const subtree = await this.listSubtree(rootOld.id);
        const others = subtree.filter(r => r.id !== rootOld.id);
        // idMap: 旧 id -> 新 id
        const idMap = new Map();
        idMap.set(rootOld.id, newRootId);
        // 保证父在前(listSubtree 返回按 sort_order+id, 但可能同级子在祖先前, 需要拓扑保证)
        // 简单做法: 用 while 循环, 只有父已映射的行才处理; 循环直到全部完成
        let remaining = others.slice();
        while (remaining.length) {
          const next = [];
          for (const r of remaining) {
            const newParent = idMap.get(r.parent_id);
            if (newParent == null) { next.push(r); continue; }
            const res = await db.prepare(
              'INSERT INTO todos (user_id, parent_id, title, done, priority, due_date, category, sort_order, share_token, note, done_at, recurrence, recur_interval, recur_nth, recur_weekday, recur_from_id) VALUES (?, ?, ?, 0, ?, NULL, ?, ?, NULL, ?, NULL, NULL, NULL, NULL, NULL, ?)'
            ).bind(
              userId, newParent, r.title,
              r.priority != null ? r.priority : 1,
              r.category || null,
              r.sort_order != null ? r.sort_order : 0,
              r.note || null,
              r.id
            ).run();
            idMap.set(r.id, res.meta.last_row_id);
          }
          if (next.length === remaining.length) break; // 防死循环: 存在孤儿则终止(理论上不会发生)
          remaining = next;
        }
        return newRootId;
      },
      // 递归收集某任务的全部后代 id（不含自身），供级联完成/删除
      async collectDescendantIds(id) {
        const all = [];
        let frontier = [id];
        while (frontier.length) {
          const placeholders = frontier.map(() => '?').join(',');
          const { results } = await db.prepare(
            `SELECT id FROM todos WHERE parent_id IN (${placeholders})`
          ).bind(...frontier).all();
          const children = (results || []).map(r => r.id);
          all.push(...children);
          frontier = children;
        }
        return all;
      },
      async remove(idList) {
        if (!idList || idList.length === 0) return;
        const placeholders = idList.map(() => '?').join(',');
        await db.prepare(`DELETE FROM todos WHERE id IN (${placeholders})`).bind(...idList).run();
      },
      async findByShareToken(token) {
        return await db.prepare('SELECT * FROM todos WHERE share_token=?').bind(token).first();
      },
      async setShareToken(id, token) {
        await db.prepare('UPDATE todos SET share_token=? WHERE id=?').bind(token, id).run();
      },
      async clearShareTokens(userId) {
        await db.prepare('UPDATE todos SET share_token=NULL WHERE user_id=?').bind(userId).run();
      },
      // 某顶层任务及其全部后代（递归子树），供免密页展示
      async listSubtree(rootId) {
        const { results } = await db.prepare(
          `WITH RECURSIVE sub(id) AS (
             SELECT id FROM todos WHERE id=?
             UNION ALL
             SELECT t.id FROM todos t JOIN sub ON t.parent_id = sub.id
           )
           SELECT t.* FROM todos t JOIN sub ON t.id = sub.id ORDER BY t.sort_order, t.id`
        ).bind(rootId).all();
        return results || [];
      },
      // 图表原始数据：按截止日期(due_date)分组的每日到期量与其中完成量
      // created 键沿用原名，语义为"该截止日到期的任务数"；done 为其中已完成数
      // 仅统计设了 due_date 的任务（顶层任务；子任务日期继承主任务、自身 due_date 为空不计入）
      // idList 传入则仅统计这些 id（用于免密协作页限定某清单子树），否则统计该用户全部
      // offsetHours 保留兼容调用签名，此口径下不再使用（due_date 本就是北京日期串）
      // 返回 { created: [{d, c}], done: [{d, c}] }，d 为 YYYY-MM-DD
      async chartRaw(userId, offsetHours = 8, idList = null) {
        let scope = 'user_id=?', args = [userId];
        if (idList && idList.length) {
          scope = `id IN (${idList.map(() => '?').join(',')})`;
          args = idList;
        }
        const createdQ = await db.prepare(
          `SELECT due_date AS d, COUNT(*) AS c
           FROM todos WHERE ${scope} AND due_date IS NOT NULL GROUP BY due_date`
        ).bind(...args).all();
        const doneQ = await db.prepare(
          `SELECT due_date AS d, COUNT(*) AS c
           FROM todos WHERE ${scope} AND due_date IS NOT NULL AND done=1 GROUP BY due_date`
        ).bind(...args).all();
        return { created: createdQ.results || [], done: doneQ.results || [] };
      }
    },

    // ==================== 全局设置 ====================
    settings: {
      async get(key) {
        const row = await db.prepare('SELECT value FROM app_settings WHERE key = ?').bind(key).first();
        return row ? row.value : null;
      },
      async set(key, value) {
        await db.prepare(
          `INSERT INTO app_settings (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value=excluded.value`
        ).bind(key, value).run();
      }
    },

    // ==================== 推送日志 ====================
    // 每次真正调用 sendNotification 都记一条; 无自动清理, 靠超管画面按区间手动删除
    pushLog: {
      /**
       * 写一条推送日志
       * @param {Object} r - { user_id, module, channel_id?, channel_name?, channel_type?, format?, trigger_by?, success, error? }
       */
      async add(r) {
        await db.prepare(
          `INSERT INTO push_log
           (user_id, module, channel_id, channel_name, channel_type, format, trigger_by, success, error)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          r.user_id, r.module,
          r.channel_id == null ? null : r.channel_id,
          r.channel_name == null ? null : r.channel_name,
          r.channel_type == null ? null : r.channel_type,
          r.format == null ? null : r.format,
          r.trigger_by || 'cron',
          r.success ? 1 : 0,
          r.error ? String(r.error).slice(0, 500) : null
        ).run();
      },
      /**
       * 分页读取; 支持按 module / user_id / success 过滤; 列表带 username 便于展示
       * @param {Object} opts - { module?, userId?, success?, limit=100, offset=0 }
       * @returns {Promise<{ rows, total }>}
       */
      async list(opts = {}) {
        const where = [];
        const args = [];
        if (opts.module) { where.push('l.module = ?'); args.push(opts.module); }
        if (opts.userId) { where.push('l.user_id = ?'); args.push(opts.userId); }
        if (opts.success != null && opts.success !== '') {
          where.push('l.success = ?');
          args.push(opts.success == 1 || opts.success === true ? 1 : 0);
        }
        const wh = where.length ? ('WHERE ' + where.join(' AND ')) : '';
        const limit = Math.min(500, Math.max(1, parseInt(opts.limit, 10) || 100));
        const offset = Math.max(0, parseInt(opts.offset, 10) || 0);
        const rowsQ = await db.prepare(
          `SELECT l.*, u.username FROM push_log l LEFT JOIN users u ON u.id = l.user_id
           ${wh} ORDER BY l.id DESC LIMIT ? OFFSET ?`
        ).bind(...args, limit, offset).all();
        const totalQ = await db.prepare(
          `SELECT COUNT(*) AS c FROM push_log l ${wh}`
        ).bind(...args).first();
        return { rows: rowsQ.results || [], total: totalQ ? totalQ.c : 0 };
      },
      /**
       * 按 created_at 区间统计条数 (用于删除前二次确认)
       * @param {Object} range - { from?: 'YYYY-MM-DD HH:mm:ss', to?: 'YYYY-MM-DD HH:mm:ss' } UTC
       */
      async countRange({ from, to } = {}) {
        const where = [], args = [];
        if (from) { where.push('created_at >= ?'); args.push(from); }
        if (to)   { where.push('created_at <= ?'); args.push(to); }
        const wh = where.length ? 'WHERE ' + where.join(' AND ') : '';
        const row = await db.prepare(`SELECT COUNT(*) AS c FROM push_log ${wh}`).bind(...args).first();
        return row ? row.c : 0;
      },
      /**
       * 按 created_at 区间删除
       * 安全兜底: from/to 都没传时返回 0, 防止全表清空
       * @returns {Promise<number>} 实际删除条数
       */
      async deleteRange({ from, to } = {}) {
        const where = [], args = [];
        if (from) { where.push('created_at >= ?'); args.push(from); }
        if (to)   { where.push('created_at <= ?'); args.push(to); }
        if (!where.length) return 0;
        const res = await db.prepare(
          `DELETE FROM push_log WHERE ${where.join(' AND ')}`
        ).bind(...args).run();
        return res.meta ? (res.meta.changes || 0) : 0;
      }
    }
  };
}

export { createD1Adapter };
