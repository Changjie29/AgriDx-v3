#!/usr/bin/env bash
# Forced command for ubuntu's deployment key; never accept a shell or stdin.
set -euo pipefail
readonly DEPLOY_SCRIPT=/usr/local/lib/agridx-deploy/deploy-main.sh

case "${SSH_ORIGINAL_COMMAND:-}" in
  check)
    exec sudo -n "$DEPLOY_SCRIPT" --check
    ;;
  *)
    if [[ "${SSH_ORIGINAL_COMMAND:-}" =~ ^deploy\ ([0-9a-f]{40})$ ]]; then
      exec sudo -n "$DEPLOY_SCRIPT" --deploy "${BASH_REMATCH[1]}"
    fi
    printf '%s\n' '此密钥仅允许 check 或 deploy <40位main提交SHA>。' >&2
    exit 2
    ;;
esac
