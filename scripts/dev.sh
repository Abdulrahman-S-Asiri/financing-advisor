#!/usr/bin/env bash
set -euo pipefail

MOCK_PORT="${MOCK_PORT:-8100}"
API_PORT="${API_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="$REPO_ROOT/.venv/bin/python"
if [[ ! -x "$PYTHON_BIN" ]]; then
  PYTHON_BIN="${PYTHON:-python}"
fi

LOG_DIR="${TMPDIR:-/tmp}/athar-dev"
mkdir -p "$LOG_DIR"

pids=()

cleanup() {
  echo
  echo "Stopping ATHAR services..."
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
}

start_service() {
  local name="$1"
  local cwd="$2"
  shift 2
  (
    cd "$cwd"
    "$@" >"$LOG_DIR/$name.out.log" 2>"$LOG_DIR/$name.err.log"
  ) &
  local pid=$!
  pids+=("$pid")
  echo "$name started as pid $pid"
}

trap cleanup INT TERM EXIT

start_service "mock-open-banking" "$REPO_ROOT" \
  "$PYTHON_BIN" -m uvicorn mock_open_banking.main:app --port "$MOCK_PORT"

start_service "api" "$REPO_ROOT" \
  "$PYTHON_BIN" -m uvicorn api.main:app --port "$API_PORT"

start_service "frontend" "$REPO_ROOT/frontend" \
  npm run dev -- -p "$FRONTEND_PORT"

echo
echo "ATHAR services are starting."
echo "Frontend:          http://127.0.0.1:$FRONTEND_PORT"
echo "API docs:          http://127.0.0.1:$API_PORT/docs"
echo "Mock banking docs: http://127.0.0.1:$MOCK_PORT/docs"
echo "Logs:              $LOG_DIR"
echo
echo "Press Ctrl+C to stop all services."

wait
