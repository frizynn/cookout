#!/usr/bin/env bash
# scripts/handler-provision.sh [command] [channel]: make the cookout at $COOKOUT_URL (admin token in
# $COOKOUT_TOKEN) ready for the example handler app $COOKOUT_HANDLER_APP (default
# cookout-handler-example). It creates `channel` (default `handler-example`) if missing and, if
# `command` (default `example`) is missing, adds it pointing at https://$COOKOUT_HANDLER_APP.fly.dev/webhook
# with the schema in packages/handler-example/command.schema.json. It pipes the secret, shown this once,
# straight into `flyctl secrets import --stage` on the app (with $FLY_API_TOKEN, or the flyctl login).
# If the command exists but the app has no COOKOUT_COMMAND_SECRET (staging failed after an earlier add),
# it rotates the command's secret and stages the new one the same way. It never prints the secret, and
# changes nothing on a rerun once the app has the secret.
set -euo pipefail

command="${1:-example}"
channel="${2:-handler-example}"
app="${COOKOUT_HANDLER_APP:-cookout-handler-example}"
: "${COOKOUT_URL:?set COOKOUT_URL}" "${COOKOUT_TOKEN:?set COOKOUT_TOKEN}"

stage_secret() {
  jq -er '"COOKOUT_COMMAND_SECRET=\(.secret)"' | flyctl secrets import --stage -a "$app" > /dev/null
}

if node app/main.ts channel list | jq -e --arg name "$channel" 'any(.channels[]; .name == $name)' > /dev/null; then
  echo "handler-provision: channel $channel exists"
else
  node app/main.ts channel create "$channel" > /dev/null
  echo "handler-provision: created channel $channel"
fi

if ! node app/main.ts command list | jq -e --arg name "$command" 'any(.commands[]; .name == $name)' > /dev/null; then
  node app/main.ts command add "$command" --url "https://$app.fly.dev/webhook" \
    --schema packages/handler-example/command.schema.json \
    --description "The example handler (packages/handler-example) on Fly" | stage_secret
  echo "handler-provision: added command $command and staged its secret on $app"
  exit 0
fi

secrets=$(flyctl secrets list -a "$app" --json)
if jq -e 'any(.[]; (.Name // .name) == "COOKOUT_COMMAND_SECRET")' <<< "$secrets" > /dev/null; then
  echo "handler-provision: command $command exists and $app has its secret"
  exit 0
fi
node app/main.ts command rotate "$command" | stage_secret
echo "handler-provision: command $command exists but $app had no secret, so it rotated the secret and staged it on $app"
