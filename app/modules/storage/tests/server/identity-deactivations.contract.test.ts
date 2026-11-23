import { Array as Arr, Effect, String as Str } from "effect";
import {
  appendTo,
  channelFixture as channel,
  identityFixture as identity,
  identityName as nameOf,
  newMessageFixture as newMessage,
  openStore,
  storageLayers,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { tokenHash } from "../../../identities/index.ts";

const HASH_LENGTH = 64;
const hashA = tokenHash(Str.repeat(HASH_LENGTH)("a"));
const hashB = tokenHash(Str.repeat(HASH_LENGTH)("b"));
const hashC = tokenHash(Str.repeat(HASH_LENGTH)("c"));
const hashD = tokenHash(Str.repeat(HASH_LENGTH)("d"));
const ONE_AT_A_TIME = { concurrency: 1 } as const;
const MATT = identity("matt", { kind: "human" });
const GONE = { ...identity("gone"), deactivated: true } as const;

it.effect.each(storageLayers)(
  "storage contract ($adapter): deactivating an identity keeps it, marked, and revokes its token",
  ({ layer }) =>
    Effect.gen(function* deactivate() {
      const { storage } = yield* openStore(layer);
      yield* storage.createIdentity(identity("gone"), hashA);
      const deactivated = yield* storage.deactivateIdentity(nameOf("gone"));
      const found = yield* storage.findIdentityByName(nameOf("gone"));
      const listed = yield* storage.listIdentities();
      const afterwards = yield* Effect.all(
        [storage.findIdentityByTokenHash(hashA), storage.createIdentity(identity("gone"), hashB)],
        ONE_AT_A_TIME,
      );

      expect(deactivated).toStrictEqual({ agents: [], identity: GONE, status: "deactivated" });
      expect([found, listed]).toStrictEqual([GONE, [GONE, MATT]]);
      expect(afterwards).toStrictEqual([{ status: "revoked" }, "name_taken"]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): deactivating a human deactivates the agents they own, and keeps them",
  ({ layer }) =>
    Effect.gen(function* cascade() {
      const { storage } = yield* openStore(layer);
      yield* Effect.forEach(
        [
          [identity("grace", { kind: "human" }), hashA],
          [identity("release-bot"), hashB],
          [identity("matt/helper"), hashC],
          [identity("grace/helper", { owner: "grace" }), hashD],
        ] as const,
        ([each, hash]) => storage.createIdentity(each, hash),
        ONE_AT_A_TIME,
      );
      const deactivated = yield* storage.deactivateIdentity(nameOf("matt"));
      const tokens = yield* Effect.forEach([hashB, hashC, hashD], storage.findIdentityByTokenHash, ONE_AT_A_TIME);
      const listed = yield* storage.listIdentities();

      expect(deactivated).toStrictEqual({
        agents: ["matt/helper", "release-bot"],
        identity: { ...MATT, deactivated: true },
        status: "deactivated",
      });
      expect(tokens).toMatchObject([{ status: "revoked" }, { status: "revoked" }, { status: "active" }]);
      expect(Arr.map(listed, ({ deactivated: off, name }) => [name, off === true])).toStrictEqual([
        ["grace", false],
        ["grace/helper", false],
        ["matt", true],
        ["matt/helper", true],
        ["release-bot", true],
      ]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): deactivating or reactivating a missing identity finds nothing",
  ({ layer }) =>
    Effect.gen(function* missing() {
      const { storage } = yield* openStore(layer);
      const deactivated = yield* storage.deactivateIdentity(nameOf("nobody"));
      const reactivated = yield* storage.reactivateIdentity(nameOf("nobody"), hashA);

      expect([deactivated, reactivated]).toStrictEqual([{ status: "not_found" }, { status: "not_found" }]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): the last active admin can't be deactivated, and a deactivated admin doesn't count",
  ({ layer }) =>
    Effect.gen(function* lastAdmin() {
      const { storage } = yield* openStore(layer);
      yield* storage.createIdentity(identity("boss", { admin: true, kind: "human" }), hashA);
      yield* storage.createIdentity(identity("boss-2", { admin: true, kind: "human" }), hashB);
      const first = yield* storage.deactivateIdentity(nameOf("boss"));
      const second = yield* storage.deactivateIdentity(nameOf("boss-2"));
      const removed = yield* storage.setAdmin(nameOf("boss-2"), false);
      const boss2 = yield* storage.findIdentityByTokenHash(hashB);

      expect(first).toMatchObject({ status: "deactivated" });
      expect([second, removed]).toStrictEqual([{ status: "last_admin" }, { status: "last_admin" }]);
      expect(boss2).toMatchObject({ status: "active" });
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): two admins deactivated at once leave one active admin",
  ({ layer }) =>
    Effect.gen(function* twoAtOnce() {
      const { storage } = yield* openStore(layer);
      yield* storage.createIdentity(identity("boss", { admin: true, kind: "human" }), hashA);
      yield* storage.createIdentity(identity("boss-2", { admin: true, kind: "human" }), hashB);
      const results = yield* Effect.all(
        [storage.deactivateIdentity(nameOf("boss")), storage.deactivateIdentity(nameOf("boss-2"))],
        { concurrency: "unbounded" },
      );

      expect(
        Arr.sort(
          Arr.map(results, ({ status }) => status),
          Str.Order,
        ),
      ).toStrictEqual(["deactivated", "last_admin"]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): reactivating holds only the new token, and leaves the agents deactivated",
  ({ layer }) =>
    Effect.gen(function* reactivate() {
      const { storage } = yield* openStore(layer);
      yield* storage.createIdentity(identity("release-bot"), hashA);
      yield* storage.deactivateIdentity(nameOf("matt"));
      const answers = yield* Effect.all(
        [
          storage.reactivateIdentity(nameOf("release-bot"), hashB),
          storage.reactivateIdentity(nameOf("matt"), hashC),
          storage.reactivateIdentity(nameOf("matt"), hashD),
        ],
        ONE_AT_A_TIME,
      );
      const tokens = yield* Effect.forEach([hashB, hashC, hashD], storage.findIdentityByTokenHash, ONE_AT_A_TIME);
      const bot = yield* storage.findIdentityByName(nameOf("release-bot"));

      expect(answers).toStrictEqual([
        { owner: "matt", status: "owner_deactivated" },
        { identity: MATT, status: "reactivated" },
        { status: "not_deactivated" },
      ]);
      expect(tokens).toStrictEqual([
        { status: "unknown" },
        { identity: MATT, status: "active" },
        { status: "unknown" },
      ]);
      expect(bot).toStrictEqual({ ...identity("release-bot"), deactivated: true });
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): a deactivated identity's messages keep it as their author, and it can't be mentioned",
  ({ layer }) =>
    Effect.gen(function* history() {
      const { storage } = yield* openStore(layer);
      yield* storage.createChannel(channel("grill"));
      yield* storage.createIdentity(identity("bob"), hashA);
      const said = yield* appendTo(storage)(newMessage("grill", "mine", { author: { name: "bob" } }));
      yield* storage.deactivateIdentity(nameOf("bob"));
      const mention = yield* appendTo(storage)(newMessage("grill", "@bob @matt", { mentions: ["bob", "matt"] }));
      const page = yield* storage.listChannelMessages(channel("grill").name, { limit: 10 });

      expect(mention.mentions).toStrictEqual(["matt"]);
      expect(page).toMatchObject({ messages: [{ author: { name: "bob" }, id: said.id }, { id: mention.id }] });
    }),
);
