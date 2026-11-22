import { describe, expect, it, onTestFinished } from "vitest";
import type { Identity, StorageAdapter } from "@ai-hero/cookout-protocol";
import { messageIdSchema } from "@ai-hero/cookout-protocol";

function identity(name: string, extra: Partial<Identity> = {}): Identity {
  return { name, admin: false, createdAt: "2026-01-01T00:00:00.000Z", ...extra };
}

/** Stand-ins for token hashes. The store treats them as opaque strings. */
const hashA = "a".repeat(64);
const hashB = "b".repeat(64);
const hashC = "c".repeat(64);

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

    describe("identities and token hashes", () => {
      it("a new store has no identities", async () => {
        const storage = await open();
        expect(await storage.listIdentities()).toEqual([]);
      });

      it("an identity is created with or without an owner and listed by name", async () => {
        const storage = await open();
        expect(await storage.createIdentity(identity("zed", { owner: "matt" }), hashA)).toBe("created");
        expect(await storage.createIdentity(identity("auth-griller"), hashB)).toBe("created");
        expect(await storage.listIdentities()).toEqual([identity("auth-griller"), identity("zed", { owner: "matt" })]);
      });

      it("the admin flag is kept", async () => {
        const storage = await open();
        await storage.createIdentity(identity("boss", { admin: true }), hashA);
        expect(await storage.listIdentities()).toEqual([identity("boss", { admin: true })]);
      });

      it("a name can be used only once", async () => {
        const storage = await open();
        await storage.createIdentity(identity("dup", { owner: "matt" }), hashA);
        expect(await storage.createIdentity(identity("dup"), hashB)).toBe("name_taken");
        expect(await storage.listIdentities()).toEqual([identity("dup", { owner: "matt" })]);
        expect(await storage.findIdentityByTokenHash(hashB)).toEqual({ status: "unknown" });
      });

      it("a token hash finds its identity", async () => {
        const storage = await open();
        await storage.createIdentity(identity("one", { owner: "matt" }), hashA);
        await storage.createIdentity(identity("two"), hashB);
        expect(await storage.findIdentityByTokenHash(hashA)).toEqual({
          status: "active",
          identity: identity("one", { owner: "matt" }),
        });
        expect(await storage.findIdentityByTokenHash(hashB)).toEqual({ status: "active", identity: identity("two") });
      });

      it("a token hash that was never stored is unknown", async () => {
        const storage = await open();
        await storage.createIdentity(identity("one"), hashA);
        expect(await storage.findIdentityByTokenHash(hashC)).toEqual({ status: "unknown" });
      });

      it("replacing a token revokes the old hash at once", async () => {
        const storage = await open();
        await storage.createIdentity(identity("one"), hashA);
        expect(await storage.replaceToken("one", hashB)).toEqual(identity("one"));
        expect(await storage.findIdentityByTokenHash(hashA)).toEqual({ status: "revoked" });
        expect(await storage.findIdentityByTokenHash(hashB)).toEqual({ status: "active", identity: identity("one") });
      });

      it("replacing the token of a missing identity changes nothing", async () => {
        const storage = await open();
        expect(await storage.replaceToken("nobody", hashA)).toBeUndefined();
        expect(await storage.findIdentityByTokenHash(hashA)).toEqual({ status: "unknown" });
      });

      it("deleting an identity removes it and revokes its token", async () => {
        const storage = await open();
        await storage.createIdentity(identity("gone", { owner: "matt" }), hashA);
        await storage.createIdentity(identity("stays"), hashB);
        expect(await storage.deleteIdentity("gone")).toEqual(identity("gone", { owner: "matt" }));
        expect(await storage.listIdentities()).toEqual([identity("stays")]);
        expect(await storage.findIdentityByTokenHash(hashA)).toEqual({ status: "revoked" });
      });

      it("deleting a missing identity returns nothing", async () => {
        const storage = await open();
        expect(await storage.deleteIdentity("nobody")).toBeUndefined();
      });

      it("a deleted name can be created again, and the old token stays revoked", async () => {
        const storage = await open();
        await storage.createIdentity(identity("again"), hashA);
        await storage.deleteIdentity("again");
        expect(await storage.createIdentity(identity("again"), hashB)).toBe("created");
        expect(await storage.findIdentityByTokenHash(hashA)).toEqual({ status: "revoked" });
        expect(await storage.findIdentityByTokenHash(hashB)).toEqual({ status: "active", identity: identity("again") });
      });

      it("the first identity is created only when there are none", async () => {
        const storage = await open();
        expect(await storage.createIdentityIfNoneExist(identity("admin", { admin: true }), hashA)).toBe(true);
        expect(await storage.createIdentityIfNoneExist(identity("admin-2", { admin: true }), hashB)).toBe(false);
        expect(await storage.listIdentities()).toEqual([identity("admin", { admin: true })]);
        expect(await storage.findIdentityByTokenHash(hashB)).toEqual({ status: "unknown" });
      });

      it("only one first identity is created when asked many times at once", async () => {
        const storage = await open();
        const results = await Promise.all(
          Array.from({ length: 10 }, (_, i) =>
            storage.createIdentityIfNoneExist(identity(`admin-${i}`), String(i).repeat(64)),
          ),
        );
        expect(results.filter(Boolean)).toHaveLength(1);
        expect(await storage.listIdentities()).toHaveLength(1);
      });

      it("identities cannot be used in a closed store", async () => {
        const storage = await open();
        await storage.close();
        await expect(storage.listIdentities()).rejects.toThrow();
        await expect(storage.createIdentity(identity("late"), hashA)).rejects.toThrow();
        await expect(storage.findIdentityByTokenHash(hashA)).rejects.toThrow();
      });
    });
  });
}
