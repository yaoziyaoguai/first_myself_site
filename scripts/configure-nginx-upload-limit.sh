#!/usr/bin/env bash

set -euo pipefail

readonly nginx_conf_dir="${NGINX_CONF_DIR:-/etc/nginx/conf.d}"
readonly target="${nginx_conf_dir}/first_myself_site_uploads.conf"
readonly upload_limit="25m"
readonly probe_host="${UPLOAD_PROBE_HOST:-wangjinkun333.me}"
readonly probe_size_bytes=$((21 * 1024 * 1024))

run_privileged() {
  if [[ ${EUID} -eq 0 ]]; then
    "$@"
  else
    sudo -n "$@"
  fi
}

new_config="$(mktemp)"
previous_config="$(mktemp)"
probe_body="$(mktemp)"
had_previous=false
cleanup() {
  rm -f "${new_config}" "${previous_config}" "${probe_body}"
}
trap cleanup EXIT

command -v curl >/dev/null
command -v truncate >/dev/null
truncate -s "${probe_size_bytes}" "${probe_body}"

verify_upload_limit() {
  local status

  if ! status="$(curl --silent --show-error --max-time 30 \
      --noproxy '*' \
      --output /dev/null \
      --write-out '%{http_code}' \
      --resolve "${probe_host}:443:127.0.0.1" \
      --header 'Content-Type: application/octet-stream' \
      --request OPTIONS \
      --data-binary "@${probe_body}" \
      "https://${probe_host}/api/media")"; then
    echo "Unable to verify the Nginx upload limit through local HTTPS" >&2
    return 1
  fi

  if [[ ${status} != "200" ]]; then
    echo "Nginx media upload probe expected HTTP 200 but received ${status}" >&2
    return 1
  fi
}

if verify_upload_limit; then
  echo "Nginx already accepts the 21 MiB upload probe"
  exit 0
fi

if [[ ! -d ${nginx_conf_dir} ]]; then
  echo "Nginx configuration directory not found: ${nginx_conf_dir}" >&2
  exit 1
fi

command -v nginx >/dev/null
if [[ ${EUID} -ne 0 ]]; then
  command -v sudo >/dev/null
fi

printf 'client_max_body_size %s;\n' "${upload_limit}" >"${new_config}"

if run_privileged test -f "${target}"; then
  had_previous=true
  run_privileged cat "${target}" >"${previous_config}"
fi

restore_managed_config() {
  if ${had_previous}; then
    run_privileged install -m 0644 "${previous_config}" "${target}"
  else
    run_privileged rm -f "${target}"
  fi
  run_privileged nginx -t
}

reload_or_restore() {
  if run_privileged systemctl reload nginx; then
    return 0
  fi

  echo "Nginx reload failed; restoring the previous configuration" >&2
  restore_managed_config
  run_privileged systemctl reload nginx
  return 1
}

if ${had_previous} && cmp -s "${new_config}" "${previous_config}"; then
  run_privileged nginx -t
  reload_or_restore
  if ! verify_upload_limit; then
    restore_managed_config
    run_privileged systemctl reload nginx
    exit 1
  fi
  echo "Nginx upload limit is already ${upload_limit}"
  exit 0
fi

run_privileged install -m 0644 "${new_config}" "${target}"

if ! run_privileged nginx -t; then
  echo "Nginx validation failed; restoring the previous configuration" >&2
  restore_managed_config
  exit 1
fi

reload_or_restore
if ! verify_upload_limit; then
  echo "Upload probe failed; restoring the previous Nginx configuration" >&2
  restore_managed_config
  run_privileged systemctl reload nginx
  exit 1
fi
echo "Nginx upload limit configured at ${upload_limit}"
