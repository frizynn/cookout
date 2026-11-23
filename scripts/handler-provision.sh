#!/usr/bin/env bash
# scripts/handler-provision.sh [command] [channel]: make the cookout at $COOKOUT_URL (admin token in
# $COOKOUT_TOKEN) ready for the example handler app $COOKOUT_HANDLER_APP (default
# cookout-handler-example). It creates `channel` (default `handler-example`) if missing and, if
# `command` (default `example`) is missing, adds it pointing at https://$COOKOUT_HANDLER_APP.fly.dev/webhook
# and pipes its secret, shown this once, straight into `flyctl secrets import --stage` on the app
# (with $FLY_API_TOKEN, or the flyctl login). It never prints the secret, and does nothing on a rerun.
set -euo pipefail

command="${1:-example}"
channel="${2:-handler-example}"
app="${COOKOUT_HANDLER_APP:-cookout-handler-example}"
: "${COOKOUT_URL:?set COOKOUT_URL}" "${COOKOUT_TOKEN:?set COOKOUT_TOKEN}"

if node app/main.ts channel list | jq -e --arg name "$channel" 'any(.channels[]; .name == $name)' > /dev/null; then
  echo "handler-provision: channel $channel exists"
else
  node app/main.ts channel create "$channel" > /dev/null
  echo "handler-provision: created channel $channel"
fi

if node app/main.ts command list | jq -e --arg name "$command" 'any(.commands[]; .name == $name)' > /dev/null; then
  echo "handler-provision: command $command exists"
  exit 0
fi
schema=$(mktemp)
trap 'rm -f "$schema"' EXIT
printf '{"type":"object","properties":{"branch":{"type":"string"}},"required":["branch"]}' > "$schema"
node app/main.ts command add "$command" --url "https://$app.fly.dev/webhook" --schema "$schema" \
  --description "The example handler (packages/handler-example) on Fly" \
  | jq -er '"COOKOUT_COMMAND_SECRET=\(.secret)"' \
  | flyctl secrets import --stage -a "$app" > /dev/null
echo "handler-provision: added command $command and staged its secret on $app"
