/**
 * The test composition root, importable only from tests. It builds the test
 * Layers (a cookout on port 0 with memory storage and test secrets, its
 * first-boot admin and identities seeded through `Storage`, both storage
 * Layers on fresh stores, a store that is unusable) and runs the `cookout`
 * binary as a process. Tests run effects with `@effect/vitest`, which
 * provides `TestClock`: a test cookout starts at `testStartTime`.
 */
export { type ChannelFixtureOptions, channelFixture, channelName } from "./lib/server/channels.ts";
export { type CliResult, runCookout, type ServeProcess, startServe } from "./lib/server/process.ts";
export { type IdentityFixtureOptions, identityFixture, identityName } from "./lib/server/identities.ts";
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
