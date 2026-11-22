import { testStorageAdapter } from "@ai-hero/cookout-storage-tests";
import { createMemoryStorage } from "../src/index.ts";

testStorageAdapter("memory", async () => createMemoryStorage());
