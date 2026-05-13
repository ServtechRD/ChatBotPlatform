#!/usr/bin/env bash
# 與 docker-compose 的 hf-model-ensure 相同邏輯（不需整個 stack）
set -euo pipefail
cd "$(dirname "$0")"
docker compose run --rm hf-model-ensure
