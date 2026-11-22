import { describe, expect, it, onTestFinished } from "vitest";
import type { StorageAdapter } from "@ai-hero/cookout-protocol";
import { messageIdSchema } from "@ai-hero/cookout-protocol";

/**
 * Opens a fresh, empty store. A test may call it more than once. The
 * adapter's own test file deletes whatever it made (files, databases) after
 * each test; the suite closes every store it opened.
 */
export type OpenFreshStorage = () => Promise<StorageAdapter>;

/**
 * The contract suite: every storage behaviour, run against one adapter. Call
 * it from the adapter package's tests. The test names are the same for every
 * adapter. Each ticket that adds an adapter operation adds its tests here.
 */
export function testStorageAdapter(adapterName: string, openFresh: OpenFreshStorage): void {
  async function open(): Promise<StorageAdapter> {
    const storage = await openFresh();
    onTestFinished(() => storage.close());
    return storage;
  }

  describe(`storage adapter contract (${adapterName})`, () => {
    describe("health", () => {
      it("an open store is healthy", async () => {
        const storage = await open();
        await expect(storage.checkHealth()).resolves.toBeUndefined();
      });

      it("a closed store is not healthy", async () => {
        const storage = await open();
        await storage.close();
        await expect(storage.checkHealth()).rejects.toThrow();
      });

      it("closing twice is fine", async () => {
        const storage = await open();
        await storage.close();
        await expect(storage.close()).resolves.toBeUndefined();
      });
    });

    describe("message IDs", () => {
      it("are positive whole numbers", async () => {
        const storage = await open();
        const id = await storage.nextMessageId();
        expect(messageIdSchema.safeParse(id).success).toBe(true);
      });

      it("increase with every call", async () => {
        const storage = await open();
        const ids: number[] = [];
        for (let i = 0; i < 5; i++) ids.push(await storage.nextMessageId());
        for (let i = 1; i < ids.length; i++) {
          expect(ids[i]).toBeGreaterThan(ids[i - 1] ?? Infinity);
        }
      });

      it("are distinct when many are taken at once", async () => {
        const storage = await open();
        const ids = await Promise.all(Array.from({ length: 20 }, () => storage.nextMessageId()));
        expect(new Set(ids).size).toBe(20);
      });

      it("cannot be taken from a closed store", async () => {
        const storage = await open();
        await storage.close();
        await expect(storage.nextMessageId()).rejects.toThrow();
      });
    });
  });
}
