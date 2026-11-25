/**
 * What tests running in another process from the cookout need, with no test runner in it, so the browser tests
 * and `pnpm screenshots` can import it too. `moveClockForward({ clockUrl, days })` moves the dev program's
 * adjustable clock, at the `clockUrl` that `pnpm dev` prints, that many days forward, so a job waiting days
 * (the nudge job) runs as if they had passed. `serve` has no such clock.
 *
 * `createIdentityAsBefore({ admin, by, request })` and `createAgentForOwnerAsBefore` make an agent with no display
 * name, as one made before mattpocock/cookout#314 has none, so a web test shows it by its name alone: a new agent
 * needs one, so they create it named, then clear it as `admin`.
 */
export { type ClockForward, moveClockForward } from "./lib/clock.ts";
export { createAgentForOwnerAsBefore, createIdentityAsBefore } from "./lib/unnamed-agents.ts";
