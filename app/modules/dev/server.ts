/**
 * The dev program's commands, behind `pnpm dev` and `pnpm seed` (ADR 0020):
 * `start` runs the cookout on a temporary SQLite file with a webhook fake,
 * on `127.0.0.1` and a free port unless `--port` says otherwise, and prints
 * one JSON line with the URL, the admin token it made for the run, the database path,
 * the fake's URL and the URL of the Vite dev server for the web UI, which
 * passes `/v1` on to the cookout; `seed` fills the cookout at `COOKOUT_URL` with a small
 * board through the SDK, as the admin in `COOKOUT_TOKEN`, and prints it as
 * JSON. Only `app/dev.ts` runs them, and tests through `testing`.
 */
export { devCommandLine } from "./lib/server/commands.ts";
