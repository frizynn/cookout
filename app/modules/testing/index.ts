/**
 * What tests running in another process from the cookout need, with no test runner in it, so the browser tests
 * and `pnpm screenshots` can import it too. `moveClockForward({ clockUrl, days })` moves the dev program's
 * adjustable clock, at the `clockUrl` that `pnpm dev` prints, that many days forward, so a job waiting days
 * (the nudge job) runs as if they had passed. `serve` has no such clock. `hillsPng()` is a real 480 by 320
 * PNG, for a test or a screen that shows an image attachment.
 */
export { type ClockForward, moveClockForward } from "./lib/clock.ts";
export { hillsPng } from "./lib/hills.ts";
