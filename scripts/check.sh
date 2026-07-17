#!/usr/bin/env bash
set -euo pipefail

INCLUDE_E2E=0
if [[ "${1:-}" == "--include-e2e" ]]; then
  INCLUDE_E2E=1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="$REPO_ROOT/.venv/bin/python"
if [[ ! -x "$PYTHON_BIN" ]]; then
  PYTHON_BIN="${PYTHON:-python}"
fi

run_step() {
  local name="$1"
  shift
  echo
  echo "==> $name"
  "$@"
}

cd "$REPO_ROOT"

run_step "Backend tests" "$PYTHON_BIN" -m pytest tests -q
run_step "MCP tests" "$PYTHON_BIN" -m pytest mcp_server/tests -q

cd "$REPO_ROOT/frontend"
run_step "Frontend lint" npm run lint
run_step "Frontend typecheck" npm run typecheck
run_step "Frontend unit tests" npm run test
run_step "Frontend build" npm run build

if [[ "$INCLUDE_E2E" == "1" ]]; then
  run_step "Frontend Playwright E2E" npm run e2e
fi

echo
echo "All checks passed."
