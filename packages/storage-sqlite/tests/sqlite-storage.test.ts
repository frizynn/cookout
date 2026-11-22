import { expect, it } from "vitest";
import { openSqliteStorage } from "../src/index.ts";
import { freshDatabasePath } from "./fresh-database.ts";

// Behaviour only a store on disk has. Everything shared is in the contract suite.

it("message IDs keep increasing after the database is reopened", async () => {
  const path = await freshDatabasePath();
  const first = openSqliteStorage({ path });
  await first.nextMessageId();
  const lastBeforeClose = await first.nextMessageId();
  await first.close();

  const second = openSqliteStorage({ path });
  try {
    expect(await second.nextMessageId()).toBeGreaterThan(lastBeforeClose);
  } finally {
    await second.close();
  }
});

it("an existing database opens again without losing its data", async () => {
  const path = await freshDatabasePath();
  for (let i = 0; i < 3; i++) {
    const storage = openSqliteStorage({ path });
    await storage.checkHealth();
    await storage.close();
  }
  const storage = openSqliteStorage({ path });
  try {
    expect(await storage.nextMessageId()).toBe(1);
  } finally {
    await storage.close();
  }
});
