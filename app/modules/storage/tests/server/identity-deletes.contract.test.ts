import { Array as Arr, Effect, String as Str } from "effect";
import type { Storage, StorageUnavailable } from "../../../storage/server.ts";
import {
  appendTo,
  channelFixture as channel,
  channelName,
  identityFixture as identity,
  identityName as nameOf,
  newMessageFixture as newMessage,
  openStore,
  storageLayers,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { Message } from "../../../messages/index.ts";
import { tokenHash } from "../../../identities/index.ts";

const HASH_LENGTH = 64;
const hashA = tokenHash(Str.repeat(HASH_LENGTH)("a"));
const hashB = tokenHash(Str.repeat(HASH_LENGTH)("b"));
const hashC = tokenHash(Str.repeat(HASH_LENGTH)("c"));
const ANN = { author: { name: "ann" } } as const;
const BOB = { author: { name: "bob" } } as const;

interface BobsTraces {
  readonly mention: Message;
  readonly annReply: Message;
}

function leaveBobsTraces(storage: Storage["Service"]): Effect.Effect<BobsTraces, StorageUnavailable> {
  return Effect.gen(function* traces() {
    yield* storage.createChannel(channel("grill"));
    yield* storage.createIdentity(identity("ann"), hashA);
    yield* storage.createIdentity(identity("bob"), hashB);
    yield* storage.subscribeChannel(nameOf("bob"), channelName("grill"));
    const mention = yield* appendTo(storage)(newMessage("grill", "@bob look", { ...ANN, mentions: ["bob"] }));
    const annReply = yield* appendTo(storage)(newMessage("grill", "first", { ...ANN, replyTo: mention.id }));
    yield* appendTo(storage)(newMessage("grill", "on it", { ...BOB, replyTo: mention.id }));
    yield* appendTo(storage)(newMessage("grill", "mine", BOB));
    return { annReply, mention };
  });
}

it.effect.each(storageLayers)(
  "storage contract ($adapter): deleting an identity removes it and revokes its token",
  ({ layer }) =>
    Effect.gen(function* deleteIdentity() {
      const { storage } = yield* openStore(layer);
      yield* storage.createIdentity(identity("gone", { owner: "matt" }), hashA);
      yield* storage.createIdentity(identity("stays"), hashB);
      const deleted = yield* storage.deleteIdentity(nameOf("gone"));
      const identities = yield* storage.listIdentities();
      const oldHash = yield* storage.findIdentityByTokenHash(hashA);

      expect(deleted).toStrictEqual({ identity: identity("gone", { owner: "matt" }), status: "deleted" });
      expect(identities).toStrictEqual([identity("matt", { kind: "human" }), identity("stays")]);
      expect(oldHash).toStrictEqual({ status: "revoked" });
    }),
);

it.effect.each(storageLayers)("storage contract ($adapter): deleting a missing identity returns nothing", ({ layer }) =>
  Effect.gen(function* deleteMissing() {
    const { storage } = yield* openStore(layer);
    const deleted = yield* storage.deleteIdentity(nameOf("nobody"));

    expect(deleted).toStrictEqual({ status: "not_found" });
  }),
);

it.effect.each(storageLayers)("storage contract ($adapter): the last admin can't be deleted", ({ layer }) =>
  Effect.gen(function* lastAdmin() {
    const { storage } = yield* openStore(layer);
    yield* storage.createIdentity(identity("boss", { admin: true }), hashA);
    yield* storage.createIdentity(identity("agent"), hashB);
    const deleted = yield* storage.deleteIdentity(nameOf("boss"));
    const identities = yield* storage.listIdentities();
    const bossHash = yield* storage.findIdentityByTokenHash(hashA);

    expect(deleted).toStrictEqual({ status: "last_admin" });
    expect(identities).toStrictEqual([
      identity("agent"),
      identity("boss", { admin: true }),
      identity("matt", { kind: "human" }),
    ]);
    expect(bossHash).toStrictEqual({ identity: identity("boss", { admin: true }), status: "active" });
  }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): an admin can be deleted while another admin remains",
  ({ layer }) =>
    Effect.gen(function* deleteOneOfTwoAdmins() {
      const { storage } = yield* openStore(layer);
      yield* storage.createIdentity(identity("boss", { admin: true }), hashA);
      yield* storage.createIdentity(identity("boss-2", { admin: true }), hashB);
      const first = yield* storage.deleteIdentity(nameOf("boss"));
      const second = yield* storage.deleteIdentity(nameOf("boss-2"));

      expect(first).toMatchObject({ status: "deleted" });
      expect(second).toStrictEqual({ status: "last_admin" });
    }),
);

it.effect.each(storageLayers)("storage contract ($adapter): two admins deleted at once leave one admin", ({ layer }) =>
  Effect.gen(function* deleteTwoAdminsAtOnce() {
    const { storage } = yield* openStore(layer);
    yield* storage.createIdentity(identity("boss", { admin: true }), hashA);
    yield* storage.createIdentity(identity("boss-2", { admin: true }), hashB);
    const results = yield* Effect.all(
      [storage.deleteIdentity(nameOf("boss")), storage.deleteIdentity(nameOf("boss-2"))],
      {
        concurrency: "unbounded",
      },
    );
    const identities = yield* storage.listIdentities();
    const statuses = Arr.map(results, ({ status }) => status);

    expect(Arr.sort(statuses, Str.Order)).toStrictEqual(["deleted", "last_admin"]);
    expect(Arr.filter(identities, ({ admin }) => admin)).toMatchObject([{ admin: true }]);
  }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): a deleted name can be created again, and the old token stays revoked",
  ({ layer }) =>
    Effect.gen(function* createAgain() {
      const { storage } = yield* openStore(layer);
      yield* storage.createIdentity(identity("again"), hashA);
      yield* storage.deleteIdentity(nameOf("again"));
      const created = yield* storage.createIdentity(identity("again"), hashB);
      const oldHash = yield* storage.findIdentityByTokenHash(hashA);
      const newHash = yield* storage.findIdentityByTokenHash(hashB);

      expect(created).toBe("created");
      expect(oldHash).toStrictEqual({ status: "revoked" });
      expect(newHash).toStrictEqual({ identity: identity("again"), status: "active" });
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): a new identity with a deleted one's name inherits none of its mentions, follows, subscriptions or read positions",
  ({ layer }) =>
    Effect.gen(function* deletedLeavesNothing() {
      const { storage } = yield* openStore(layer);
      const { annReply, mention } = yield* leaveBobsTraces(storage);
      yield* storage.deleteIdentity(nameOf("bob"));
      yield* storage.createIdentity(identity("bob"), hashC);
      yield* appendTo(storage)(newMessage("grill", "second", { ...ANN, replyTo: mention.id }));
      yield* appendTo(storage)(newMessage("grill", "news", ANN));
      const inbox = yield* storage.listInbox(nameOf("bob"));
      const reads = yield* Effect.all(
        [storage.ackMessage(nameOf("bob"), mention.id), storage.ackMessage(nameOf("bob"), annReply.id)],
        { concurrency: 1 },
      );

      expect(inbox).toStrictEqual([]);
      expect(reads).toMatchObject([{ messageId: mention.id }, { messageId: annReply.id }]);
    }),
);
