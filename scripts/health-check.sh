#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)}"
APP_URL="${1:-${APP_URL:-https://wangjinkun333.me}}"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.docker.prod}"
COMPOSE_FILE="$PROJECT_DIR/docker/docker-compose.prod.yml"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

for command in curl docker openssl; do
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

echo "Application readiness"
curl --fail --silent --show-error --max-time 10 "$APP_URL/api/health"
echo

echo "Container status"
"${COMPOSE[@]}" ps

unhealthy="$("${COMPOSE[@]}" ps --status unhealthy --quiet)"
if [[ -n "$unhealthy" ]]; then
  echo "Unhealthy containers detected" >&2
  "${COMPOSE[@]}" logs --tail=100 app postgres >&2
  exit 1
fi

domain="${APP_URL#https://}"
domain="${domain#http://}"
domain="${domain%%/*}"

echo "TLS certificate"
certificate="$({ echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null; })"
certificate_end="$(printf '%s\n' "$certificate" | openssl x509 -noout -enddate)"
echo "$certificate_end"
if ! printf '%s\n' "$certificate" | openssl x509 -checkend 604800 -noout >/dev/null; then
  echo "TLS certificate is unavailable or expires within 7 days" >&2
  exit 1
fi

echo "Disk usage"
df -h "$PROJECT_DIR"

echo "Health check passed"
