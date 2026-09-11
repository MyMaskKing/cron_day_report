/**
 * Node ESM loader：支持直接 import './x.sql'，默认导出文件文本（UTF-8 字符串）。
 * Workers 侧同语义由 wrangler Text 模块规则提供（见 wrangler.toml rules），
 * 使 src/storage/schema.js 在两种宿主下都能 import migrations/*.sql。
 *
 * 仅由 docker/server.mjs 入口通过 module.register 注册，src/ 业务代码不出现 node:* 依赖。
 * 需 Node >= 18.19（module.register 稳定可用；Docker 镜像为 node:20-alpine）。
 */
import { readFileSync } from 'node:fs';

export async function load(url, context, nextLoad) {
  if (url.startsWith('file:') && /\.sql(?:\?|$)/.test(url)) {
    const source = readFileSync(new URL(url), 'utf8');
    return {
      format: 'module',
      source: `export default ${JSON.stringify(source)};`,
      shortCircuit: true
    };
  }
  return nextLoad(url, context);
}
