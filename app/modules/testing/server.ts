/**
 * The test composition root, importable only from tests. `runDev` and
 * `startDev` run the dev program's commands (ADR 0020) in process. It builds the test
 * Layers (a cookout on port 0 with memory storage and test secrets, its
 * first-boot admin and identities seeded through `Storage`, both storage
 * Layers on fresh stores, a store that is unusable). It runs `cookout`
 * command lines in the test's own process, `serve` included, with their
 * output captured, and runs the `cookout` binary as a process only where a
 * test is about the process itself, since each spawn costs a cold start.
 * Tests run effects with `@effect/vitest`, which provides `TestClock`: a
 * test cookout starts at `testStartTime`, and a lease's expiry moves with it.
 * `twoSessions` gives an identity two separate SDK sessions, and
 * `freshStateFolder`, `leaseStateFiles` and `writeLeaseStates` make and
 * read a CLI session's lease-state folder. `builtWebFolder` stands in for
 * the Vite build that `cookout serve` serves at `/`.
 */
export { answer, refusal } from "./lib/server/calls.ts";
export { type ChannelFixtureOptions, channelFixture, channelName } from "./lib/server/channels.ts";
export { type CommandFixtureOptions, commandFixture, commandName, handlerFixture } from "./lib/server/commands.ts";
export {
  type CliResult,
  type CommandLineNeeds,
  type DevProcess,
  commandLineServices,
  runCookout,
  runDev,
  type ServeProcess,
  type ServeWithWeb,
  startDev,
  startServe,
  startServeWithWeb,
} from "./lib/server/cli.ts";
export { type InterruptedDev, interruptDevBinary, runCookoutBinary } from "./lib/server/process.ts";
export { type IdentityFixtureOptions, identityFixture, identityName } from "./lib/server/identities.ts";
export { type FixedAnswer, serverAnswering } from "./lib/server/fixed-answer.ts";
export {
  type TwoSessions,
  freshStateFolder,
  leaseStateFiles,
  twoSessions,
  writeLeaseStates,
} from "./lib/server/leases.ts";
export { leaseId, secretsTest } from "./lib/server/secrets.ts";
export { type NewMessageOptions, appendTo, messageId, newMessageFixture } from "./lib/server/messages.ts";
export { freshDatabasePath, openStore, storageLayers } from "./lib/server/storage.ts";
export {
  type BootedServer,
  type CreateTestIdentityOptions,
  TestCookout,
  type TestCookoutOptions,
  type TestCookoutService,
  type TestIdentity,
  testCookout,
} from "./lib/server/cookout.ts";
export { isoTime, testStartTime } from "./lib/server/time.ts";
export { type BuiltWeb, builtWebFolder } from "./lib/server/web.ts";
