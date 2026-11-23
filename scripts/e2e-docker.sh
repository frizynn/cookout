#!/usr/bin/env bash
# pnpm e2e:docker: build the image, run it on a fresh named volume with fly.toml's [env], run
# packages/e2e against it with the admin token from its first boot, then remove the container,
# volume and image, also on failure or Ctrl-C. Exits with the suite's code.
# COOKOUT_PUBLIC_URL is the one [env] value replaced: Docker maps a free local port to the
# container's 8080, so the Host the suite sends is the local address's, not the deployed one's.
set -euo pipefail

run="cookout-e2e-$$-$RANDOM"
image="$run:latest"

tear_down() {
  docker rm --force --volumes "$run" > /dev/null 2>&1 || true
  docker volume rm --force "$run" > /dev/null 2>&1 || true
  docker image rm --force "$image" > /dev/null 2>&1 || true
  echo "e2e:docker: removed the container, the volume and the image $run"
}
trap tear_down EXIT
trap 'exit 130' INT TERM

port=$(node -e 'const s = require("node:net").createServer().listen(0, "127.0.0.1", () => { console.log(s.address().port); s.close(); });')
url="http://127.0.0.1:$port"

env_flags=()
while IFS= read -r pair; do
  case "$pair" in
    COOKOUT_PUBLIC_URL=*) env_flags+=(--env "COOKOUT_PUBLIC_URL=$url") ;;
    *) env_flags+=(--env "$pair") ;;
  esac
done < <(awk '/^\[/ { in_env = ($0 == "[env]"); next } in_env && /=/ { sub(/^[ \t]*/, ""); split($0, kv, /[ \t]*=[ \t]*/); gsub(/"/, "", kv[2]); print kv[1] "=" kv[2] }' fly.toml)

echo "e2e:docker: docker build -t $image ."
docker build --quiet -t "$image" . > /dev/null
docker run --detach --name "$run" --publish "127.0.0.1:$port:8080" --volume "$run:/data" "${env_flags[@]}" "$image" > /dev/null

admin_token=""
for _ in $(seq 120); do
  logs=$(docker logs "$run" 2>/dev/null)
  if grep -q '"listening"' <<< "$logs"; then
    admin_token=$(grep '^{"adminToken' <<< "$logs" | head -n 1 | node -e 'let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => console.log(s.trim() === "" ? "" : JSON.parse(s).adminToken));')
    break
  fi
  if [ "$(docker inspect --format '{{.State.Running}}' "$run")" != "true" ]; then
    echo "e2e:docker: the container stopped before listening:" >&2
    docker logs "$run" >&2
    exit 1
  fi
  sleep 0.5
done
if [ -z "$admin_token" ]; then
  echo "e2e:docker: the container's first boot printed no admin token, or it wasn't listening after 60 s." >&2
  exit 1
fi

echo "e2e:docker: running packages/e2e against $url"
COOKOUT_E2E_URL="$url" COOKOUT_E2E_ADMIN_TOKEN="$admin_token" pnpm --filter ./packages/e2e test
