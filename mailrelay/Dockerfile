FROM swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/node:20-alpine

WORKDIR /app

# 先装依赖（利用层缓存）
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 再拷业务代码
COPY . .

RUN mkdir -p /app/data && chown -R node:node /app
USER node

ENV DATA_DIR=/app/data
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1

CMD ["node", "server.js"]
