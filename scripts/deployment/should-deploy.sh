#!/usr/bin/env bash

set -euo pipefail

# 无法证明是纯文档改动时一律部署，避免误跳过生产变更。
if (( $# == 0 )); then
  echo "true"
  exit 0
fi

for changed_path in "$@"; do
  case "$changed_path" in
    .claude/*|docs/*|perf/*|README.md|CLAUDE.md|AGENTS.md|DESIGN.md|SECURITY.md|TESTING_GUIDE.md|LICENSE|LICENSE.*)
      ;;
    *)
      echo "true"
      exit 0
      ;;
  esac
done

echo "false"
