#!/usr/bin/env bash
# scripts/stream-check.sh [seconds]: hold GET $COOKOUT_URL/v1/events open with $COOKOUT_TOKEN for
# `seconds` (default 65), print each line with its second, and pass only if the stream was still
# open when curl gave up and it heard a heartbeat every 15 s (seconds / 15, rounded down, of them).
set -euo pipefail

seconds="${1:-65}"
: "${COOKOUT_URL:?set COOKOUT_URL}" "${COOKOUT_TOKEN:?set COOKOUT_TOKEN}"
out=$(mktemp)
trap 'rm -f "$out"' EXIT

start=$(date +%s)
code=0
curl -sSN --max-time "$seconds" -H "authorization: Bearer $COOKOUT_TOKEN" "$COOKOUT_URL/v1/events" \
  | while IFS= read -r line; do echo "$(($(date +%s) - start))s $line" | tee -a "$out"; done \
  || code=$?
elapsed=$(($(date +%s) - start))

heartbeats=$(grep -c ': heartbeat$' "$out" || true)
want=$((seconds / 15))
echo "stream-check: open ${elapsed}s, curl exit $code, $heartbeats heartbeats (want $want)"
# curl exits 28 when --max-time ends a transfer still in flight: the server never closed it.
if [ "$code" -ne 28 ] || [ "$heartbeats" -lt "$want" ]; then
  echo "stream-check: the stream closed early or missed heartbeats" >&2
  exit 1
fi
