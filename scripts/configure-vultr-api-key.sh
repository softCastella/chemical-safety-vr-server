#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="$project_root/.env"

if [[ ! -f "$env_file" ]]; then
  echo "Production environment file not found: $env_file" >&2
  exit 1
fi

read -r -s -p "Vultr API key: " vultr_api_key
echo

if [[ -z "$vultr_api_key" || "$vultr_api_key" =~ [[:space:]] ]]; then
  echo "Vultr API key must be a non-empty value without whitespace." >&2
  exit 1
fi

umask 077
temporary_file="$(mktemp "$project_root/.env.vultr.XXXXXX")"
trap 'rm -f "$temporary_file"' EXIT

awk '!/^VULTR_API_KEY=/' "$env_file" > "$temporary_file"
printf '\nVULTR_API_KEY=%s\n' "$vultr_api_key" >> "$temporary_file"
chmod 600 "$temporary_file"
mv -T "$temporary_file" "$env_file"
trap - EXIT
unset vultr_api_key

echo "Stored VULTR_API_KEY in the protected production environment file."
