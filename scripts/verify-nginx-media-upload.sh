#!/usr/bin/env bash

set -euo pipefail

readonly probe_host="${UPLOAD_PROBE_HOST:-wangjinkun333.me}"
readonly probe_size_bytes=$((400 * 1024))

probe_body="$(mktemp)"
cleanup() {
  rm -f "${probe_body}"
}
trap cleanup EXIT

command -v curl >/dev/null
command -v truncate >/dev/null
truncate -s "${probe_size_bytes}" "${probe_body}"

status="$(curl --silent --show-error --max-time 30 \
  --noproxy '*' \
  --output /dev/null \
  --write-out '%{http_code}' \
  --resolve "${probe_host}:443:127.0.0.1" \
  --header 'Content-Type: application/octet-stream' \
  --request OPTIONS \
  --data-binary "@${probe_body}" \
  "https://${probe_host}/api/media")"

if [[ ${status} != "200" ]]; then
  echo "Nginx media upload probe expected HTTP 200 but received ${status}" >&2
  exit 1
fi

echo "Nginx accepts the 400 KiB media upload probe"
