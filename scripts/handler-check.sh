#!/usr/bin/env bash
# scripts/handler-check.sh [command] [channel]: check the example handler at $COOKOUT_HANDLER_URL
# (default https://cookout-handler-example.fly.dev) is healthy, call `command` (default `example`)
# in `channel` (default `handler-example`) on $COOKOUT_URL with $COOKOUT_TOKEN, and pass only if
# the command's handler replies in the call's thread within 30 s.
set -euo pipefail

command="${1:-example}"
channel="${2:-handler-example}"
handler="${COOKOUT_HANDLER_URL:-https://cookout-handler-example.fly.dev}"
: "${COOKOUT_URL:?set COOKOUT_URL}" "${COOKOUT_TOKEN:?set COOKOUT_TOKEN}"

curl -fsS -o /dev/null "$handler/health"
thread=$(node app/main.ts command call "$command" --channel "$channel" --data '{"branch":"main"}' | jq -r .threadId)
start=$(date +%s)
while [ $(($(date +%s) - start)) -lt 30 ]; do
  reply=$(node app/main.ts thread get "$thread" | jq -c --arg name "$command" '[.replies[] | select(.author.name == $name) | [.text, .data]] | first // empty')
  if [ -n "$reply" ]; then
    echo "handler-check: thread $thread got $reply after $(($(date +%s) - start))s"
    exit 0
  fi
  sleep 2
done
echo "handler-check: no reply from /$command's handler in thread $thread within 30 s" >&2
exit 1
