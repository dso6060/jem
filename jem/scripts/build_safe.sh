#!/usr/bin/env bash
# JEM — Safe build: never overwrites repo-root graph.json (symlink target for the web app).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JEM_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${JEM_ROOT}"
mkdir -p build
python3 scripts/derive.py
python3 scripts/build.py --output "${JEM_ROOT}/build/graph.staging.json"
echo ""
echo "OK: wrote ${JEM_ROOT}/build/graph.staging.json"
echo "Compare meta.entity_count before copying to repo-root graph.json."
