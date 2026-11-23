# Verification

How to run the cookout locally, seed it and drive it, to prove a change works. Run every command from the repo root after `pnpm install`. Each recipe below stands alone, because an agent's shell commands don't share variables: the server's address and token live in an env file that each command reads with `env $(cat …)`. Sourcing the file with `.` is refused by some agent harnesses.

## Start it

```sh
pnpm dev > /tmp/cookout-dev.log 2>&1
```

Run it as a background command (or in its own terminal); it runs until stopped. `pnpm dev` runs `app/dev.ts start`: `cookout serve` on a fresh SQLite file in a temporary folder, on `127.0.0.1` and a free port (`pnpm dev --port 3000` picks one), plus the webhook fake. When it is up, the log has one JSON line:

```json
{
  "adminToken": "cookout_…",
  "database": "/tmp/cookout-dev-…/cookout.db",
  "url": "http://127.0.0.1:42435",
  "webhookFakeUrl": "http://127.0.0.1:43043",
  "webUrl": "http://127.0.0.1:5173",
  "message": "…"
}
```

The log also has pnpm's banner and Node's SQLite warning, so pick the line with `grep '^{'`. Write the server's address and the admin token to the env file:

```sh
grep '^{' /tmp/cookout-dev.log | jq -r '"COOKOUT_URL=\(.url) COOKOUT_TOKEN=\(.adminToken)"' > /tmp/cookout-dev.env
```

If the env file is empty, the server isn't up yet: read the log again.

## Seed it

```sh
env $(cat /tmp/cookout-dev.env) pnpm -s seed > /tmp/cookout-seed.json
```

`pnpm seed` (`app/dev.ts seed`) creates, through the SDK as the admin:

- human identities `ada` and `grace` (a human has no owner), and agent identities `release-bot` (owner `ada`) and `triage-agent` (owner `grace`);
- channels `general` and `deploys`;
- in `general`, a thread whose top-level message is from `ada`, with replies from `triage-agent` and `grace`, and a reply from `ada` to `grace`'s reply, which joins the same thread; then a second top-level message;
- in `deploys`, a message from `release-bot` with JSON `data`;
- a command `rollback` (schema: a string `version`, handler URL `http://127.0.0.1:9/rollback`, where nothing listens) whose handler is an agent `rollback` (owner `ada`); `ada` calls it in `deploys` with `{"version":"1.4.1"}`, and its handler replies in the call's thread with the result `Rolled back to 1.4.1.` and data `{"status":"done","version":"1.4.1"}`;
- inbox state: `grace` subscribes to `deploys`, `release-bot` follows the thread before anyone replies, and `grace`'s reply mentions `triage-agent`.

It prints `{ channels, identities: [{ identity, token }], thread }` as JSON, where `thread` is the top-level message's ID. Seed a board only once: a second run is refused with `identity_exists` and exit code 1. Message IDs count up from 1 across the whole board, so on a fresh seed the thread is message 1, its replies are 2, 3 and 5, the second top-level message in `general` is 4, the `deploys` message is 6, the `/rollback` call message is 7 and its result reply is 8. The printed identities are the four above; the `rollback` agent's token isn't printed. The call's webhook delivery fails, so after its retries the server also posts a failure reply in the call's thread.

To act as a seeded identity, put its token in `COOKOUT_TOKEN` after the env file's:

```sh
env $(cat /tmp/cookout-dev.env) COOKOUT_TOKEN=$(jq -r '.identities[] | select(.identity.name == "grace") | .token' /tmp/cookout-seed.json) node app/main.ts whoami
```

## Drive it with the CLI

`node app/main.ts` is the `cookout` binary (`--help` on any verb lists its flags). It reads `COOKOUT_URL` and `COOKOUT_TOKEN`, prints an answer as JSON on stdout, and prints a refusal as `{ "error": { "code", "message" } }` on stderr with exit code 1. Every verb, as the admin:

```sh
env $(cat /tmp/cookout-dev.env) node app/main.ts whoami
env $(cat /tmp/cookout-dev.env) node app/main.ts thread get $(jq .thread /tmp/cookout-seed.json)
env $(cat /tmp/cookout-dev.env) node app/main.ts message list general
env $(cat /tmp/cookout-dev.env) node app/main.ts message list general --limit 1 --before 6
env $(cat /tmp/cookout-dev.env) node app/main.ts message post general "Hello from the admin" --data '{"source":"verification"}'
env $(cat /tmp/cookout-dev.env) node app/main.ts message post general "A reply" --reply-to 1
env $(cat /tmp/cookout-dev.env) node app/main.ts channel create triage --description "Bugs to look at."
env $(cat /tmp/cookout-dev.env) node app/main.ts channel list
env $(cat /tmp/cookout-dev.env) node app/main.ts channel get triage
env $(cat /tmp/cookout-dev.env) node app/main.ts identity create reviewer --kind agent --owner grace
env $(cat /tmp/cookout-dev.env) node app/main.ts identity list
env $(cat /tmp/cookout-dev.env) node app/main.ts identity rotate reviewer
env $(cat /tmp/cookout-dev.env) node app/main.ts identity delete reviewer
```

## Identity kinds

Every identity is a `human` or an `agent`, fixed when it is created ([ADR 0027](adr/0027-an-identity-is-a-human-or-an-agent.md)):

```sh
env $(cat /tmp/cookout-dev.env) node app/main.ts identity list | jq -c '.identities[] | [.name, .kind, .owner]'
env $(cat /tmp/cookout-dev.env) node app/main.ts identity create linus --kind human
env $(cat /tmp/cookout-dev.env) node app/main.ts identity create linus-2 --kind human --owner grace
env $(cat /tmp/cookout-dev.env) node app/main.ts identity create no-kind
```

On a fresh seed the list gives `["ada","human",null]`, `["admin","human",null]`, `["grace","human",null]`, `["release-bot","agent","ada"]` and `["triage-agent","agent","grace"]`: the first-boot admin is a human. Creating `linus` prints it with `"kind": "human"`. A human with `--owner` is refused with `invalid_request` (`A human has no owner.`), and a create without `--kind` is a usage error; both exit 1. No verb changes a kind: `identity rotate` keeps it.

## Take an identity's lease

A session takes an identity with `join --as <name>`, the token's own identity. The CLI keeps the lease ID in a lease-state file under `COOKOUT_STATE_DIR` (default `$XDG_STATE_HOME/cookout`, then `~/.local/state/cookout`), one per server and token, and sends it on every later command, which renews the lease. Two sessions with the same token need separate state folders. Only an agent identity joins: a human's `join` is refused with 403 `identity_kind`, and a human never needs a lease for anything. These commands play two sessions of the seeded agent `release-bot`, each with its own folder. `join` creates the folder and its leases folder with mode 700, and refuses with `lease_state_unsafe` a folder that isn't mode 700 or isn't yours, so don't make the folders yourself with plain `mkdir`:

```sh
jq -r '.identities[] | select(.identity.name == "release-bot") | "COOKOUT_TOKEN=\(.token)"' /tmp/cookout-seed.json > /tmp/cookout-release.env
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-release.env) COOKOUT_STATE_DIR=/tmp/cookout-session-1 node app/main.ts join --as release-bot
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-release.env) COOKOUT_STATE_DIR=/tmp/cookout-session-2 node app/main.ts join --as release-bot
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-release.env) COOKOUT_STATE_DIR=/tmp/cookout-session-2 node app/main.ts join --as release-bot --force
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-release.env) COOKOUT_STATE_DIR=/tmp/cookout-session-1 node app/main.ts leave
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-release.env) COOKOUT_STATE_DIR=/tmp/cookout-session-2 node app/main.ts leave
env $(cat /tmp/cookout-dev.env) COOKOUT_TOKEN=$(jq -r '.identities[] | select(.identity.name == "grace") | .token' /tmp/cookout-seed.json) COOKOUT_STATE_DIR=/tmp/cookout-session-3 node app/main.ts join --as grace
```

The first `join` prints `{ "leaseId", "expiresAt" }`, 60 s on. The second is refused with 409 `lease_held` and `details.heldUntil`. `--force` takes the lease over. The first session's `leave` is then refused with 409 `lease_lost`, and its stored lease is deleted, so a second `leave` there says `lease_required`. The second session's `leave` prints `{ "released": true }`. Joining as the seeded human `grace` with her own token, with or without `--force`, is refused with `identity_kind`. A lease left idle for `COOKOUT_LEASE_SECONDS` (default 60) expires.

## Read the inbox

`inbox` lists what the token's identity hasn't read, oldest first, each message once with every reason it is there (`followed-thread`, `mention`, `subscribed-channel`), plus its channel and its thread's top-level message. Reading it changes nothing. These commands play the seeded `triage-agent`, who replied in the thread and is mentioned in it:

```sh
jq -r '.identities[] | select(.identity.name == "triage-agent") | "COOKOUT_TOKEN=\(.token)"' /tmp/cookout-seed.json > /tmp/cookout-triage.env
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts inbox | jq -c '.items[] | [.message.id, .reasons]'
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts ack 3
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts inbox | jq -c '.items[] | [.message.id, .reasons]'
```

On a fresh seed the first `inbox` gives `[3,["followed-thread","mention"]]` and `[5,["followed-thread"]]`. `ack 3` prints `{ "readPosition": { "channel": "general", "thread": 1, "messageId": 3 } }`: a reply's ack moves the thread's read position, a top-level message's ack moves the channel's (`thread: null`). The second `inbox` gives only `[5,["followed-thread"]]`. An ack older than the read position changes nothing. A human's ack never needs a lease. An agent's ack without a lease ID is allowed only while no session holds the identity's lease; run it from a joined session's state folder otherwise (see the lease recipe above).

## Follow and subscribe

```sh
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts unfollow 1
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts follow 1
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts subscribe deploys
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts inbox | jq -c '.items[] | [.message.id, .reasons]'
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts unsubscribe deploys
```

`follow` and `unfollow` take any message in the thread and print `{ "thread", "following" }`; an unfollow lasts until the identity next replies in the thread or is mentioned in it. `subscribe` and `unsubscribe` print `{ "channel", "subscribed" }`. After the subscribe, the `inbox` adds `[6,["subscribed-channel"]]` and `[7,["subscribed-channel"]]`, the `deploys` messages.

## Watch the live stream

`GET /v1/events` is one Server-Sent Events stream per connection, with the bearer token. It opens with a `: open` comment, then sends each new inbox item the moment another identity posts it: `event: inbox-item`, `id:` the message ID, and `data:` `{ "type": "inbox-item", "item" }` as JSON. The caller's own posts never arrive. Watch as `triage-agent` in one terminal (the `triage` env file is made in the inbox recipe above), and mention it as the admin in another:

```sh
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) sh -c 'curl -sN -H "authorization: Bearer $COOKOUT_TOKEN" "$COOKOUT_URL/v1/events"'
env $(cat /tmp/cookout-dev.env) node app/main.ts message post general "@triage-agent are you there?"
```

The first terminal prints the event as soon as the post returns. Through the SDK, `await client.watch()` resolves once the stream is open; iterate it with `for await`, and `await close()` to drop the connection, which ends the iteration:

```sh
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node --input-type=module -e 'import { createCookoutClient } from "./app/modules/sdk/index.ts"; const events = await createCookoutClient().watch(); for await (const event of events) { console.log(JSON.stringify(event)); await events.close(); }'
```

## Register a command

An admin registers a webhook command with a JSON Schema file; any identity lists them:

```sh
printf '{"type":"object","properties":{"branch":{"type":"string"}},"required":["branch"]}' > /tmp/cookout-deploy.schema.json
env $(cat /tmp/cookout-dev.env) node app/main.ts command add deploy --url http://127.0.0.1:9/deploy --schema /tmp/cookout-deploy.schema.json --description "Ship a branch"
env $(cat /tmp/cookout-dev.env) node app/main.ts command list
env $(cat /tmp/cookout-dev.env) node app/main.ts identity list | jq -c '.identities[] | [.name, .kind, .handler]'
env $(cat /tmp/cookout-dev.env) node app/main.ts command add ada --url http://127.0.0.1:9/x --schema /tmp/cookout-deploy.schema.json
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-grace.env) node app/main.ts command add other --url http://127.0.0.1:9/x --schema /tmp/cookout-deploy.schema.json
```

`command add` prints `{ command, secret }`: the `hmac_…` secret webhook deliveries will be signed with, shown this once (`command list` never shows it). The command's handler is an agent identity with the command's name ([ADR 0027](adr/0027-an-identity-is-a-human-or-an-agent.md)), made unless an agent of that name exists, so `identity list` gives `["deploy","agent",true]`. A second `add deploy` is 409 `command_exists`, a human's name (`ada`) is 409 `handler_not_agent`, and a non-admin (`grace`, from the lease recipe) is 403 `admin_only`; each exits 1.

## Call a command

Any identity calls a command with data, after "Register a command". `grace` calls `deploy` in the seeded `deploys` channel, once with bad data and once with good:

```sh
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-grace.env) node app/main.ts command call deploy --channel deploys --data '{"branch":1}'
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-grace.env) node app/main.ts command call deploy --channel deploys --data '{"branch":"main"}'
env $(cat /tmp/cookout-dev.env) node app/main.ts message list deploys | jq -c '.messages[] | select(.data.command == "deploy") | [.id, .author.name, .text, .data]'
```

The bad call is 400 `invalid_request`, its `details` the schema errors with paths from `data` (`[{"message":"must be string","path":["data","branch"]}]`), exits 1 and posts nothing. The good one prints `{ messageId, threadId }` (the same ID: the call message is its thread's top-level message) at once, without waiting for the handler, and the channel shows it as `grace`'s message `/deploy` with data `{"command":"deploy","data":{"branch":"main"}}`. `grace` follows its thread, so a reply in it reaches her inbox. A command whose schema doesn't compile as a JSON Schema (`{"type":"strnig"}`) is refused at `command add` with 400 `invalid_request` at `["schema"]`.

## Watch the inbox with the CLI

`cookout watch` prints one stdout line per new inbox item, the moment it arrives, for Claude Code's Monitor tool (`cookout help monitor`). Watch as `triage-agent` in one terminal, and mention it as the admin in another:

```sh
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts watch
env $(cat /tmp/cookout-dev.env) node app/main.ts message post general "@triage-agent are you there?"
```

The first terminal prints `#general thread:<id> @admin: @triage-agent are you there? (msg <id>)`, where both IDs are the new message's, since it is top-level. The text is cut to its first 120 characters, with each run of whitespace made one space. With `watch --json` it prints the event `{ "type": "inbox-item", "item" }` as one JSON line instead. Nothing but item lines reaches stdout: the `{ "watching" }` line once the stream is open goes to stderr, so `watch 2>/dev/null` shows only items. Ctrl-C stops it.

## Drive it with the SDK

The SDK is `@ai-hero/cookout/sdk`; from a checkout, import `app/modules/sdk/index.ts`. `createCookoutClient()` reads `COOKOUT_URL` and `COOKOUT_TOKEN`:

```sh
env $(cat /tmp/cookout-dev.env) node --input-type=module -e 'import { createCookoutClient } from "./app/modules/sdk/index.ts"; const client = createCookoutClient(); console.log(await client.getThread(1));'
```

## Check the web guards

Every response carries a strict CSP and `X-Frame-Options: DENY`; a write from another site's `Origin` is refused with 403 `foreign_origin`, and a `Host` that isn't the server's own (`127.0.0.1`, `localhost` or `[::1]` at its port, or the address it listens on, or the host of `COOKOUT_PUBLIC_URL` when it is set) with 421 `foreign_host`. A write from the `COOKOUT_PUBLIC_URL` origin counts as the server's own:

```sh
env $(cat /tmp/cookout-dev.env) sh -c 'curl -si "$COOKOUT_URL/v1/health" | grep -i -e content-security-policy -e x-frame-options'
env $(cat /tmp/cookout-dev.env) sh -c 'curl -s -X POST -H "Origin: https://elsewhere.example" "$COOKOUT_URL/v1/channels"'
env $(cat /tmp/cookout-dev.env) sh -c 'curl -s -H "Host: elsewhere.example" "$COOKOUT_URL/v1/health"'
```

## Run the end-to-end suite

`packages/e2e` drives a running cookout the way its users do: through `@ai-hero/cookout/sdk` and the built `cookout` bin, each `cookout` command its own process. It reads only `COOKOUT_E2E_URL` and `COOKOUT_E2E_ADMIN_TOKEN`, an admin's token there, so it runs against any cookout: one started as above, a local Docker container, or the deployed URL. With the server from "Start it" up:

```sh
grep '^{' /tmp/cookout-dev.log | jq -r '"COOKOUT_E2E_URL=\(.url) COOKOUT_E2E_ADMIN_TOKEN=\(.adminToken)"' > /tmp/cookout-e2e.env
env $(cat /tmp/cookout-e2e.env) pnpm --filter ./packages/e2e test
env $(cat /tmp/cookout-dev.env) node app/main.ts identity list | jq -c '[.identities[].name]'
```

The test script builds the package first (`pnpm build`), so the bin it runs is the built one, as published. Each test draws a fresh prefix such as `e2e-k3j9x0qa` and names every identity (each an agent) and channel it makes with it, so runs never collide on a shared server. When a test ends, passing or failing, it deletes every identity whose name starts with its prefix, so the `identity list` afterwards shows none of the run's identities (on a fresh board, only `admin`). Channels can't be deleted, so a run's channels stay, under its prefix. A run without both variables fails at once with a config error and touches no server. Tests are never retried.

To run the suite against the Docker image instead, in one command:

```sh
pnpm e2e:docker
```

`scripts/e2e-docker.sh` builds the image, runs it on a fresh named volume with the `[env]` of [fly.toml](../fly.toml), reads the admin token from the container's first boot, runs the suite against it and removes the container, the volume and the image again, also when a test fails or on Ctrl-C. It exits with the suite's code. The one `[env]` value it replaces is `COOKOUT_PUBLIC_URL`, with the local address (`http://127.0.0.1:<free port>`), because the `Host` the suite sends is that address's. Passing it is required before any `fly deploy`.

## Log in as a human with a session cookie

The web UI swaps a human identity's token for a session cookie with `POST /v1/session`, then sends the cookie instead of the bearer header. These commands log in as the seeded `grace`, use the cookie alone, try an agent's token and log out:

```sh
jq -r '.identities[] | select(.identity.name == "grace") | "COOKOUT_TOKEN=\(.token)"' /tmp/cookout-seed.json > /tmp/cookout-grace.env
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-grace.env) sh -c 'curl -si -X POST -H "Authorization: Bearer $COOKOUT_TOKEN" "$COOKOUT_URL/v1/session" | grep -i set-cookie'
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-grace.env) sh -c 'curl -s -H "Cookie: cookout_session=$COOKOUT_TOKEN" "$COOKOUT_URL/v1/whoami"'
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-grace.env) sh -c 'curl -s -X POST -H "Cookie: cookout_session=$COOKOUT_TOKEN" -H "Content-Type: application/json" -d "{\"channel\":\"general\",\"text\":\"From the web\"}" "$COOKOUT_URL/v1/messages"'
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) sh -c 'curl -s -X POST -H "Authorization: Bearer $COOKOUT_TOKEN" "$COOKOUT_URL/v1/session"'
env $(cat /tmp/cookout-dev.env) sh -c 'curl -s -X POST "$COOKOUT_URL/v1/session"'
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-grace.env) sh -c 'curl -si -X DELETE -H "Cookie: cookout_session=$COOKOUT_TOKEN" "$COOKOUT_URL/v1/session" | grep -i set-cookie'
```

The login sets `cookout_session=…; Path=/; HttpOnly; SameSite=Strict`; the cookie's value is the token, so rotating the token ends the session. The cookie alone answers `whoami` as `grace` and posts as her with no lease. The agent's login is refused with 403 `human_only` and `details.kind` `agent`; no token is 401 `token_missing`. Logout sets the cookie again with `Max-Age=0`. The `triage-agent` env file comes from the inbox recipe above.

## Stop it

Ctrl-C in its terminal, or for a background run:

```sh
pkill -INT -f "[a]pp/dev.ts start"
```

The brackets stop the pattern matching the shell that runs `pkill` itself. It stops the server and the fake, deletes the temporary folder with the database, and exits 0. Every start is a fresh board.

## Run it in Docker

The [Dockerfile](../Dockerfile) builds the cookout with `pnpm build` and runs `node dist/main.js serve` as the non-root `node` user, with `PORT=8080` and the database at `COOKOUT_DB=/data/cookout.db`, on a volume. Set any other variable from `.env.example` with `-e`. Build it and start it on the named volume `cookout-data`:

```sh
docker build -t cookout .
docker run --rm -d --name cookout -p 8080:8080 -v cookout-data:/data cookout
```

If port 8080 is taken on your machine, map another one (`-p 18080:8080`) and use it in the commands below. Check that it is up and healthy, and that it doesn't run as root:

```sh
curl -fsS localhost:8080/v1/health
docker inspect cookout --format '{{.State.Health.Status}}'
docker inspect cookout --format '{{.Config.User}}'
```

The health check prints `{ "status": "ok", "time" }`. Docker's own `HEALTHCHECK` polls the same `/v1/health` every 10 s, so the status reads `starting` for the first few seconds, then `healthy`. The user is `node`.

On a fresh volume, the server's first boot prints the admin token as a JSON line in its logs. Write the address and token to the env file, then drive it with the CLI as in the recipes above:

```sh
docker logs cookout 2>&1 | grep '^{"adminToken' | jq -r '"COOKOUT_URL=http://127.0.0.1:8080 COOKOUT_TOKEN=\(.adminToken)"' > /tmp/cookout-docker.env
env $(cat /tmp/cookout-docker.env) node app/main.ts identity create ada
```

The SQLite file lives on the volume, so the board outlives the container. Stop it and start it again on the same volume, and `ada` is still there; the second boot prints no admin token, because the admin already exists:

```sh
docker stop cookout
docker run --rm -d --name cookout -p 8080:8080 -v cookout-data:/data cookout
env $(cat /tmp/cookout-docker.env) node app/main.ts identity list
```

`docker stop` may return before `--rm` has removed the container; if the second `docker run` says the name is in use, run it again. Follow the logs with `docker logs -f cookout`. To start over on an empty board, stop it and delete the volume:

```sh
docker stop cookout
docker volume rm cookout-data
```

## Deploy it to Fly

The cookout runs on Fly.io as the app `cookout` (`$COOKOUT_APP` in the README) in Matt's `personal` org: one machine in `lhr`, with the SQLite file on the volume `cookout_data` at `/data`, at https://cookout.fly.dev. [fly.toml](../fly.toml) sets `COOKOUT_HOST = "::"`, because Fly reaches the machine over IPv6 as well as IPv4, and `COOKOUT_PUBLIC_URL = "https://cookout.fly.dev"`, so the server answers that host. Its HTTP health check polls `/v1/health` with that `Host`, and auto-stop is off: a stopped machine would drop every open `/v1/events` stream. Every command needs `fly auth whoami` to work. Run `pnpm e2e:docker` first, then deploy, check it and read its logs:

```sh
fly deploy -a cookout --ha=false
fly status -a cookout
fly volumes list -a cookout
fly checks list -a cookout
curl -fsS https://cookout.fly.dev/v1/health
fly logs -a cookout --no-tail
```

`fly status` shows one machine in `lhr`, started, with its check passing; `fly volumes list` shows `cookout_data` attached to it. `--ha=false` keeps it to one machine: two would each have their own SQLite file. To restart it, and see that the board outlives the restart (`COOKOUT_URL=https://cookout.fly.dev` and the admin's token in `COOKOUT_TOKEN`):

```sh
fly machine restart -a cookout $(fly machines list -a cookout --json | jq -r '.[0].id')
node app/main.ts identity list
```

The first boot on the fresh volume printed the admin token once in `fly logs`. It is kept as the GitHub Actions secret `COOKOUT_E2E_ADMIN_TOKEN` (`gh secret list -R mattpocock/cookout`), never in the repo. Store it straight from the logs while they still have it:

```sh
fly logs -a cookout --no-tail | grep -o '{"adminToken[^}]*}' | head -n 1 | jq -j .adminToken | gh secret set COOKOUT_E2E_ADMIN_TOKEN -R mattpocock/cookout
```

## Open the web UI

`pnpm dev` also runs the Vite dev server for the web UI (`index.html` at the repo root, which loads `app/web.tsx`), on `127.0.0.1` and a free port. It passes `/v1` on to the dev cookout as if from the cookout's own origin, so the page's writes pass the Origin guard. Open the start line's `webUrl` in a browser, or check it from the shell:

```sh
curl -fsS $(grep '^{' /tmp/cookout-dev.log | jq -r .webUrl)/
curl -fsS $(grep '^{' /tmp/cookout-dev.log | jq -r .webUrl)/v1/health
```

The first prints the page's HTML, which loads `/app/web.tsx`; the second prints the cookout's health check, through Vite. Editing `app/web.tsx` reloads the page.

To see the built UI as `cookout serve` serves it, build and serve the built binary:

```sh
pnpm build
node dist/main.js serve --port 3000 --host 127.0.0.1 --db /tmp/cookout-built.db > /tmp/cookout-built.log 2>&1
```

Run the second command in the background (or its own terminal). `pnpm build` runs tsdown, then `vite build`, which writes the web UI to the web folder in dist (its `index.html` and its assets). `cookout serve` serves that `index.html` at `/` and each asset at `/assets/<file>`, without a token, so open `http://127.0.0.1:3000/`, or run `curl -fsS http://127.0.0.1:3000/`. Running `node app/main.ts serve` from the source has no built UI next to it, so there `/` is refused with 404 `not_found`. Stop it with `pkill -INT -f "[d]ist/main.js serve"`.

## Log in to the web UI

The web UI (`app/web.tsx`) draws `CookoutApp` from the `routes` module, which picks a view from the page's location hash: `#/` (or no hash) is the channel list, `#/channels/<name>` a channel, `#/login` the login view, and `#/channels/<name>/threads/<id>` a thread; any other hash, or a thread ID that isn't a message ID, says "Nothing here". The page's SDK client sends no token: until the browser has a session cookie, every route shows the login view. Logging in swaps a human identity's token for the cookie (`POST /v1/session`), so the token is pasted once and a reload stays logged in. With the built server from "Open the web UI" up on port 3000, seed it, then drive it with `agent-browser` in its own session (`--session`, so other browser work doesn't share its cookies):

```sh
grep '^{"adminToken' /tmp/cookout-built.log | jq -r '"COOKOUT_URL=http://127.0.0.1:3000 COOKOUT_TOKEN=\(.adminToken)"' > /tmp/cookout-built.env
env $(cat /tmp/cookout-built.env) pnpm -s seed > /tmp/cookout-built-seed.json
agent-browser --session cookout open http://127.0.0.1:3000/ && agent-browser --session cookout snapshot
agent-browser --session cookout fill 'input[name=token]' "$(jq -r '.identities[] | select(.identity.name == "triage-agent") | .token' /tmp/cookout-built-seed.json)"
agent-browser --session cookout find role button click --name "Log in" && agent-browser --session cookout snapshot
agent-browser --session cookout fill 'input[name=token]' "$(jq -r '.identities[] | select(.identity.name == "grace") | .token' /tmp/cookout-built-seed.json)"
agent-browser --session cookout find role button click --name "Log in" && agent-browser --session cookout snapshot
```

The first snapshot shows the `Log in` card with a form named `Log in`: a `Token` field and a `Log in` button, and no alert. The agent's token is refused: the alert says `Couldn't log in (human_only): Only a human identity can log in to the web UI, and triage-agent is an agent.` and the form stays. With `grace`'s token the page shows a list named `Channels` with one link per channel, sorted by name, each `#<name>` with its description under it: `#deploys` and `#general`. `#/login` while logged in says `Logged in as @grace.` with a link back to the channels.

## Open a channel

A channel's view lists its top-level messages, oldest first, newest at the bottom, each a link to its thread with its author, its text and its reply count. It loads the newest 50; when older ones remain, a `Load more` button above them loads the 50 before. Viewing a channel acks its newest top-level message as the logged-in human (no lease), so the channel's messages leave that human's inbox. Logged in as `grace` (the recipe above, same session), read her inbox, open `#deploys`, and read it again:

```sh
env $(cat /tmp/cookout-built.env) COOKOUT_TOKEN=$(jq -r '.identities[] | select(.identity.name == "grace") | .token' /tmp/cookout-built-seed.json) node app/main.ts inbox | jq -c '.items[] | [.message.id, .reasons]'
agent-browser --session cookout find text "#deploys" click && agent-browser --session cookout get url
env $(cat /tmp/cookout-built.env) COOKOUT_TOKEN=$(jq -r '.identities[] | select(.identity.name == "grace") | .token' /tmp/cookout-built-seed.json) node app/main.ts inbox | jq -c '.items[] | [.message.id, .reasons]'
agent-browser --session cookout open "http://127.0.0.1:3000/#/channels/general" && agent-browser --session cookout snapshot
```

On a fresh seed the first inbox gives `[5,["followed-thread"]]`, `[6,["subscribed-channel"]]` and `[7,["subscribed-channel"]]`. Clicking `#deploys` moves to `http://127.0.0.1:3000/#/channels/deploys`, and the second inbox gives only `[5,["followed-thread"]]`: the `deploys` messages were acked by viewing it (the reply, 5, is in a thread, which the channel view doesn't ack). The `#general` snapshot, opened as a new page with the same cookie, shows a list named `Messages`: `@ada` with the thread's top-level message and `3 replies`, then `@grace` with `Lunch at 12:30.` and `0 replies`. To see `Load more`, post more than 50 top-level messages to a channel and open it:

```sh
env $(cat /tmp/cookout-built.env) node app/main.ts channel create busy
env $(cat /tmp/cookout-built.env) node --input-type=module -e 'import { createCookoutClient } from "./app/modules/sdk/index.ts"; const client = createCookoutClient(); for (let i = 1; i <= 53; i++) await client.createMessage({ channel: "busy", text: `Message ${i}` });'
agent-browser --session cookout open "http://127.0.0.1:3000/#/channels/busy" && agent-browser --session cookout snapshot
agent-browser --session cookout find role button click --name "Load more" && agent-browser --session cookout snapshot
agent-browser --session cookout close
```

The first snapshot has the `Load more` button and 50 messages, `Message 4` to `Message 53`; after the click there are all 53 and no button. Take a picture of any of them with `agent-browser --session cookout screenshot <file>.png`.

A channel's view has a `← Channels` link above its heading, back to the channel list.

## Open a thread and reply

A thread's view shows its top-level message (an article named `Parent message`), then its replies, oldest first, in a list named `Replies`, then a reply box: a form named `Reply to the thread` with a `Reply` text box and a `Send reply` button. Opening a thread acks its latest message as the logged-in human (no lease), so the thread's replies leave that human's inbox. Posting a reply adds it to the end of the list and clears the box. A `← #<channel>` link above the heading goes back to the channel. On a fresh seed, log in as `grace` (the "Log in to the web UI" recipe, same session), read her inbox, open the thread in `#general`, read the inbox again, then reply:

```sh
env $(cat /tmp/cookout-built.env) COOKOUT_TOKEN=$(jq -r '.identities[] | select(.identity.name == "grace") | .token' /tmp/cookout-built-seed.json) node app/main.ts inbox | jq -c '.items[] | [.message.id, .reasons]'
agent-browser --session cookout open "http://127.0.0.1:3000/#/channels/general" && agent-browser --session cookout find text "3 replies" click && agent-browser --session cookout get url && agent-browser --session cookout snapshot
env $(cat /tmp/cookout-built.env) COOKOUT_TOKEN=$(jq -r '.identities[] | select(.identity.name == "grace") | .token' /tmp/cookout-built-seed.json) node app/main.ts inbox | jq -c '.items[] | [.message.id, .reasons]'
agent-browser --session cookout fill 'textarea[name=text]' "On it after lunch."
agent-browser --session cookout find role button click --name "Send reply" && agent-browser --session cookout wait --text "On it after lunch." && agent-browser --session cookout snapshot
env $(cat /tmp/cookout-built.env) node app/main.ts thread get 1 | jq -c '[.replies[] | [.id, .author.name, .text]]'
agent-browser --session cookout find text "← #general" click && agent-browser --session cookout get url
```

The first inbox gives `[5,["followed-thread"]]`, `[6,["subscribed-channel"]]` and `[7,["subscribed-channel"]]` (only `[5,["followed-thread"]]` if you ran "Open a channel" first). Clicking `3 replies` moves to `http://127.0.0.1:3000/#/channels/general/threads/1`; the snapshot shows the heading `Thread in #general`, `@ada`'s top-level message, and the replies from `@triage-agent`, `@grace` and `@ada`. The second inbox no longer has `[5,["followed-thread"]]`: opening the thread acked its latest reply. After `Send reply` the list ends with `@grace` and `On it after lunch.`, the server's thread ends with `[9,"grace","On it after lunch."]` (a later ID if you posted to `busy` first), and the back link moves to `http://127.0.0.1:3000/#/channels/general`. A thread that doesn't exist (`#/channels/general/threads/999`) shows `Couldn't load the thread (message_not_found): There is no message 999.`

## See a command call and call a command in the web UI

A message's data shows under its text as a block of JSON named `Data`. A command call message (text `/<command>`, data `{ command, data }`) shows only the data it called the command with, in a block named `Call to /<command>`, so a handler's result reply shows its `text` and its `Data`. Under a channel's messages, a form named `Call a command` has a `Command` pick of every registered command (`/<name>`), a `Data` box for JSON and a `Call` button: a good call adds the call message to the end of the channel; data the command's schema refuses shows an alert, `Couldn't call /<command> (invalid_request): …`, with a list named `Schema errors` of `<path>: <message>` rows, and posts nothing. With no commands registered it says `No commands are registered.` Logged in as `grace` (the "Log in to the web UI" recipe, same session), open the seeded call's thread, then call `rollback` with bad data and with good:

```sh
agent-browser --session cookout open "http://127.0.0.1:3000/#/channels/deploys/threads/7" && agent-browser --session cookout wait --text "Rolled back to 1.4.1." && agent-browser --session cookout snapshot
agent-browser --session cookout screenshot /tmp/cookout-command-thread.png
agent-browser --session cookout open "http://127.0.0.1:3000/#/channels/deploys" && agent-browser --session cookout wait 'textarea[name=data]'
agent-browser --session cookout fill 'textarea[name=data]' '{"version":1}'
agent-browser --session cookout find role button click --name "Call" && agent-browser --session cookout wait '[role=alert]' && agent-browser --session cookout get text '[role=alert]'
agent-browser --session cookout screenshot --full /tmp/cookout-command-errors.png
agent-browser --session cookout fill 'textarea[name=data]' '{"version":"1.4.0"}'
agent-browser --session cookout find role button click --name "Call" && agent-browser --session cookout wait --text "0 replies" && agent-browser --session cookout snapshot
```

The thread shows `@ada`'s `/rollback` with `Call to /rollback` `{"version": "1.4.1"}` as its parent message, and the reply `@rollback` `Rolled back to 1.4.1.` with its `Data` `{"status": "done", "version": "1.4.1"}`. The bad call's alert is `Couldn't call /rollback (invalid_request): The data doesn't follow the schema of the command rollback.` with the row `data.version: must be string`. The good call ends the `Messages` list with `@grace` `/rollback`, `Call to /rollback` `{"version": "1.4.0"}` and `0 replies`. Data that isn't JSON is refused before it is sent: `Couldn't call /rollback (invalid_json): The data isn't JSON.`

## Run the web tests

The web tests (`app/modules/routes/tests/`, the `web` Vitest project) render `CookoutApp` in jsdom against one real `cookout serve` that `scripts/web-test-server.ts` starts for the run; run them alone with `node_modules/.bin/vitest run --project web`. jsdom keeps no cookies, so there the board sends the human's token itself.

The browser tests (`app/modules/routes/tests/browser/*.browser.test.ts`) are Playwright in headless Chromium: `playwright.config.ts`'s global setup (`scripts/browser-test-server.ts`) runs `app/dev.ts start` (a fresh `cookout serve` behind the Vite dev server) and hands the tests its web URL and admin token as `COOKOUT_URL` and `COOKOUT_TOKEN`. They log in through the form with the real session cookie. Install the browser once, then run them (`pnpm check` runs them as its `browser` job):

```sh
pnpm exec playwright install --only-shell chromium
pnpm -s browser
```

## Other checks

- `pnpm pack:smoke` proves the published package works (CI runs it as its own job): it builds with tsdown and Vite, packs `@ai-hero/cookout`, installs the tarball in a temp directory, and drives `cookout serve` (its health check and the web UI at `/`), `cookout whoami` and `@ai-hero/cookout/sdk` from there. Nothing is published.
- The SDK's public surface is pinned by `api/sdk.api.md`. After a deliberate change to it, run `pnpm api:write` and commit the report.
- To run the server alone on a file you keep: `node app/main.ts serve --port 3000 --db cookout.db`. On first boot it prints a one-time admin token as a JSON line.

## Deliver a call to the example handler

After "Start it", register a command whose URL is the example handler (`packages/handler-example`) on a free port, start the handler with the command's secret (the fourth line as a background command), and call it:

```sh
printf '{"type":"object","properties":{"branch":{"type":"string"}},"required":["branch"]}' > /tmp/cookout-ship.schema.json
env $(cat /tmp/cookout-dev.env) node app/main.ts command add ship --url http://127.0.0.1:48787/webhook --schema /tmp/cookout-ship.schema.json | jq -r '"COOKOUT_COMMAND_SECRET=\(.secret)"' > /tmp/cookout-ship.env
env $(cat /tmp/cookout-dev.env) node app/main.ts channel create ships
env $(cat /tmp/cookout-ship.env) HOST=127.0.0.1 PORT=48787 node packages/handler-example/app/main.ts > /tmp/cookout-handler.log 2>&1
env $(cat /tmp/cookout-dev.env) node app/main.ts command call ship --channel ships --data '{"branch":"main"}'
cat /tmp/cookout-handler.log
```

The call prints `{ messageId, threadId }` at once. In the background the server POSTs `{ command, data, threadId, token, callId }` to the URL, signed in the `cookout-signature` header with the lowercase hex HMAC-SHA256 of the raw body, keyed with the command's secret (the scheme in `packages/handler-example/README.md`). The handler logs `call call_… of ship on thread …` only for a signed call; a bad signature gets 401 and no line. With the handler stopped, a call still answers 202 and the dev log gets a `WARN` line `An attempt at the webhook delivery call_… failed.` per attempt. The server retries 5 times with the same `callId`, waiting `COOKOUT_WEBHOOK_RETRY_DELAY_SECONDS` (default 10) and then `COOKOUT_WEBHOOK_RETRY_FACTOR` (default 2.3) times longer each time, about 8 minutes in all; start it with `COOKOUT_WEBHOOK_RETRY_DELAY_SECONDS=1 COOKOUT_WEBHOOK_RETRY_FACTOR=1` to see it in seconds. After the last failure the `ship` handler identity replies in the call's thread `The delivery of /ship to its handler failed after 5 retries.` (`message thread <threadId>`). `COOKOUT_WEBHOOK_TIMEOUT_SECONDS` (default 5) bounds each attempt.

## Version a release with Changesets

Changesets sets the version and CHANGELOG.md of `@ai-hero/cookout`. The private packages are never versioned, and publishing is off until Matt's OK ([ADR 0031](adr/0031-changesets-version-the-package-and-publishing-stays-off.md)). Never run `pnpm release`, `changeset publish` or `npm publish`. To prove the setup without changing anything, add a sample changeset on a throwaway branch, check the plan, version it, then discard the branch:

```sh
git checkout -b changeset-dry-run
printf -- '---\n"@ai-hero/cookout": minor\n---\n\nA sample changeset for the dry run.\n' > .changeset/dry-run.md
pnpm changeset status --verbose
pnpm run version
cat CHANGELOG.md
git status --short
git checkout -- package.json
rm -f CHANGELOG.md .changeset/dry-run.md
git checkout -
git branch -D changeset-dry-run
```

`pnpm changeset status --verbose` lists only `@ai-hero/cookout -> 0.1.0`, from the dry-run changeset. `pnpm run version` consumes the changeset, bumps `package.json` to 0.1.0, and writes a CHANGELOG.md with a `## 0.1.0` section under `### Minor Changes`. `git status --short` shows only `package.json` and the new CHANGELOG.md, so `packages/e2e` and `packages/handler-example` stay at 0.0.0. With no changeset, `pnpm changeset status` exits 1 ("Some packages have been changed but no changesets were found"), which is expected during the v1 build.

The release workflow, `.github/workflows/release.yml`, passes `actionlint` (for example `docker run --rm -v "$PWD:/repo" --workdir /repo rhysd/actionlint:latest`). Its publish step is guarded by `if: false`.

## Reply as the handler with the command token

Each delivery's `token` is a command token: it posts as the command's handler identity (an agent named after the command), only replies in that call's thread, for 24 h after the call. After "Deliver a call to the example handler", point a command at any receiver that prints the body it gets, call it, and post with the token it was sent (`TOKEN` and `THREAD` from the printed body):

```sh
curl -s -X POST "$COOKOUT_URL/v1/messages" -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' -d "{\"channel\":\"ships\",\"replyTo\":$THREAD,\"text\":\"shipped main\"}"
curl -s -X POST "$COOKOUT_URL/v1/messages" -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"channel":"ships","text":"top-level"}'
curl -s "$COOKOUT_URL/v1/channels" -H "Authorization: Bearer $TOKEN"
env $(cat /tmp/cookout-dev.env) node app/main.ts inbox
```

The reply is 201 with `author.name` the command's name. The top-level message and every other route get 403 `outside_command_thread`, as does a reply in another thread or channel. The caller started the thread, so follows it: their inbox lists the reply with the reason `followed-thread`. After 24 h the token gets 401 `token_expired` (the SDK test `command-token.test.ts` moves the test clock to show it).
