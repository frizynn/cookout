import { testStorageAdapter } from "@ai-hero/cookout-storage-tests";
import { openSqliteStorage } from "../src/index.ts";
import { freshDatabasePath } from "./fresh-database.ts";

testStorageAdapter("sqlite", async () => openSqliteStorage({ path: await freshDatabasePath() }));
