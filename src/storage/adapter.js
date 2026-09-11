/**
 * 存储适配器工厂
 *
 * 统一存储抽象：业务代码只依赖此处定义的接口，不关心底层是 D1 / MySQL。
 * 通过 env.STORAGE_DRIVER 选择具体实现，默认 d1。
 *
 * 适配器接口契约（各 driver 必须实现）：
 *   users:   { findByName, findById, create, list, updateRole, updateStatus, count }
 *   notify:  { listByUser, findById, create, update, remove }
 *   monitor: { listByUser, listEnabledAll, findById, create, update, remove, addLog, listLogs }
 *   fund:    { listByUser, findById, create, update, remove, upsertNav, getNav, getReportConfig, setReportConfig, listReportEnabled }
 *   weight:  { listMembers, findMember, createMember, removeMember, listRecords, addRecord, removeRecord }
 *   share:   { createInvite, findActiveInviteByOwner, updateInvite, updateInviteCode, listInvitesByOwner,
 *              findInviteByCode, findInviteById, deleteInviteCascade, purgeRevokedInvitesByOwner,
 *              addMember, listMembersByInvite, findMemberById, deleteMember,
 *              listMyShares, findActiveShare }  // 家庭/团队数据共享（一人一码 + 按模块授权，作废物理删除）
 *   todoAttachment: { create, listByTodo, listByTodoIds, findByToken, findById, removeByIds }  // 附件元数据（文件本体在 env.FILES）
 *   backup:  { dumpTables, restoreTables }  // 全量导入导出（仅 d1 驱动实现；mysql 桩暂无，api 层判空）
 */

import { createD1Adapter } from './d1-adapter.js';
import { createMySQLAdapter } from './mysql-adapter.js';

/**
 * 获取存储适配器
 * @param {Object} env - Worker 环境
 * @returns {Object} 存储适配器实例
 */
function getStorage(env) {
  const driver = (env.STORAGE_DRIVER || 'd1').toLowerCase();
  switch (driver) {
    case 'd1':
      return createD1Adapter(env);
    case 'mysql':
      return createMySQLAdapter(env);
    default:
      throw new Error(`不支持的存储驱动: ${driver}`);
  }
}

export { getStorage };
