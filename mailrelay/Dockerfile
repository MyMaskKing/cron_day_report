# mailrelay 无 native 依赖（nodemailer 纯 JS），单阶段即可
FROM swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/node:20-alpine
WORKDIR /app

# su-exec: entrypoint 以 root 修正 /data 属主后降权到 node 用户运行主进程
# tzdata: 固定容器时区为 Asia/Shanghai（Alpine 默认无时区数据，仅设 TZ 不生效）
RUN apk add --no-cache su-exec tzdata
ENV TZ=Asia/Shanghai

# 先装依赖（利用层缓存）
COPY package.json package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com \
    && npm ci --omit=dev

# 再拷业务代码
COPY . .

ENV DATA_DIR=/data \
    HTTP_PORT=8080

RUN mkdir -p /data && chown -R node:node /data /app
VOLUME ["/data"]

# 入口以 root 启动：chown 持久化目录（bind mount 的 ./data 若以 root 重建，
# node 用户无权写 config.json），再由 su-exec 降权到 node 运行，保持非 root 安全
RUN chmod +x docker/entrypoint.sh && sed -i 's/\r$//' docker/entrypoint.sh
ENTRYPOINT ["/app/docker/entrypoint.sh"]

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1

CMD ["node", "server.js"]
