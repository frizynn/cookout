/**
 * The test composition root, importable only from tests. It builds the test
 * Layers (a cookout on port 0 with memory storage and test secrets, its
 * first-boot admin and identities seeded through `Storage`, both storage
 * Layers on fresh stores, a store that is unusable). It runs `cookout`
 * command lines in the test's own process, `serve` included, with their
 * output captured, and runs the `cookout` binary as a process only where a
 * test is about the process itself, since each spawn costs a cold start.
 * Tests run effects with `@effect/vitest`, which provides `TestClock`: a
 * test cookout starts at `testStartTime`.
 */
export { answer, refusal } from "./lib/server/calls.ts";
export { type ChannelFixtureOptions, channelFixture, channelName } from "./lib/server/channels.ts";
export { type CliResult, runCookout, type ServeProcess, startServe } from "./lib/server/cli.ts";
export { runCookoutBinary } from "./lib/server/process.ts";
export { type IdentityFixtureOptions, identityFixture, identityName } from "./lib/server/identities.ts";
export { serverAnswering } from "./lib/server/fixed-answer.ts";
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
  testStartTime,
} from "./lib/server/cookout.ts";
