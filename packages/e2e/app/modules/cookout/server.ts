/**
 * The cookout under test: a running server at `COOKOUT_E2E_URL`, driven as a
 * caller drives it, through `@ai-hero/cookout/sdk` and the built `cookout`
 * bin run as its own process, never through the app's `testing` module. Each
 * `cookoutUnderTest` Layer is one run: it draws a fresh prefix for the names
 * it makes and deletes the run's identities when it closes, passing or failing.
 * A `link` is a relay on 127.0.0.1 in front of any cookout URL, the deployed
 * one too, so a test can drop the connections of the `cookout` processes it
 * runs through it and refuse their reconnects with 502 for a while.
 * `browserFixtures` is a `cookout` fixture for Playwright's `test.extend`: one
 * run for each browser test, closed when it ends, and its page logged in by
 * token on request.
 */
export {
  CookoutUnderTest,
  type CookoutUnderTestService,
  cookoutUnderTest,
} from "./lib/server/cookout-under-test.ts";
export {
  type BinNeeds,
  type BinResult,
  type BinRun,
  freshStateFolder,
  postedMessageId,
} from "./lib/server/bin.ts";
export { type BrowserFixtures, type BrowserRun, browserFixtures } from "./lib/server/browser-run.ts";
export { type Link, link } from "./lib/server/link.ts";
