#!/usr/bin/env bash
set -euo pipefail

username="${1:-vultr_tyche_admin}"
role="${2:-admin}"
read -r -s -p "새 관리자 비밀번호: " password
printf '\n'
read -r -s -p "비밀번호 확인: " confirmation
printf '\n'

if [[ "$password" != "$confirmation" ]]; then
  unset password confirmation
  echo "비밀번호가 일치하지 않습니다." >&2
  exit 1
fi

if (( ${#password} < 12 )); then
  unset password confirmation
  echo "비밀번호는 12자 이상이어야 합니다." >&2
  exit 1
fi

printf '%s' "$password" | node "$(dirname "$0")/create-server-admin.js" "$username" "$role"
unset password confirmation
