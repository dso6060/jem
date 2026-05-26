#!/usr/bin/env bash
# Build a self-contained static deploy bundle for production (e.g. friedso.com).
# Output: <repo>/_deploy_bundle/jem-web-YYYYMMDD-HHMMSS/  (gitignored)
#
# Usage (from repo root):
#   ./jem/scripts/build_friedso_deploy_bundle.sh
#   ./jem/scripts/build_friedso_deploy_bundle.sh --deploy    # rsync if JEM_REMOTE is set
#   JEM_REMOTE='user@host:~/path/to/apps/jem' ./jem/scripts/build_friedso_deploy_bundle.sh --deploy
#
# Smoke URL (attribution): https://friedso.com/apps/jem/
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JEM_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${JEM_ROOT}/.." && pwd)"
GRAPH="${REPO_ROOT}/graph.json"
MIN_ENTITIES=400
DO_DEPLOY=0
BUNDLE_NAME=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --deploy) DO_DEPLOY=1; shift ;;
    --name)
      BUNDLE_NAME="$2"
      shift 2
      ;;
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

if [[ -z "${BUNDLE_NAME}" ]]; then
  BUNDLE_NAME="jem-web-$(date +%Y%m%d-%H%M%S)"
fi
BUNDLE_DIR="${REPO_ROOT}/_deploy_bundle/${BUNDLE_NAME}"

echo "==> JEM production bundle: ${BUNDLE_DIR}"
echo "==> Pipeline (validate → derive → build)"
cd "${JEM_ROOT}"
python3 scripts/validate.py --strict
python3 scripts/validate_graph_refs.py
python3 scripts/derive.py
python3 scripts/build.py

if [[ ! -f "${GRAPH}" ]]; then
  echo "ERROR: missing ${GRAPH}" >&2
  exit 1
fi

COUNT="$(python3 -c "import json; print(json.load(open('${GRAPH}'))['meta'].get('entity_count', 0))")"
RELS="$(python3 -c "import json; print(json.load(open('${GRAPH}'))['meta'].get('relationship_count', 0))")"
if [[ "${COUNT}" -lt "${MIN_ENTITIES}" ]]; then
  echo "ERROR: entity_count ${COUNT} < ${MIN_ENTITIES} — aborting bundle" >&2
  exit 1
fi

GIT_SHA="$(git -C "${REPO_ROOT}" rev-parse --short HEAD 2>/dev/null || echo unknown)"
GIT_BRANCH="$(git -C "${REPO_ROOT}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"

rm -rf "${BUNDLE_DIR}"
mkdir -p "${BUNDLE_DIR}/public"

echo "==> Copy web app (exclude symlink public/graph.json)"
rsync -a \
  --exclude 'public/graph.json' \
  "${JEM_ROOT}/web/" "${BUNDLE_DIR}/"

echo "==> Materialize graph.json → public/graph.json"
cp -f "${GRAPH}" "${BUNDLE_DIR}/public/graph.json"

cat > "${BUNDLE_DIR}/DEPLOY_README.txt" <<EOF
JEM production deploy bundle
Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)
Git: ${GIT_BRANCH} @ ${GIT_SHA}
graph.json: entity_count=${COUNT} relationship_count=${RELS}

This directory is a complete static site. Upload everything here to your app root.

--- rsync (set JEM_REMOTE in your shell; do not commit) ---

  export JEM_REMOTE='user@your-host:~/path/to/apps/jem'
  export JEM_PUBLIC="\${JEM_REMOTE}/public"

  rsync -avz public/graph.json "\${JEM_PUBLIC}/graph.json"
  rsync -avz --delete --exclude 'public/graph.json' ./ "\${JEM_REMOTE}/"
  # Or ship the whole bundle root if your host maps this folder as the app root:
  # rsync -avz --delete ./ "\${JEM_REMOTE}/"

--- smoke test ---

  Canonical demo (attribution): https://friedso.com/apps/jem/
  Or your production URL after deploy.

See jem/docs/V1_RELEASE_RUNBOOK.md in the source repo.
EOF

python3 -c "
import json
from pathlib import Path
g = json.loads(Path('${GRAPH}').read_text())
manifest = {
  'built_at': '$(date -u +%Y-%m-%dT%H:%M:%SZ)',
  'git_sha': '${GIT_SHA}',
  'git_branch': '${GIT_BRANCH}',
  'entity_count': g.get('meta', {}).get('entity_count'),
  'relationship_count': g.get('meta', {}).get('relationship_count'),
  'graph_version': g.get('meta', {}).get('version'),
}
Path('${BUNDLE_DIR}/bundle_manifest.json').write_text(json.dumps(manifest, indent=2))
"

cat > "${REPO_ROOT}/_deploy_bundle/LATEST.txt" <<EOF
${BUNDLE_NAME}
${BUNDLE_DIR}
entities=${COUNT}
EOF

echo ""
echo "OK: bundle ready at"
echo "  ${BUNDLE_DIR}"
echo "  entities=${COUNT} relationships=${RELS}"
echo ""
echo "Deploy manually or re-run with --deploy and JEM_REMOTE set."

if [[ "${DO_DEPLOY}" -eq 1 ]]; then
  if [[ -z "${JEM_REMOTE:-}" ]]; then
    echo "ERROR: --deploy requires JEM_REMOTE in environment" >&2
    exit 1
  fi
  JEM_PUBLIC="${JEM_REMOTE%/}/public"
  echo "==> rsync to \${JEM_REMOTE}"
  rsync -avz "${BUNDLE_DIR}/public/graph.json" "${JEM_PUBLIC}/graph.json"
  rsync -avz --delete \
    --exclude 'public/graph.json' \
    "${BUNDLE_DIR}/" "${JEM_REMOTE%/}/"
  echo "OK: deployed to \${JEM_REMOTE}"
fi
