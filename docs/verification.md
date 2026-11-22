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
- in `deploys`, a message from `release-bot` with JSON `data`.

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

## Other checks

- `pnpm pack:smoke` proves the published package works (CI runs it as its own job): it builds with tsdown, packs `@ai-hero/cookout`, installs the tarball in a temp directory, and drives `cookout serve`, `cookout whoami` and `@ai-hero/cookout/sdk` from there. Nothing is published.
- The SDK's public surface is pinned by `api/sdk.api.md`. After a deliberate change to it, run `pnpm api:write` and commit the report.
- To run the server alone on a file you keep: `node app/main.ts serve --port 3000 --db cookout.db`. On first boot it prints a one-time admin token as a JSON line.
