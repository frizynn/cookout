#!/usr/bin/env bash
# pnpm e2e:docker: build the image, run it on a fresh named volume with fly.toml's [env] and a
# COOKOUT_ADMIN_TOKEN made for this run, run packages/e2e against it with that token, then remove
# the container, volume and image, also on failure or Ctrl-C. Exits with the suite's code.
# COOKOUT_PUBLIC_URL is the one [env] value replaced: Docker maps a free local port to the
# container's 8080, so the Host the suite sends is the local address's, not the deployed one's.
# The example handler (packages/handler-example) runs as a second container in the cookout's
# network namespace, as the deployed one runs beside the deployed cookout: the script adds the
# command `example` (URL http://127.0.0.1:8787/webhook) through the cookout CLI, then starts the
# handler with the secret that add shows once, posting its replies to http://127.0.0.1:8080.
set -euo pipefail

run="cookout-e2e-$$-$RANDOM"
image="$run:latest"
handler="$run-handler"
handler_image="$handler:latest"
scratch=$(mktemp -d)

tear_down() {
  docker rm --force "$handler" > /dev/null 2>&1 || true
  docker rm --force --volumes "$run" > /dev/null 2>&1 || true
  docker volume rm --force "$run" > /dev/null 2>&1 || true
  docker image rm --force "$image" "$handler_image" > /dev/null 2>&1 || true
  rm -rf "$scratch"
  echo "e2e:docker: removed the containers, the volume and the images $run and $handler"
}
trap tear_down EXIT
trap 'exit 130' INT TERM

port=$(node -e 'const s = require("node:net").createServer().listen(0, "127.0.0.1", () => { console.log(s.address().port); s.close(); });')
url="http://127.0.0.1:$port"
admin_token=$(node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))')

env_flags=()
while IFS= read -r pair; do
  case "$pair" in
    COOKOUT_PUBLIC_URL=*) env_flags+=(--env "COOKOUT_PUBLIC_URL=$url") ;;
    *) env_flags+=(--env "$pair") ;;
  esac
done < <(awk '/^\[/ { in_env = ($0 == "[env]"); next } in_env && /=/ { sub(/^[ \t]*/, ""); split($0, kv, /[ \t]*=[ \t]*/); gsub(/"/, "", kv[2]); print kv[1] "=" kv[2] }' fly.toml)

echo "e2e:docker: docker build -t $image ."
docker build --quiet -t "$image" . > /dev/null
echo "e2e:docker: docker build -f packages/handler-example/Dockerfile -t $handler_image ."
docker build --quiet -f packages/handler-example/Dockerfile -t "$handler_image" . > /dev/null
COOKOUT_ADMIN_TOKEN="$admin_token" docker run --detach --name "$run" --publish "127.0.0.1:$port:8080" \
  --volume "$run:/data" --env COOKOUT_ADMIN_TOKEN "${env_flags[@]}" "$image" > /dev/null

listening=""
for _ in $(seq 120); do
  logs=$(docker logs "$run" 2>/dev/null)
  if grep -q '"listening"' <<< "$logs"; then
    listening=yes
    break
  fi
  if [ "$(docker inspect --format '{{.State.Running}}' "$run")" != "true" ]; then
    echo "e2e:docker: the container stopped before listening:" >&2
    docker logs "$run" >&2
    exit 1
  fi
  sleep 0.5
done
if [ -z "$listening" ]; then
  echo "e2e:docker: the container wasn't listening after 60 s." >&2
  exit 1
fi
logs=$(docker logs "$run" 2>&1)
if grep -qF "$admin_token" <<< "$logs"; then
  echo "e2e:docker: the container's logs show COOKOUT_ADMIN_TOKEN." >&2
  exit 1
fi

COOKOUT_URL="$url" COOKOUT_TOKEN="$admin_token" COOKOUT_STATE_DIR="$scratch/state" \
  node app/main.ts command add example --url http://127.0.0.1:8787/webhook \
  --schema packages/handler-example/command.schema.json \
  --description "The example handler (packages/handler-example) in its own container" > "$scratch/added.json"
COOKOUT_COMMAND_SECRET=$(node -e 'console.log(JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).secret)' "$scratch/added.json")
rm "$scratch/added.json"
export COOKOUT_COMMAND_SECRET
docker run --detach --name "$handler" --network "container:$run" --env COOKOUT_COMMAND_SECRET \
  --env COOKOUT_URL=http://127.0.0.1:8080 --env HOST=127.0.0.1 --env PORT=8787 "$handler_image" > /dev/null
unset COOKOUT_COMMAND_SECRET

handler_listening=""
for _ in $(seq 60); do
  if docker logs "$handler" 2>/dev/null | grep -q '^handler listening on '; then
    handler_listening=yes
    break
  fi
  if [ "$(docker inspect --format '{{.State.Running}}' "$handler")" != "true" ]; then
    echo "e2e:docker: the handler container stopped before listening:" >&2
    docker logs "$handler" >&2
    exit 1
  fi
  sleep 0.5
done
if [ -z "$handler_listening" ]; then
  echo "e2e:docker: the handler container wasn't listening after 30 s." >&2
  exit 1
fi
echo "e2e:docker: added the command example; its handler is listening beside the cookout"

echo "e2e:docker: running packages/e2e against $url"
COOKOUT_E2E_URL="$url" COOKOUT_E2E_ADMIN_TOKEN="$admin_token" pnpm --filter ./packages/e2e test
