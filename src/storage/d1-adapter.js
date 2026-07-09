/**
 * D1 (SQLite) 存储适配器
 * 实现 adapter.js 中定义的接口契约
 */

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
          'SELECT id, username, nickname, role, status, created_at FROM users ORDER BY id'
        ).all();
        return results || [];
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
      async listMembers(userId) {
        const { results } = await db.prepare(
          'SELECT * FROM weight_members WHERE user_id = ? ORDER BY id'
        ).bind(userId).all();
        return results || [];
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
      async removeMember(id, userId) {
        // 先删该成员的体重记录, 再删成员, 避免外键约束失败
        await db.prepare('DELETE FROM weight_records WHERE member_id=? AND user_id=?').bind(id, userId).run();
        await db.prepare('DELETE FROM weight_members WHERE id=? AND user_id=?').bind(id, userId).run();
      },
      async listRecords(userId, memberId = null) {
        let stmt;
        if (memberId) {
          stmt = db.prepare(
            'SELECT * FROM weight_records WHERE user_id=? AND member_id=? ORDER BY record_date'
          ).bind(userId, memberId);
        } else {
          stmt = db.prepare(
            'SELECT * FROM weight_records WHERE user_id=? ORDER BY record_date'
          ).bind(userId);
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
    }
  };
}

export { createD1Adapter };
