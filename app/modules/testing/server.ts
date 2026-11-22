/**
 * The test composition root, importable only from tests. It builds the test
 * Layers (a cookout on port 0 with memory storage and test secrets, both
 * storage Layers on fresh stores, a store that is unusable) and runs the
 * `cookout` binary as a process. Tests run effects with `@effect/vitest`,
 * which provides `TestClock`: a test cookout starts at `testStartTime`.
 */
export { type CliResult, runCookout } from "./lib/server/process.ts";
export { freshDatabasePath, openStore, storageLayers } from "./lib/server/storage.ts";
export {
  TestCookout,
  type TestCookoutOptions,
  type TestCookoutService,
  testCookout,
  testStartTime,
} from "./lib/server/cookout.ts";
