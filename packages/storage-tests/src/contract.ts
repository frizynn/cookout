import { describe, expect, it, onTestFinished } from "vitest";
import type { Channel, Identity, Message, NewMessage, StorageAdapter } from "@ai-hero/cookout-protocol";
import { messageIdSchema } from "@ai-hero/cookout-protocol";

function identity(name: string, extra: Partial<Identity> = {}): Identity {
  return { name, admin: false, createdAt: "2026-01-01T00:00:00.000Z", ...extra };
}

function channel(name: string, extra: Partial<Channel> = {}): Channel {
  return { name, createdAt: "2026-01-01T00:00:00.000Z", ...extra };
}

function newMessage(channelName: string, text: string, extra: Partial<NewMessage> = {}): NewMessage {
  return {
    channel: channelName,
    author: { name: "agent", owner: "matt" },
    text,
    mentions: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...extra,
  };
}

/** Appends and returns the stored message, failing the test if it was refused. */
async function append(storage: StorageAdapter, message: NewMessage): Promise<Message> {
  const result = await storage.appendMessage(message);
  if (result.status !== "appended") throw new Error(`appendMessage refused: ${result.status}`);
  return result.message;
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
        expect(await storage.deleteIdentity("gone")).toEqual({
          status: "deleted",
          identity: identity("gone", { owner: "matt" }),
        });
        expect(await storage.listIdentities()).toEqual([identity("stays")]);
        expect(await storage.findIdentityByTokenHash(hashA)).toEqual({ status: "revoked" });
      });

      it("deleting a missing identity returns nothing", async () => {
        const storage = await open();
        expect(await storage.deleteIdentity("nobody")).toEqual({ status: "not_found" });
      });

      it("the last admin can't be deleted", async () => {
        const storage = await open();
        await storage.createIdentity(identity("boss", { admin: true }), hashA);
        await storage.createIdentity(identity("agent"), hashB);
        expect(await storage.deleteIdentity("boss")).toEqual({ status: "last_admin" });
        expect(await storage.listIdentities()).toEqual([identity("agent"), identity("boss", { admin: true })]);
        expect(await storage.findIdentityByTokenHash(hashA)).toEqual({
          status: "active",
          identity: identity("boss", { admin: true }),
        });
      });

      it("an admin can be deleted while another admin remains", async () => {
        const storage = await open();
        await storage.createIdentity(identity("boss", { admin: true }), hashA);
        await storage.createIdentity(identity("boss-2", { admin: true }), hashB);
        expect(await storage.deleteIdentity("boss")).toMatchObject({ status: "deleted" });
        expect(await storage.deleteIdentity("boss-2")).toEqual({ status: "last_admin" });
      });

      it("two admins deleted at once leave one admin", async () => {
        const storage = await open();
        await storage.createIdentity(identity("boss", { admin: true }), hashA);
        await storage.createIdentity(identity("boss-2", { admin: true }), hashB);
        const results = await Promise.all([storage.deleteIdentity("boss"), storage.deleteIdentity("boss-2")]);
        expect(results.map((result) => result.status).sort()).toEqual(["deleted", "last_admin"]);
        expect((await storage.listIdentities()).filter((found) => found.admin)).toHaveLength(1);
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

    describe("channels", () => {
      it("a new store has no channels", async () => {
        const storage = await open();
        expect(await storage.listChannels()).toEqual([]);
      });

      it("a channel is created with or without a description and listed by name", async () => {
        const storage = await open();
        expect(await storage.createChannel(channel("zed", { description: "Last" }))).toBe("created");
        expect(await storage.createChannel(channel("alpha"))).toBe("created");
        expect(await storage.listChannels()).toEqual([channel("alpha"), channel("zed", { description: "Last" })]);
      });

      it("a channel name can be used only once", async () => {
        const storage = await open();
        await storage.createChannel(channel("grill", { description: "first" }));
        expect(await storage.createChannel(channel("grill"))).toBe("name_taken");
        expect(await storage.listChannels()).toEqual([channel("grill", { description: "first" })]);
      });

      it("a channel is found by name", async () => {
        const storage = await open();
        await storage.createChannel(channel("grill", { description: "d" }));
        expect(await storage.findChannel("grill")).toEqual(channel("grill", { description: "d" }));
        expect(await storage.findChannel("nowhere")).toBeUndefined();
      });
    });

    describe("messages and threads", () => {
      it("a top-level message is stored with its fields and no replies", async () => {
        const storage = await open();
        await storage.createChannel(channel("grill"));
        const message = await append(storage, newMessage("grill", "hi", { data: { a: [1, null, "x"], b: true } }));
        expect(message).toEqual({
          id: expect.any(Number),
          channel: "grill",
          author: { name: "agent", owner: "matt" },
          text: "hi",
          data: { a: [1, null, "x"], b: true },
          mentions: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          replyCount: 0,
          latestReplyId: null,
        });
        expect(await storage.getThread(message.id)).toEqual({ parent: message, replies: [] });
      });

      it("an author with no owner and a message with no data keep those fields absent", async () => {
        const storage = await open();
        await storage.createChannel(channel("grill"));
        const message = await append(storage, newMessage("grill", "hi", { author: { name: "bot" } }));
        expect(message.author).toEqual({ name: "bot" });
        expect("data" in message).toBe(false);
        expect((await storage.getThread(message.id))?.parent).toEqual(message);
      });

      it("JSON data that is a plain string, number or null is kept as it is", async () => {
        const storage = await open();
        await storage.createChannel(channel("grill"));
        for (const data of ["text", 0, null, []]) {
          const message = await append(storage, newMessage("grill", "hi", { data }));
          expect((await storage.getThread(message.id))?.parent.data).toEqual(data);
        }
      });

      it("message IDs strictly increase across channels and with nextMessageId", async () => {
        const storage = await open();
        await storage.createChannel(channel("one"));
        await storage.createChannel(channel("two"));
        const ids = [
          (await append(storage, newMessage("one", "a"))).id,
          (await append(storage, newMessage("two", "b"))).id,
          await storage.nextMessageId(),
          (await append(storage, newMessage("one", "c"))).id,
          (await append(storage, newMessage("two", "d"))).id,
        ];
        for (let i = 1; i < ids.length; i++) expect(ids[i]).toBeGreaterThan(ids[i - 1] ?? Infinity);
      });

      it("message IDs are distinct when many are appended at once", async () => {
        const storage = await open();
        await storage.createChannel(channel("one"));
        await storage.createChannel(channel("two"));
        const messages = await Promise.all(
          Array.from({ length: 20 }, (_, i) => append(storage, newMessage(i % 2 === 0 ? "one" : "two", `m${i}`))),
        );
        expect(new Set(messages.map((message) => message.id)).size).toBe(20);
      });

      it("a reply is stored in its parent's thread and counted on the parent", async () => {
        const storage = await open();
        await storage.createChannel(channel("grill"));
        const parent = await append(storage, newMessage("grill", "parent"));
        const first = await append(storage, newMessage("grill", "first", { replyTo: parent.id }));
        const second = await append(storage, newMessage("grill", "second", { replyTo: parent.id }));
        expect(first).toEqual({ ...newMessage("grill", "first"), id: first.id, replyTo: parent.id });
        expect(await storage.getThread(parent.id)).toEqual({
          parent: { ...parent, replyCount: 2, latestReplyId: second.id },
          replies: [first, second],
        });
      });

      it("a reply to a reply is stored on the top-level message's thread", async () => {
        const storage = await open();
        await storage.createChannel(channel("grill"));
        const parent = await append(storage, newMessage("grill", "parent"));
        const reply = await append(storage, newMessage("grill", "reply", { replyTo: parent.id }));
        const nested = await append(storage, newMessage("grill", "nested", { replyTo: reply.id }));
        expect(nested).toMatchObject({ replyTo: parent.id });
        expect((await storage.getThread(parent.id))?.replies.map((message) => message.text)).toEqual(["reply", "nested"]);
      });

      it("a thread is found from any message in it", async () => {
        const storage = await open();
        await storage.createChannel(channel("grill"));
        const parent = await append(storage, newMessage("grill", "parent"));
        const reply = await append(storage, newMessage("grill", "reply", { replyTo: parent.id }));
        expect(await storage.getThread(reply.id)).toEqual(await storage.getThread(parent.id));
        expect(await storage.getThread(999_999)).toBeUndefined();
      });

      it("appending to a missing channel is refused and takes nothing", async () => {
        const storage = await open();
        expect(await storage.appendMessage(newMessage("nowhere", "hi"))).toEqual({ status: "channel_not_found" });
        expect(await storage.listChannels()).toEqual([]);
      });

      it("replying to a missing message is refused and stores nothing", async () => {
        const storage = await open();
        await storage.createChannel(channel("grill"));
        expect(await storage.appendMessage(newMessage("grill", "hi", { replyTo: 999_999 }))).toEqual({
          status: "reply_to_not_found",
        });
        expect(await storage.listChannelMessages("grill", { limit: 10 })).toEqual({ messages: [], hasMore: false });
      });

      it("replying to a message in another channel is refused and stores nothing", async () => {
        const storage = await open();
        await storage.createChannel(channel("one"));
        await storage.createChannel(channel("two"));
        const parent = await append(storage, newMessage("one", "parent"));
        expect(await storage.appendMessage(newMessage("two", "hi", { replyTo: parent.id }))).toEqual({
          status: "reply_in_other_channel",
        });
        expect((await storage.getThread(parent.id))?.replies).toEqual([]);
      });

      it("a channel page is its newest top-level messages, oldest first, with reply counts", async () => {
        const storage = await open();
        await storage.createChannel(channel("grill"));
        await storage.createChannel(channel("other"));
        const a = await append(storage, newMessage("grill", "a"));
        const reply = await append(storage, newMessage("grill", "reply", { replyTo: a.id }));
        await append(storage, newMessage("other", "elsewhere"));
        const b = await append(storage, newMessage("grill", "b"));
        expect(await storage.listChannelMessages("grill", { limit: 10 })).toEqual({
          messages: [{ ...a, replyCount: 1, latestReplyId: reply.id }, b],
          hasMore: false,
        });
      });

      it("a channel page goes back from a message ID", async () => {
        const storage = await open();
        await storage.createChannel(channel("grill"));
        const ids: number[] = [];
        for (let i = 0; i < 5; i++) ids.push((await append(storage, newMessage("grill", `m${i}`))).id);
        const texts = async (options: { before?: number; limit: number }) => {
          const page = await storage.listChannelMessages("grill", options);
          return { texts: page?.messages.map((message) => message.text), hasMore: page?.hasMore };
        };
        expect(await texts({ limit: 2 })).toEqual({ texts: ["m3", "m4"], hasMore: true });
        expect(await texts({ before: ids[3] ?? 0, limit: 2 })).toEqual({ texts: ["m1", "m2"], hasMore: true });
        expect(await texts({ before: ids[1] ?? 0, limit: 2 })).toEqual({ texts: ["m0"], hasMore: false });
        expect(await texts({ before: ids[2] ?? 0, limit: 2 })).toEqual({ texts: ["m0", "m1"], hasMore: false });
      });

      it("the page of a missing channel is undefined", async () => {
        const storage = await open();
        expect(await storage.listChannelMessages("nowhere", { limit: 10 })).toBeUndefined();
      });

      it("messages cannot be used in a closed store", async () => {
        const storage = await open();
        await storage.createChannel(channel("grill"));
        await storage.close();
        await expect(storage.appendMessage(newMessage("grill", "hi"))).rejects.toThrow();
        await expect(storage.listChannelMessages("grill", { limit: 10 })).rejects.toThrow();
        await expect(storage.getThread(1)).rejects.toThrow();
        await expect(storage.listChannels()).rejects.toThrow();
      });
    });

    describe("identity leases", () => {
      const t0 = "2026-01-01T00:00:00.000Z";
      const t30 = "2026-01-01T00:00:30.000Z";
      const t60 = "2026-01-01T00:01:00.000Z";
      const t90 = "2026-01-01T00:01:30.000Z";
      const leaseOne = "lease-one-0123456789";
      const leaseTwo = "lease-two-0123456789";

      async function withIdentity(): Promise<StorageAdapter> {
        const storage = await open();
        await storage.createIdentity(identity("agent"), hashA);
        await storage.createIdentity(identity("other"), hashB);
        return storage;
      }

      const take = (storage: StorageAdapter, leaseId: string, now: string, expiresAt: string, force = false) =>
        storage.takeLease({ identity: "agent", leaseId, now, expiresAt, force });

      it("an identity nobody holds can be leased, and the lease is found until it ends", async () => {
        const storage = await withIdentity();
        expect(await storage.findLease("agent", t0)).toBeUndefined();
        expect(await take(storage, leaseOne, t0, t60)).toEqual({
          status: "taken",
          lease: { identity: "agent", leaseId: leaseOne, expiresAt: t60 },
        });
        expect(await storage.findLease("agent", t30)).toEqual({ identity: "agent", leaseId: leaseOne, expiresAt: t60 });
        expect(await storage.findLease("agent", t60)).toBeUndefined();
        expect(await storage.findLease("other", t30)).toBeUndefined();
      });

      it("a live lease refuses a second take and says until when", async () => {
        const storage = await withIdentity();
        await take(storage, leaseOne, t0, t60);
        expect(await take(storage, leaseTwo, t30, t90)).toEqual({ status: "held", heldUntil: t60 });
        expect(await storage.findLease("agent", t30)).toMatchObject({ leaseId: leaseOne });
      });

      it("an ended lease can be taken again", async () => {
        const storage = await withIdentity();
        await take(storage, leaseOne, t0, t60);
        expect(await take(storage, leaseTwo, t60, t90)).toMatchObject({ status: "taken" });
        expect(await storage.findLease("agent", t60)).toMatchObject({ leaseId: leaseTwo });
      });

      it("a forced take replaces a live lease, and the old lease ID stops working", async () => {
        const storage = await withIdentity();
        await take(storage, leaseOne, t0, t60);
        expect(await take(storage, leaseTwo, t30, t90, true)).toMatchObject({ status: "taken" });
        expect(await storage.renewLease({ identity: "agent", leaseId: leaseOne, now: t30, expiresAt: t90 })).toEqual({
          status: "lost",
          heldUntil: t90,
        });
        expect(await storage.releaseLease({ identity: "agent", leaseId: leaseOne, now: t30 })).toEqual({
          status: "lost",
          heldUntil: t90,
        });
        expect(await storage.findLease("agent", t30)).toMatchObject({ leaseId: leaseTwo });
      });

      it("renewing the live lease moves its end", async () => {
        const storage = await withIdentity();
        await take(storage, leaseOne, t0, t60);
        expect(await storage.renewLease({ identity: "agent", leaseId: leaseOne, now: t30, expiresAt: t90 })).toEqual({
          status: "renewed",
          lease: { identity: "agent", leaseId: leaseOne, expiresAt: t90 },
        });
        expect(await storage.findLease("agent", t60)).toMatchObject({ leaseId: leaseOne, expiresAt: t90 });
      });

      it("an ended lease cannot be renewed", async () => {
        const storage = await withIdentity();
        await take(storage, leaseOne, t0, t30);
        expect(await storage.renewLease({ identity: "agent", leaseId: leaseOne, now: t30, expiresAt: t90 })).toEqual({
          status: "lost",
          heldUntil: null,
        });
        expect(await storage.findLease("agent", t30)).toBeUndefined();
      });

      it("a lease ID only works for its own identity", async () => {
        const storage = await withIdentity();
        await take(storage, leaseOne, t0, t60);
        expect(await storage.renewLease({ identity: "other", leaseId: leaseOne, now: t30, expiresAt: t90 })).toEqual({
          status: "lost",
          heldUntil: null,
        });
        expect(await storage.releaseLease({ identity: "other", leaseId: leaseOne, now: t30 })).toEqual({
          status: "lost",
          heldUntil: null,
        });
        expect(await storage.findLease("agent", t30)).toMatchObject({ leaseId: leaseOne });
      });

      it("releasing the live lease lets the next take succeed at once", async () => {
        const storage = await withIdentity();
        await take(storage, leaseOne, t0, t60);
        expect(await storage.releaseLease({ identity: "agent", leaseId: leaseOne, now: t30 })).toEqual({ status: "released" });
        expect(await storage.findLease("agent", t30)).toBeUndefined();
        expect(await storage.releaseLease({ identity: "agent", leaseId: leaseOne, now: t30 })).toEqual({
          status: "lost",
          heldUntil: null,
        });
        expect(await take(storage, leaseTwo, t30, t90)).toMatchObject({ status: "taken" });
      });

      it("deleting an identity drops its lease", async () => {
        const storage = await withIdentity();
        await take(storage, leaseOne, t0, t60);
        await storage.deleteIdentity("agent");
        expect(await storage.findLease("agent", t30)).toBeUndefined();
      });

      it("leases cannot be used in a closed store", async () => {
        const storage = await withIdentity();
        await storage.close();
        await expect(take(storage, leaseOne, t0, t60)).rejects.toThrow();
        await expect(storage.findLease("agent", t0)).rejects.toThrow();
        await expect(storage.renewLease({ identity: "agent", leaseId: leaseOne, now: t0, expiresAt: t60 })).rejects.toThrow();
        await expect(storage.releaseLease({ identity: "agent", leaseId: leaseOne, now: t0 })).rejects.toThrow();
      });
    });
  });
}
