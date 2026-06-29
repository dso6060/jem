#!/usr/bin/env bash
# Deploy JEM researcher API (FastAPI + SQLite) to friedso VPS.
#
# Prereqs: SSH to root@157.10.98.182, graph.json built, friedso infra snippets in sibling repo.
#
# Usage (from repo root):
#   ./jem/scripts/deploy_friedso_api.sh              # prod only
#   ./jem/scripts/deploy_friedso_api.sh --both         # prod + staging
#   ./jem/scripts/deploy_friedso_api.sh --install    # first-time venv, systemd, nginx snippets
#   ./jem/scripts/deploy_friedso_api.sh --both --install
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JEM_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${JEM_ROOT}/.." && pwd)"
GRAPH="${REPO_ROOT}/graph.json"
FRIEDSO_ROOT="${FRIEDSO_ROOT:-${REPO_ROOT}/../friedso}"
DEPLOY_BRANCH="${JEM_DEPLOY_BRANCH:-friedso_v1}"

JEM_REMOTE="${JEM_REMOTE:-root@157.10.98.182}"
JEM_REMOTE_PROD="${JEM_REMOTE_PROD:-${JEM_REMOTE}:/srv/friedso/prod/services/jem}"
JEM_REMOTE_STAGE="${JEM_REMOTE_STAGE:-${JEM_REMOTE}:/srv/friedso/stage/services/jem}"
VENV_REMOTE="${VENV_REMOTE:-/srv/friedso/venv-jem}"

DO_BOTH=0
DO_INSTALL=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --both) DO_BOTH=1; shift ;;
    --install) DO_INSTALL=1; shift ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

cd "${REPO_ROOT}"

echo "==> Ensure deploy branch (${DEPLOY_BRANCH})"
CURRENT="$(git rev-parse --abbrev-ref HEAD)"
if [[ "${CURRENT}" != "${DEPLOY_BRANCH}" ]]; then
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "ERROR: working tree dirty; commit or stash before switching to ${DEPLOY_BRANCH}" >&2
    exit 1
  fi
  git checkout "${DEPLOY_BRANCH}"
fi

if [[ ! -f "${GRAPH}" ]]; then
  echo "ERROR: missing ${GRAPH} — run derive + build first" >&2
  exit 1
fi

echo "==> Build SQLite from graph.json"
cd "${JEM_ROOT}"
python3 scripts/build_db.py --force --graph "${GRAPH}"

DB_PATH="${JEM_ROOT}/data/jem.db"
if [[ ! -f "${DB_PATH}" ]]; then
  echo "ERROR: build_db did not produce ${DB_PATH}" >&2
  exit 1
fi

COUNT="$(python3 -c "import json; print(json.load(open('${GRAPH}'))['meta'].get('entity_count', 0))")"
echo "    entities=${COUNT} db=$(du -h "${DB_PATH}" | awk '{print $1}')"

remote_host="${JEM_REMOTE%%:*}"

rsync_code() {
  local remote="$1"
  local label="$2"
  echo "==> rsync API code → ${label}"
  rsync -avz --delete \
    --exclude '.env' \
    --exclude 'data/*.db' \
    --exclude 'data/*.db-*' \
    --exclude '__pycache__/' \
    --exclude '.pytest_cache/' \
    --exclude 'tests/' \
    --exclude '.claude/' \
    --exclude 'web/node_modules/' \
    "${JEM_ROOT}/" "${remote}/"
  ssh "${remote_host}" "chown -R www-data:www-data ${remote#*:}"
}

rsync_db() {
  local remote="$1"
  local label="$2"
  local remote_path="${remote#*:}"
  echo "==> rsync jem.db → ${label}"
  ssh "${remote_host}" "mkdir -p ${remote_path}/data && chown -R www-data:www-data ${remote_path}/data"
  rsync -avz "${DB_PATH}" "${remote}/data/jem.db"
  ssh "${remote_host}" "chown www-data:www-data ${remote_path}/data/jem.db"
}

write_env_file() {
  local target_label="$1"
  local base_url="$2"
  local map_url="$3"
  local db_path="$4"
  local auth_mode="$5"

  local local_env="${JEM_ROOT}/.env"
  local example="${JEM_ROOT}/config/jem-api.${target_label}.env.example"
  local remote_env="/etc/friedso/jem-prod.env"
  if [[ "${target_label}" == "staging" ]]; then
    remote_env="/etc/friedso/jem-staging.env"
  fi

  local cors="https://friedso.com,https://www.friedso.com"
  if [[ "${target_label}" == "staging" ]]; then
    cors="https://staging.friedso.com"
  fi

  echo "==> upload env → ${remote_env} (${target_label})"
  ssh "${remote_host}" "mkdir -p /etc/friedso && chmod 700 /etc/friedso"

  python3 - "${local_env}" "${example}" "${remote_env}" "${db_path}" "${auth_mode}" \
    "${base_url}" "${map_url}" "${cors}" <<'PY' | ssh "${remote_host}" "cat > ${remote_env} && chmod 600 ${remote_env}"
import sys
from pathlib import Path

local_env, example, _remote, db_path, auth_mode, base_url, map_url, cors = sys.argv[1:9]
merged = {}
for path in (example, local_env):
    p = Path(path)
    if not p.is_file():
        continue
    for line in p.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        k, v = line.split("=", 1)
        merged[k.strip()] = v.strip()
merged.update({
    "JEM_DB_PATH": db_path,
    "JEM_AUTH_MODE": auth_mode,
    "JEM_BASE_URL": base_url,
    "JEM_MAP_URL": map_url,
    "JEM_PUBLIC_API_PREFIX": "/api/jem/v1",
    "JEM_OAUTH_REDIRECT_URI": f"{base_url.rstrip('/')}/api/jem/v1/auth/linkedin/callback",
    "JEM_CORS_ORIGINS": cors,
})
for k in sorted(merged):
    print(f"{k}={merged[k]}")
PY
}

install_infra() {
  echo "==> Install nginx snippets + systemd units (one-time)"
  if [[ ! -d "${FRIEDSO_ROOT}/infra/ops/nginx" ]]; then
    echo "ERROR: friedso infra not found at ${FRIEDSO_ROOT}" >&2
    exit 1
  fi

  ssh "${remote_host}" "mkdir -p /etc/nginx/snippets"
  scp -q "${FRIEDSO_ROOT}/infra/ops/nginx/jem-api-proxy-prod.conf" \
    "${remote_host}:/etc/nginx/snippets/jem-api-proxy-prod.conf"
  scp -q "${FRIEDSO_ROOT}/infra/ops/nginx/jem-api-proxy-prod.conf" \
    "${remote_host}:/etc/nginx/snippets/jem-api-proxy.conf"
  scp -q "${FRIEDSO_ROOT}/infra/ops/nginx/jem-api-proxy-staging.conf" \
    "${remote_host}:/etc/nginx/snippets/jem-api-proxy-staging.conf"
  scp -q "${FRIEDSO_ROOT}/infra/ops/nginx/jem-short-cache.conf" \
    "${remote_host}:/etc/nginx/snippets/jem-short-cache.conf"
  scp -q "${FRIEDSO_ROOT}/infra/ops/nginx/rate-limit.conf" \
    "${remote_host}:/etc/nginx/conf.d/friedso-rate-limit.conf"

  scp -q "${FRIEDSO_ROOT}/infra/ops/nginx/friedso_prod_ssl.conf" \
    "${remote_host}:/etc/nginx/sites-available/friedso_prod_ssl.conf"
  scp -q "${FRIEDSO_ROOT}/infra/ops/nginx/friedso_stage_ssl.conf" \
    "${remote_host}:/etc/nginx/sites-available/friedso_stage_ssl.conf"

  scp -q "${FRIEDSO_ROOT}/infra/ops/systemd/friedso-jem-prod.service" \
    "${remote_host}:/etc/systemd/system/friedso-jem-prod.service"
  scp -q "${FRIEDSO_ROOT}/infra/ops/systemd/friedso-jem-staging.service" \
    "${remote_host}:/etc/systemd/system/friedso-jem-staging.service"

  ssh "${remote_host}" bash -s <<'REMOTE'
set -euo pipefail
python3 -m venv /srv/friedso/venv-jem 2>/dev/null || true
/srv/friedso/venv-jem/bin/pip install -q --upgrade pip
nginx -t
systemctl daemon-reload
systemctl enable friedso-jem-prod.service
systemctl enable friedso-jem-staging.service
systemctl reload nginx
REMOTE
}

install_venv_deps() {
  echo "==> pip install API requirements on VPS"
  scp -q "${JEM_ROOT}/scripts/requirements-api.txt" \
    "${remote_host}:/tmp/jem-requirements-api.txt"
  ssh "${remote_host}" \
    "/srv/friedso/venv-jem/bin/pip install -q -r /tmp/jem-requirements-api.txt"
}

restart_service() {
  local unit="$1"
  echo "==> restart ${unit}"
  ssh "${remote_host}" "systemctl restart ${unit} && systemctl is-active ${unit}"
}

deploy_target() {
  local remote="$1"
  local label="$2"
  local env_label="$3"
  local base_url="$4"
  local map_url="$5"
  local db_path="$6"
  local auth_mode="$7"
  local unit="$8"

  rsync_code "${remote}" "${label}"
  rsync_db "${remote}" "${label}"
  write_env_file "${env_label}" "${base_url}" "${map_url}" "${db_path}" "${auth_mode}"
  install_venv_deps
  restart_service "${unit}"
}

if [[ "${DO_INSTALL}" -eq 1 ]]; then
  install_infra
fi

deploy_target \
  "${JEM_REMOTE_PROD}" "production" "prod" \
  "https://friedso.com" "https://friedso.com/apps/jem" \
  "/srv/friedso/prod/services/jem/data/jem.db" "production" \
  "friedso-jem-prod.service"

if [[ "${DO_BOTH}" -eq 1 ]]; then
  deploy_target \
    "${JEM_REMOTE_STAGE}" "staging" "staging" \
    "https://staging.friedso.com" "https://staging.friedso.com/apps/jem" \
    "/srv/friedso/stage/services/jem/data/jem.db" "dev" \
    "friedso-jem-staging.service"
fi

echo ""
echo "==> Smoke tests"
echo "  curl -s https://friedso.com/api/jem/v1/health | jq ."
echo "  curl -sI https://friedso.com/docs | head -1"
echo "  curl -s https://friedso.com/mcp/tools | jq ."
if [[ "${DO_BOTH}" -eq 1 ]]; then
  echo "  curl -s -u USER:PASS https://staging.friedso.com/api/jem/v1/health | jq ."
fi
echo ""
echo "OK: JEM API deployed (branch $(git -C "${REPO_ROOT}" rev-parse --short HEAD))"
