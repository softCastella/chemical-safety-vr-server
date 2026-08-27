#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
password_file="${1:-/home/linuxuser/.config/tycheworks/mysql-app-password}"

if [[ ! -f "$password_file" ]]; then
  echo "DB password file not found: $password_file" >&2
  exit 1
fi

umask 077
db_password="$(<"$password_file")"
cat > "$project_root/.env" <<EOF
NODE_ENV=production
PORT=3000
ENABLE_UNAUTHENTICATED_USER_CRUD=false
ENABLE_LOCAL_TRAINING_REGISTRATION=false
ENABLE_LOCAL_TELEMETRY_READ=false
ENABLE_SERVER_ADMIN=true

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=tyche_app
DB_PASSWORD=$db_password
DB_NAME=tyche_training
DB_CONNECTION_LIMIT=10
EOF
chmod 600 "$project_root/.env"
echo "Created protected production environment file at $project_root/.env"
