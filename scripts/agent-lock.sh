#!/usr/bin/env bash
# Single-writer guard. Purely time-based: the holder records a label and a start time,
# and any session may take over once the lock is older than TTL (default 80 min, under
# the hourly tick so a crashed session costs at most one tick).
set -uo pipefail
cd "$(dirname "$0")/.."
LOCK_DIR=".agent-lock"
TTL_MIN="${TTL_MIN:-80}"

now() { date +%s; }

case "${1:-}" in
  start)
    label="${2:-unknown}"
    mkdir -p "$LOCK_DIR"
    if [[ -f "$LOCK_DIR/since" ]]; then
      since=$(cat "$LOCK_DIR/since" 2>/dev/null || echo 0)
      age=$(( ( $(now) - since ) / 60 ))
      if [[ $age -lt $TTL_MIN ]]; then
        holder=$(cat "$LOCK_DIR/owner" 2>/dev/null || echo unknown)
        echo "LOCK HELD by $holder (${age}m ago, ttl ${TTL_MIN}m)" >&2
        exit 1
      fi
      echo "taking over stale lock (${age}m > ${TTL_MIN}m) from $(cat "$LOCK_DIR/owner" 2>/dev/null || echo '?')" >&2
    fi
    printf '%s' "$(now)" > "$LOCK_DIR/since"
    printf '%s' "$label" > "$LOCK_DIR/owner"
    echo "LOCK ACQUIRED by $label"
    ;;
  stop)
    rm -rf "$LOCK_DIR"
    echo "LOCK RELEASED"
    ;;
  status)
    if [[ -f "$LOCK_DIR/since" ]]; then
      age=$(( ( $(now) - $(cat "$LOCK_DIR/since") ) / 60 ))
      echo "held by $(cat "$LOCK_DIR/owner" 2>/dev/null) for ${age}m (ttl ${TTL_MIN}m)"
    else
      echo "free"
    fi
    ;;
  *)
    echo "usage: $0 {start <label>|stop|status}" >&2
    exit 2
    ;;
esac
