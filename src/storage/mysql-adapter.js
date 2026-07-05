/**
 * MySQL 存储适配器【预留桩】
 *
 * Cloudflare Worker 不能直连传统 MySQL 的 TCP 协议。
 * 未来接入时，需经以下 HTTP 可达方案之一：
 *   - Cloudflare Hyperdrive（连接池，绑定后可用 postgres/mysql 驱动）
 *   - PlanetScale serverless driver（HTTP fetch）
 *   - 自建 HTTP-to-MySQL 网关
 *
 * 接入方式：实现与 d1-adapter.js 完全一致的接口契约（users/notify/monitor/fund/weight），
 * 业务代码零改动。此处仅占位，调用即抛错提示。
 *
 * @param {Object} env - Worker 环境
 * @returns {Object} 适配器实例
 */
function createMySQLAdapter(env) {
  const notImplemented = () => {
    throw new Error('MySQL 适配器尚未实现：请接入 Hyperdrive/PlanetScale 后补全 mysql-adapter.js');
  };

  // 与 d1-adapter 同构的接口骨架，全部指向未实现提示
  const stub = new Proxy({}, { get: () => notImplemented });
  return {
    users: stub,
    notify: stub,
    monitor: stub,
    fund: stub,
    weight: stub
  };
}

export { createMySQLAdapter };
