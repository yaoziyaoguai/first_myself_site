#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-}"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.docker.prod}"
COMPOSE_FILE="$PROJECT_DIR/docker/docker-compose.prod.yml"
MAX_BACKUPS="${MAX_BACKUPS:-7}"

if [[ -z "$BACKUP_DIR" ]]; then
  echo "BACKUP_DIR must point to a dedicated backup directory" >&2
  exit 1
fi

for command in docker tar; do
  command -v "$command" >/dev/null || {
    echo "Missing required command: $command" >&2
    exit 1
  }
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Production environment file not found: $ENV_FILE" >&2
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Compose file not found: $COMPOSE_FILE" >&2
  exit 1
fi

if [[ ! "$MAX_BACKUPS" =~ ^[1-9][0-9]*$ ]]; then
  echo "MAX_BACKUPS must be a positive integer" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${POSTGRES_USER:?POSTGRES_USER is required in $ENV_FILE}"
: "${POSTGRES_DB:?POSTGRES_DB is required in $ENV_FILE}"

COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
"${COMPOSE[@]}" config --quiet

if [[ -z "$("${COMPOSE[@]}" ps --status running --quiet postgres)" ]]; then
  echo "PostgreSQL container is not running" >&2
  exit 1
fi

if [[ -z "$("${COMPOSE[@]}" ps --status running --quiet app)" ]]; then
  echo "Application container is not running" >&2
  exit 1
fi

mkdir -p -- "$BACKUP_DIR"
scratch_dir="$(mktemp -d)"
trap 'rm -rf -- "$scratch_dir"' EXIT

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$BACKUP_DIR/first_myself_site_$timestamp.tar.gz"
temporary_file="$(mktemp "$BACKUP_DIR/.backup_XXXXXX.tar.gz")"
trap 'rm -rf -- "$scratch_dir"; rm -f -- "$temporary_file"' EXIT

"${COMPOSE[@]}" exec -T postgres \
  pg_dump --format=custom --no-owner --no-privileges \
  --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  >"$scratch_dir/database.dump"

"${COMPOSE[@]}" exec -T postgres \
  pg_restore --list <"$scratch_dir/database.dump" >/dev/null

"${COMPOSE[@]}" exec -T app \
  tar -C /app/media -czf - . >"$scratch_dir/media.tar.gz"

tar -tzf "$scratch_dir/media.tar.gz" >/dev/null

cat >"$scratch_dir/README.txt" <<EOF
Created: $timestamp
Contents: PostgreSQL custom-format dump and /app/media archive
Restore into a separate environment and verify before replacing production data.
EOF

tar -C "$scratch_dir" -czf "$temporary_file" .
tar -tzf "$temporary_file" >/dev/null
chmod 600 "$temporary_file"
mv -- "$temporary_file" "$backup_file"
trap 'rm -rf -- "$scratch_dir"' EXIT

find "$BACKUP_DIR" -maxdepth 1 -type f -name 'first_myself_site_*.tar.gz' \
  -printf '%T@ %p\n' | sort -rn | tail -n +$((MAX_BACKUPS + 1)) | \
  cut -d' ' -f2- | while IFS= read -r old_backup; do
    [[ -n "$old_backup" ]] && rm -- "$old_backup"
  done

echo "Backup created: $backup_file"
