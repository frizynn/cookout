# Verification

How to run the cookout and drive it to prove a change works. A stub: mattpocock/cookout#29 adds `pnpm dev`, seeding and the full playbook.

- Start a server on a SQLite file with `node app/main.ts serve --port 3000 --db cookout.db`. On first boot it prints a one-time admin token as a JSON line.
- Drive it with the `cookout` binary (`node app/main.ts --help`) or the SDK, pointed at the server by `COOKOUT_URL` and `COOKOUT_TOKEN`.
