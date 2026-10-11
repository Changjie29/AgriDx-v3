#!/usr/bin/env sh
# 用户已暂停服务器发布。旧入口显式停用，避免遗留定时任务拉取或重启。
echo '[cloud-pull] v3 当前暂停服务器发布；此入口不会拉取、安装依赖或重启服务。' >&2
echo '[cloud-pull] 请移除旧定时任务；未来发布需先取得用户明确授权，见 CONTRIBUTING.md。' >&2
exit 1
