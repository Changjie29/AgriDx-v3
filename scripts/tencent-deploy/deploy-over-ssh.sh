#!/usr/bin/env bash
set -euo pipefail
umask 077
fail() { printf '[deploy-ssh] %s\n' "$*" >&2; exit 1; }
[[ $# == 1 && "$1" =~ ^[0-9a-f]{40}$ ]] || fail '必须指定40位提交 SHA。'
readonly COMMIT=$1
readonly SSH_HOST=${TENCENT_SSH_HOST:-43.128.40.157}
readonly SSH_USER=${TENCENT_SSH_USER:-ubuntu}
readonly SSH_PORT=${TENCENT_SSH_PORT:-22}
[[ "$SSH_HOST" =~ ^[A-Za-z0-9][A-Za-z0-9.-]*$ ]] || fail '服务器地址格式错误。'
[[ "$SSH_USER" =~ ^[a-z_][a-z0-9_-]*$ ]] || fail 'SSH 用户名格式错误。'
[[ "$SSH_PORT" =~ ^[1-9][0-9]{0,4}$ ]] && (( 10#$SSH_PORT <= 65535 )) || fail 'SSH 端口格式错误。'
[[ -n "${TENCENT_SSH_PRIVATE_KEY:-}" && -n "${TENCENT_SSH_KNOWN_HOSTS:-}" ]] ||
  fail '尚未配置 TENCENT_SSH_PRIVATE_KEY / TENCENT_SSH_KNOWN_HOSTS；没有连接服务器。'

SSH_KEY_DIRECTORY=$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/agridx-ssh.XXXXXXXX")
trap 'rm -rf -- "$SSH_KEY_DIRECTORY"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
printf '%s\n' "$TENCENT_SSH_PRIVATE_KEY" > "$SSH_KEY_DIRECTORY/id_ed25519"
printf '%s\n' "$TENCENT_SSH_KNOWN_HOSTS" > "$SSH_KEY_DIRECTORY/known_hosts"
unset TENCENT_SSH_PRIVATE_KEY TENCENT_SSH_KNOWN_HOSTS
lookup=$SSH_HOST
if [[ "$SSH_PORT" != 22 ]]; then lookup="[$SSH_HOST]:$SSH_PORT"; fi
ssh-keygen -F "$lookup" -f "$SSH_KEY_DIRECTORY/known_hosts" >/dev/null ||
  fail 'known_hosts 中没有该服务器的已核实主机密钥。'

ssh -F /dev/null -T -p "$SSH_PORT" -i "$SSH_KEY_DIRECTORY/id_ed25519" \
  -o BatchMode=yes -o IdentitiesOnly=yes -o PreferredAuthentications=publickey \
  -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$SSH_KEY_DIRECTORY/known_hosts" \
  -o GlobalKnownHostsFile=/dev/null -o ClearAllForwardings=yes \
  -o ConnectTimeout=15 -o ServerAliveInterval=15 -o ServerAliveCountMax=4 \
  "$SSH_USER@$SSH_HOST" "deploy $COMMIT" </dev/null
