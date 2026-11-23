/**
 * The cookout under test: a running server at `COOKOUT_E2E_URL`, driven as a
 * caller drives it, through `@ai-hero/cookout/sdk` and the built `cookout`
 * bin run as its own process, never through the app's `testing` module. Each
 * `cookoutUnderTest` Layer is one run: it draws a fresh prefix for the names
 * it makes and deletes the run's identities when it closes, passing or failing.
 * A `link` is a relay on 127.0.0.1 in front of any cookout URL, the deployed
 * one too, so a test can drop the connections of the `cookout` processes it
 * runs through it and refuse their reconnects with 502 for a while, and see
 * the status of every answer it relayed.
 * `browserFixtures` is a `cookout` fixture for Playwright's `test.extend`: one
 * run for each browser test, closed when it ends, and its page logged in by
 * token on request. `exampleCommand` is the command the example handler
 * (`packages/handler-example`) holds the secret of. A handler learns its
 * command's secret once, when the command is added, so the suite can't add a
 * fresh command per run and still have the handler sign its calls:
 * `pnpm e2e:docker` adds it on the local container before it starts the
 * handler there, and `scripts/handler-provision.sh` on the deployed one. Its
 * schema needs a string `branch`. `exampleCommandRegistered` says whether the
 * cookout under test has it, and logs a warning saying why the webhook tests
 * skip when it doesn't.
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
  calledThreadId,
  freshStateFolder,
  postedMessageId,
} from "./lib/server/bin.ts";
export { exampleCommand, exampleCommandRegistered } from "./lib/server/example-command.ts";
export { type BrowserFixtures, type BrowserRun, browserFixtures } from "./lib/server/browser-run.ts";
export { type Answered, type Link, link } from "./lib/server/link.ts";
