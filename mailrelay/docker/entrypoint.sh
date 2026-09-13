#!/bin/sh
# 容器以 root 启动：先修正持久化目录属主，再降权到 node 用户运行主进程。
# 背景：bind mount 的 ./data 若以 root 创建/重建，会覆盖镜像内 chown node 的 /data，
# 导致 node 用户无权写 config.json（报 EACCES: permission denied, config.json.tmp）。
# 每次启动 chown 一次即可自愈。
set -e
chown -R node:node /data
exec su-exec node "$@"
