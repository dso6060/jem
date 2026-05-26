#!/usr/bin/env bash
# Validate, commit, and optionally push JEM sources to the public GitHub remote.
# Does NOT include _deploy_bundle/ (friedso deploy artifacts stay local).
#
# Usage (from repo root):
#   ./jem/scripts/publish_github.sh -m "data(mh): describe change"
#   ./jem/scripts/publish_github.sh -m "docs: …" --branch publish/20260526 --push
#   ./jem/scripts/publish_github.sh -m "data: …" --main --push
#
# Modes:
#   --branch NAME   Create/checkout branch NAME, commit, optional --push (open PR)
#   --main          Commit on current branch (must be main); use with care + --push
#   (default)       Commit on current branch without switching
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JEM_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${JEM_ROOT}/.." && pwd)"

COMMIT_MSG=""
BRANCH=""
USE_MAIN=0
DO_PUSH=0
DRY_RUN=0
SKIP_VALIDATE=0
SCOPE="default"

usage() {
  sed -n '2,18p' "$0"
  echo ""
  echo "Options:"
  echo "  -m, --message MSG     Commit message (required)"
  echo "  --branch NAME         git checkout -B NAME before commit"
  echo "  --main                Allow commit when on main (still requires -m)"
  echo "  --push                git push -u origin HEAD after commit"
  echo "  --scope S             default | data-only | all-tracked"
  echo "  --dry-run             Show actions only"
  echo "  --skip-validate       Skip validate/derive (not recommended)"
  echo "  -h, --help"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--message)
      COMMIT_MSG="$2"
      shift 2
      ;;
    --branch)
      BRANCH="$2"
      shift 2
      ;;
    --main) USE_MAIN=1; shift ;;
    --push) DO_PUSH=1; shift ;;
    --scope)
      SCOPE="$2"
      shift 2
      ;;
    --dry-run) DRY_RUN=1; shift ;;
    --skip-validate) SKIP_VALIDATE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "${COMMIT_MSG}" ]]; then
  echo "ERROR: -m / --message is required" >&2
  usage >&2
  exit 1
fi

cd "${REPO_ROOT}"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "ERROR: not a git repository: ${REPO_ROOT}" >&2
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "${USE_MAIN}" -eq 1 && "${CURRENT_BRANCH}" != "main" && -z "${BRANCH}" ]]; then
  echo "ERROR: --main requires you to be on main (currently ${CURRENT_BRANCH})" >&2
  exit 1
fi

if [[ "${USE_MAIN}" -eq 0 && "${CURRENT_BRANCH}" == "main" && -z "${BRANCH}" ]]; then
  echo "WARN: committing directly on main. Use --branch NAME for PR workflow or pass --main to confirm."
  read -r -p "Continue on main? [y/N] " ans
  [[ "${ans}" == [yY] ]] || exit 1
fi

run() {
  if [[ "${DRY_RUN}" -eq 1 ]]; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

if [[ "${SKIP_VALIDATE}" -eq 0 ]]; then
  echo "==> validate + derive (no build — run build_friedso_deploy_bundle.sh for production graph)"
  cd "${JEM_ROOT}"
  run python3 scripts/validate.py --strict
  run python3 scripts/validate_graph_refs.py
  run python3 scripts/derive.py
  cd "${REPO_ROOT}"
fi

if [[ -n "${BRANCH}" ]]; then
  echo "==> branch ${BRANCH}"
  run git checkout -B "${BRANCH}"
fi

echo "==> stage files (scope=${SCOPE})"
case "${SCOPE}" in
  data-only)
    run git add jem/data graph.json
    ;;
  all-tracked)
    run git add -A
    run git reset HEAD -- _deploy_bundle 2>/dev/null || true
    ;;
  default|*)
    run git add jem/data graph.json jem/scripts jem/docs jem/web .github README.md MASTER_CHECKLIST.md
    ;;
esac

if [[ "${DRY_RUN}" -eq 0 ]]; then
  if git diff --cached --quiet; then
    echo "Nothing staged to commit."
    exit 0
  fi
fi

echo "==> commit"
run git commit -m "$(cat <<EOF
${COMMIT_MSG}
EOF
)"

if [[ "${DO_PUSH}" -eq 1 ]]; then
  REMOTE="${GIT_REMOTE:-origin}"
  echo "==> push ${REMOTE}"
  run git push -u "${REMOTE}" HEAD
  if [[ -n "${BRANCH}" ]]; then
    echo ""
    echo "Branch pushed. Open a PR:"
    echo "  gh pr create --base main --head ${BRANCH} --title \"…\" --body \"…\""
  fi
else
  echo ""
  echo "Committed locally. Push with:"
  echo "  git push -u origin HEAD"
  if [[ -n "${BRANCH}" ]]; then
    echo "  gh pr create --base main --head ${BRANCH}"
  fi
fi

echo "OK: publish_github finished"
