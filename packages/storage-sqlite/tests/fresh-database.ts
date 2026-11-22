import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { onTestFinished } from "vitest";

/** A path for a new database file, in a folder deleted when the test ends. */
export async function freshDatabasePath(): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), "cookout-sqlite-"));
  onTestFinished(() => rm(folder, { recursive: true, force: true }));
  return join(folder, "cookout.db");
}
