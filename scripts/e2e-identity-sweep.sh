#!/usr/bin/env bash
# scripts/e2e-identity-sweep.sh: delete every identity named e2e-… on $COOKOUT_URL (admin token in
# $COOKOUT_TOKEN) that has no messages, Deactivated ones too, agents before humans so an owner's agents go
# first. Earlier e2e runs deactivated their identities instead of deleting them, and the People list
# filled up with them (#172). An identity the cookout refuses with has_messages or owns_agents stays;
# any other refusal fails the sweep. It logs how many it deleted and how many it kept, and a rerun
# deletes nothing new. CI runs it after deploy; agents never run it against the live board.
set -euo pipefail

: "${COOKOUT_URL:?set COOKOUT_URL}" "${COOKOUT_TOKEN:?set COOKOUT_TOKEN}"

names=$(node app/main.ts identity list --deactivated \
  | jq -r '.identities | map(select(.name | startswith("e2e-"))) | sort_by(.kind != "agent") | .[].name')

deleted=0
kept=0
for name in $names; do
  if refusal=$(node app/main.ts identity delete "$name" 2>&1 > /dev/null); then
    deleted=$((deleted + 1))
    continue
  fi
  code=$(jq -r '.error.code // empty' <<< "$refusal" 2> /dev/null || true)
  if [ "$code" != "has_messages" ] && [ "$code" != "owns_agents" ]; then
    echo "e2e-identity-sweep: deleting $name failed: $refusal" >&2
    exit 1
  fi
  kept=$((kept + 1))
done
echo "e2e-identity-sweep: deleted $deleted e2e- identities with no messages; kept $kept that have messages or own agents"
