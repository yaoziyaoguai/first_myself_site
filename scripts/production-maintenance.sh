#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-$(dirname "$PROJECT_DIR")/backups/first_myself_site}"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.docker.prod}"
COMPOSE_FILE="$PROJECT_DIR/docker/docker-compose.prod.yml"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
AGENT_BUDGET_ALERT_PERCENT="${AGENT_BUDGET_ALERT_PERCENT:-80}"

if [[ ! "$RETENTION_DAYS" =~ ^[1-9][0-9]*$ ]]; then
  echo "RETENTION_DAYS must be a positive integer" >&2
  exit 1
fi
if [[ ! "$AGENT_BUDGET_ALERT_PERCENT" =~ ^[1-9][0-9]*$ ]] ||
  (( AGENT_BUDGET_ALERT_PERCENT > 100 )); then
  echo "AGENT_BUDGET_ALERT_PERCENT must be an integer from 1 to 100" >&2
  exit 1
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Production environment file not found: $ENV_FILE" >&2
  exit 1
fi

cd "$PROJECT_DIR"

PROJECT_DIR="$PROJECT_DIR" ENV_FILE="$ENV_FILE" ./scripts/health-check.sh
PROJECT_DIR="$PROJECT_DIR" ENV_FILE="$ENV_FILE" BACKUP_DIR="$BACKUP_DIR" \
  ./scripts/backup.sh

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${POSTGRES_USER:?POSTGRES_USER is required in $ENV_FILE}"
: "${POSTGRES_DB:?POSTGRES_DB is required in $ENV_FILE}"
global_daily_limit="${BLOG_AGENT_GLOBAL_DAILY_LIMIT:-100}"
if [[ ! "$global_daily_limit" =~ ^[1-9][0-9]*$ ]]; then
  echo "BLOG_AGENT_GLOBAL_DAILY_LIMIT must be a positive integer" >&2
  exit 1
fi

COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
cleanup_counts="$("${COMPOSE[@]}" exec -T postgres psql \
  --set ON_ERROR_STOP=1 \
  --set=retention_days="$RETENTION_DAYS" \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --quiet --tuples-only --no-align --field-separator='|' <<'SQL'
BEGIN;
WITH removed_page_views AS (
  DELETE FROM "page_views"
  WHERE created_at < NOW() - make_interval(days => :'retention_days'::integer)
  RETURNING 1
), removed_unanswered AS (
  DELETE FROM "blog_agent"."unanswered_questions"
  WHERE created_at < NOW() - make_interval(days => :'retention_days'::integer)
  RETURNING 1
)
SELECT
  (SELECT COUNT(*) FROM removed_page_views),
  (SELECT COUNT(*) FROM removed_unanswered);
COMMIT;
SQL
)"

if [[ ! "$cleanup_counts" =~ ^[0-9]+\|[0-9]+$ ]]; then
  echo "Retention cleanup returned an invalid count" >&2
  exit 1
fi
echo "Retention cleanup: page_views=${cleanup_counts%%|*}, unanswered=${cleanup_counts#*|}"

daily_usage="$("${COMPOSE[@]}" exec -T postgres psql \
  --set ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --quiet --tuples-only --no-align --field-separator='|' <<'SQL'
SELECT
  COALESCE(SUM("request_count"), 0),
  COALESCE(SUM("input_tokens"), 0),
  COALESCE(SUM("output_tokens"), 0)
FROM "blog_agent"."usage_daily"
WHERE "day" = CURRENT_DATE;
SQL
)"

if [[ ! "$daily_usage" =~ ^[0-9]+\|[0-9]+\|[0-9]+$ ]]; then
  echo "Daily Agent usage returned an invalid count" >&2
  exit 1
fi
IFS='|' read -r daily_requests daily_input_tokens daily_output_tokens <<<"$daily_usage"
alert_threshold=$(((global_daily_limit * AGENT_BUDGET_ALERT_PERCENT + 99) / 100))
echo "Agent usage today: requests=$daily_requests/$global_daily_limit, input_tokens=$daily_input_tokens, output_tokens=$daily_output_tokens"

if (( daily_requests >= alert_threshold )); then
  echo "Agent daily requests reached the ${AGENT_BUDGET_ALERT_PERCENT}% alert threshold ($alert_threshold)" >&2
  exit 1
fi

echo "Production maintenance passed"
