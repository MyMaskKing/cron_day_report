/**
 * Redis 存储封装【预留桩】
 *
 * Cloudflare Worker 不能直连传统 Redis 的 TCP 协议。
 * 未来接入时使用 Upstash Redis（HTTP REST API）这类 serverless Redis：
 *   - 通过 fetch 调用 https://<upstash-endpoint>，Bearer token 鉴权
 *
 * 用途定位：可作为 kv-store.js 的替代实现（会话 / 分享 token / 净值缓存），
 * 接口与 kv-store.js 保持一致，业务层零改动即可切换。
 * 此处仅占位。
 */

function createRedisStore(env) {
  const notImplemented = () => {
    throw new Error('Redis 存储尚未实现：请接入 Upstash Redis(HTTP REST) 后补全 redis-store.js');
  };
  return new Proxy({}, { get: () => notImplemented });
}

export { createRedisStore };
