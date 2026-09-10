# ---------- deps 阶段 ----------
# node:20-alpine 极简；better-sqlite3 需要 native 编译，故加临时编译工具链
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json ./
# 只装运行时需要的 better-sqlite3；不装 wrangler、miniflare 等开发依赖
RUN npm config set registry https://registry.npmmirror.com
RUN npm install --omit=dev better-sqlite3@11

# ---------- runtime 阶段 ----------
FROM node:20-alpine
WORKDIR /app

# su-exec: entrypoint 以 root 修正 /data 属主后，降权到 node 用户运行主进程
# tzdata: 固定容器时区为 Asia/Shanghai（Alpine 默认无时区数据，仅设 TZ 不生效）
RUN apk add --no-cache su-exec tzdata
ENV TZ=Asia/Shanghai

# 复制依赖（node_modules 中已含 better-sqlite3 的预编译 .node 二进制）
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json

# 复制业务源码 + 迁移 + 宿主脚本
COPY src ./src
COPY migrations ./migrations
COPY docker ./docker

ENV DATA_DIR=/data \
    PORT=8787 \
    HOST=0.0.0.0 \
    STORAGE_DRIVER=d1

RUN mkdir -p /data && chown -R node:node /data /app
VOLUME ["/data"]

# 入口以 root 启动：chown 持久化目录（bind mount 的 docker-data 被删后 Docker 会以 root
# 重建，node 用户无权写），再由 su-exec 降权到 node 运行，保持非 root 安全
RUN chmod +x docker/entrypoint.sh && sed -i 's/\r$//' docker/entrypoint.sh
ENTRYPOINT ["/app/docker/entrypoint.sh"]

EXPOSE 8787
CMD ["node", "docker/server.mjs"]
