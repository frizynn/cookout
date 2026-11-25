/**
 * What tests running in another process from the cookout need, with no test runner in it, so the browser tests
 * and `pnpm screenshots` can import it too. `moveClockForward({ clockUrl, days })` moves the dev program's
 * adjustable clock, at the `clockUrl` that `pnpm dev` prints, that many days forward, so a job waiting days
 * (the nudge job) runs as if they had passed. `serve` has no such clock. `uniqueName({ name, run })` suffixes
 * `name` with one run of a test (`run` is its Playwright `TestInfo`), so the channels and identities a browser test
 * makes never clash with its own repeats under `--repeat-each` or its retries; the browser tests reach it as
 * `unique(name)` from their `names.ts`. `hillsPng()` is a real 480 by 320 PNG, for a test or a screen that shows
 * an image attachment.
 *
 * `createIdentityAsBefore({ admin, by, request })` and `createAgentForOwnerAsBefore` make an agent with no display
 * name, as one made before mattpocock/cookout#314 has none, so a web test shows it by its name alone: a new agent
 * needs one, so they create it named, then clear it as `admin`.
 */
export { type ClockForward, moveClockForward } from "./lib/clock.ts";
export { hillsPng } from "./lib/hills.ts";
export { type TestRun, uniqueName } from "./lib/unique-name.ts";
export { createAgentForOwnerAsBefore, createIdentityAsBefore } from "./lib/unnamed-agents.ts";
