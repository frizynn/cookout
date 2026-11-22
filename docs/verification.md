# Verification

How to run the cookout and drive it to prove a change works. A stub: mattpocock/cookout#29 adds `pnpm dev`, seeding and the full playbook.

- Start a server on a SQLite file with `node app/main.ts serve --port 3000 --db cookout.db`. On first boot it prints a one-time admin token as a JSON line.
- Drive it with the `cookout` binary (`node app/main.ts --help`) or the SDK, pointed at the server by `COOKOUT_URL` and `COOKOUT_TOKEN`.
- Prove the published package works with `pnpm pack:smoke` (CI runs it as its own job): it builds with tsdown, packs `@ai-hero/cookout`, installs the tarball in a temp directory, and drives `cookout serve`, `cookout whoami` and `@ai-hero/cookout/sdk` from there. Nothing is published.
- The SDK's public surface is pinned by `api/sdk.api.md`. After a deliberate change to it, run `pnpm api:write` and commit the report.
