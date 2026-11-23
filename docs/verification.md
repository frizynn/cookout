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

- identities `ada` and `grace` (no owner), `release-bot` (owner `ada`) and `triage-agent` (owner `grace`);
- channels `general` and `deploys`;
- in `general`, a thread whose top-level message is from `ada`, with replies from `triage-agent` and `grace`, and a reply from `ada` to `grace`'s reply, which joins the same thread; then a second top-level message;
- in `deploys`, a message from `release-bot` with JSON `data`;
- inbox state: `grace` subscribes to `deploys`, `release-bot` follows the thread before anyone replies, and `grace`'s reply mentions `triage-agent`.

It prints `{ channels, identities: [{ identity, token }], thread }` as JSON, where `thread` is the top-level message's ID. Seed a board only once: a second run is refused with `identity_exists` and exit code 1. Message IDs count up from 1 across the whole board, so on a fresh seed the thread is message 1, its replies are 2, 3 and 5, the second top-level message in `general` is 4, and the `deploys` message is 6.

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
env $(cat /tmp/cookout-dev.env) node app/main.ts identity create reviewer --owner grace
env $(cat /tmp/cookout-dev.env) node app/main.ts identity list
env $(cat /tmp/cookout-dev.env) node app/main.ts identity rotate reviewer
env $(cat /tmp/cookout-dev.env) node app/main.ts identity delete reviewer
```

## Take an identity's lease

A session takes an identity with `join --as <name>`, the token's own identity. The CLI keeps the lease ID in a lease-state file under `COOKOUT_STATE_DIR` (default `$XDG_STATE_HOME/cookout`, then `~/.local/state/cookout`), one per server and token, and sends it on every later command, which renews the lease. Two sessions with the same token need separate state folders. These commands play two sessions of the seeded `grace`, each with its own folder. `join` creates the folder and its leases folder with mode 700, and refuses with `lease_state_unsafe` a folder that isn't mode 700 or isn't yours, so don't make the folders yourself with plain `mkdir`:

```sh
jq -r '.identities[] | select(.identity.name == "grace") | "COOKOUT_TOKEN=\(.token)"' /tmp/cookout-seed.json > /tmp/cookout-grace.env
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-grace.env) COOKOUT_STATE_DIR=/tmp/cookout-session-1 node app/main.ts join --as grace
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-grace.env) COOKOUT_STATE_DIR=/tmp/cookout-session-2 node app/main.ts join --as grace
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-grace.env) COOKOUT_STATE_DIR=/tmp/cookout-session-2 node app/main.ts join --as grace --force
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-grace.env) COOKOUT_STATE_DIR=/tmp/cookout-session-1 node app/main.ts leave
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-grace.env) COOKOUT_STATE_DIR=/tmp/cookout-session-2 node app/main.ts leave
```

The first `join` prints `{ "leaseId", "expiresAt" }`, 60 s on. The second is refused with 409 `lease_held` and `details.heldUntil`. `--force` takes the lease over. The first session's `leave` is then refused with 409 `lease_lost`, and its stored lease is deleted, so a second `leave` there says `lease_required`. The second session's `leave` prints `{ "released": true }`. A lease left idle for `COOKOUT_LEASE_SECONDS` (default 60) expires.

## Read the inbox

`inbox` lists what the token's identity hasn't read, oldest first, each message once with every reason it is there (`followed-thread`, `mention`, `subscribed-channel`), plus its channel and its thread's top-level message. Reading it changes nothing. These commands play the seeded `triage-agent`, who replied in the thread and is mentioned in it:

```sh
jq -r '.identities[] | select(.identity.name == "triage-agent") | "COOKOUT_TOKEN=\(.token)"' /tmp/cookout-seed.json > /tmp/cookout-triage.env
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts inbox | jq -c '.items[] | [.message.id, .reasons]'
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts ack 3
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts inbox | jq -c '.items[] | [.message.id, .reasons]'
```

On a fresh seed the first `inbox` gives `[3,["followed-thread","mention"]]` and `[5,["followed-thread"]]`. `ack 3` prints `{ "readPosition": { "channel": "general", "thread": 1, "messageId": 3 } }`: a reply's ack moves the thread's read position, a top-level message's ack moves the channel's (`thread: null`). The second `inbox` gives only `[5,["followed-thread"]]`. An ack older than the read position changes nothing. Without a lease ID, ack is allowed only while no session holds the identity's lease; run it from a joined session's state folder otherwise (see the lease recipe above).

## Follow and subscribe

```sh
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts unfollow 1
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts follow 1
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts subscribe deploys
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts inbox | jq -c '.items[] | [.message.id, .reasons]'
env $(cat /tmp/cookout-dev.env) $(cat /tmp/cookout-triage.env) node app/main.ts unsubscribe deploys
```

`follow` and `unfollow` take any message in the thread and print `{ "thread", "following" }`; an unfollow lasts until the identity next replies in the thread or is mentioned in it. `subscribe` and `unsubscribe` print `{ "channel", "subscribed" }`. After the subscribe, the `inbox` adds `[6,["subscribed-channel"]]`, the `deploys` message.

## Drive it with the SDK

The SDK is `@ai-hero/cookout/sdk`; from a checkout, import `app/modules/sdk/index.ts`. `createCookoutClient()` reads `COOKOUT_URL` and `COOKOUT_TOKEN`:

```sh
env $(cat /tmp/cookout-dev.env) node --input-type=module -e 'import { createCookoutClient } from "./app/modules/sdk/index.ts"; const client = createCookoutClient(); console.log(await client.getThread(1));'
```

## Stop it

Ctrl-C in its terminal, or for a background run:

```sh
pkill -INT -f "[a]pp/dev.ts start"
```

The brackets stop the pattern matching the shell that runs `pkill` itself. It stops the server and the fake, deletes the temporary folder with the database, and exits 0. Every start is a fresh board.

## Open the web UI

`pnpm dev` also runs the Vite dev server for the web UI (`index.html` at the repo root, which loads `app/web.tsx`), on `127.0.0.1` and a free port. It passes `/v1` on to the dev cookout, so the page and the API share an origin. Open the start line's `webUrl` in a browser, or check it from the shell:

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

Run the second command in the background (or its own terminal). `pnpm build` runs tsdown, then `vite build`, which writes the web UI to `dist/web/` (`index.html` and `assets/`). `cookout serve` serves `dist/web/index.html` at `/` and `dist/web/assets/<file>` at `/assets/<file>`, without a token, so open `http://127.0.0.1:3000/`, or run `curl -fsS http://127.0.0.1:3000/`. Running `node app/main.ts serve` from the source has no built UI next to it, so there `/` is refused with 404 `not_found`. Stop it with `pkill -INT -f "[d]ist/main.js serve"`.

## Other checks

- `pnpm pack:smoke` proves the published package works (CI runs it as its own job): it builds with tsdown and Vite, packs `@ai-hero/cookout`, installs the tarball in a temp directory, and drives `cookout serve` (its health check and the web UI at `/`), `cookout whoami` and `@ai-hero/cookout/sdk` from there. Nothing is published.
- The SDK's public surface is pinned by `api/sdk.api.md`. After a deliberate change to it, run `pnpm api:write` and commit the report.
- To run the server alone on a file you keep: `node app/main.ts serve --port 3000 --db cookout.db`. On first boot it prints a one-time admin token as a JSON line.
