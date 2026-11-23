import { Array as Arr, Effect, String as Str, pipe } from "effect";
import { expect, it } from "@effect/vitest";
import {
  identityFixture as identity,
  identityName as nameOf,
  openStore,
  storageLayers,
} from "../../../testing/server.ts";
import { tokenHash } from "../../../identities/index.ts";

const HASH_LENGTH = 64;
const AT_ONCE = 10;
const hashA = tokenHash(Str.repeat(HASH_LENGTH)("a"));
const hashB = tokenHash(Str.repeat(HASH_LENGTH)("b"));
const hashC = tokenHash(Str.repeat(HASH_LENGTH)("c"));
const unavailable = { _tag: "StorageUnavailable" };

it.effect.each(storageLayers)("storage contract ($adapter): a new store has no identities", ({ layer }) =>
  Effect.gen(function* newStore() {
    const { storage } = yield* openStore(layer);
    const identities = yield* storage.listIdentities();

    expect(identities).toStrictEqual([]);
  }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): an identity is created with or without an owner and listed by name",
  ({ layer }) =>
    Effect.gen(function* createAndList() {
      const { storage } = yield* openStore(layer);
      const withOwner = yield* storage.createIdentity(identity("zed", { owner: "matt" }), hashA);
      const withoutOwner = yield* storage.createIdentity(identity("auth-griller"), hashB);
      const identities = yield* storage.listIdentities();

      expect([withOwner, withoutOwner]).toStrictEqual(["created", "created"]);
      expect(identities).toStrictEqual([identity("auth-griller"), identity("zed", { owner: "matt" })]);
    }),
);

it.effect.each(storageLayers)("storage contract ($adapter): the admin flag is kept", ({ layer }) =>
  Effect.gen(function* adminFlag() {
    const { storage } = yield* openStore(layer);
    yield* storage.createIdentity(identity("boss", { admin: true }), hashA);
    const identities = yield* storage.listIdentities();

    expect(identities).toStrictEqual([identity("boss", { admin: true })]);
  }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): an identity's kind is kept when it is listed, found by token and rotated",
  ({ layer }) =>
    Effect.gen(function* kindKept() {
      const { storage } = yield* openStore(layer);
      yield* storage.createIdentity(identity("ada", { kind: "human" }), hashA);
      yield* storage.createIdentity(identity("bot", { kind: "agent", owner: "ada" }), hashB);
      const identities = yield* storage.listIdentities();
      const found = yield* storage.findIdentityByTokenHash(hashA);
      const rotated = yield* storage.replaceToken(nameOf("bot"), hashC);

      expect(Arr.map(identities, ({ kind, name }) => [name, kind])).toStrictEqual([
        ["ada", "human"],
        ["bot", "agent"],
      ]);
      expect(found).toStrictEqual({ identity: identity("ada", { kind: "human" }), status: "active" });
      expect(rotated).toStrictEqual({ identity: identity("bot", { owner: "ada" }), status: "replaced" });
    }),
);

it.effect.each(storageLayers)("storage contract ($adapter): a name can be used only once", ({ layer }) =>
  Effect.gen(function* nameOnce() {
    const { storage } = yield* openStore(layer);
    yield* storage.createIdentity(identity("dup", { owner: "matt" }), hashA);
    const second = yield* storage.createIdentity(identity("dup"), hashB);
    const identities = yield* storage.listIdentities();
    const secondHash = yield* storage.findIdentityByTokenHash(hashB);

    expect(second).toBe("name_taken");
    expect(identities).toStrictEqual([identity("dup", { owner: "matt" })]);
    expect(secondHash).toStrictEqual({ status: "unknown" });
  }),
);

it.effect.each(storageLayers)("storage contract ($adapter): a token hash finds its identity", ({ layer }) =>
  Effect.gen(function* hashFindsIdentity() {
    const { storage } = yield* openStore(layer);
    yield* storage.createIdentity(identity("one", { owner: "matt" }), hashA);
    yield* storage.createIdentity(identity("two"), hashB);
    const one = yield* storage.findIdentityByTokenHash(hashA);
    const two = yield* storage.findIdentityByTokenHash(hashB);

    expect(one).toStrictEqual({ identity: identity("one", { owner: "matt" }), status: "active" });
    expect(two).toStrictEqual({ identity: identity("two"), status: "active" });
  }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): a token hash that was never stored is unknown",
  ({ layer }) =>
    Effect.gen(function* unknownHash() {
      const { storage } = yield* openStore(layer);
      yield* storage.createIdentity(identity("one"), hashA);
      const found = yield* storage.findIdentityByTokenHash(hashC);

      expect(found).toStrictEqual({ status: "unknown" });
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): replacing a token revokes the old hash at once",
  ({ layer }) =>
    Effect.gen(function* replaceToken() {
      const { storage } = yield* openStore(layer);
      yield* storage.createIdentity(identity("one"), hashA);
      const replaced = yield* storage.replaceToken(nameOf("one"), hashB);
      const oldHash = yield* storage.findIdentityByTokenHash(hashA);
      const newHash = yield* storage.findIdentityByTokenHash(hashB);

      expect(replaced).toStrictEqual({ identity: identity("one"), status: "replaced" });
      expect(oldHash).toStrictEqual({ status: "revoked" });
      expect(newHash).toStrictEqual({ identity: identity("one"), status: "active" });
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): replacing the token of a missing identity changes nothing",
  ({ layer }) =>
    Effect.gen(function* replaceMissing() {
      const { storage } = yield* openStore(layer);
      const replaced = yield* storage.replaceToken(nameOf("nobody"), hashA);
      const found = yield* storage.findIdentityByTokenHash(hashA);

      expect(replaced).toStrictEqual({ status: "not_found" });
      expect(found).toStrictEqual({ status: "unknown" });
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): the first identity is created only when there are none",
  ({ layer }) =>
    Effect.gen(function* firstIdentity() {
      const { storage } = yield* openStore(layer);
      const first = yield* storage.createIdentityIfNoneExist(identity("admin", { admin: true }), hashA);
      const second = yield* storage.createIdentityIfNoneExist(identity("admin-2", { admin: true }), hashB);
      const identities = yield* storage.listIdentities();
      const secondHash = yield* storage.findIdentityByTokenHash(hashB);

      expect([first, second]).toStrictEqual([true, false]);
      expect(identities).toStrictEqual([identity("admin", { admin: true })]);
      expect(secondHash).toStrictEqual({ status: "unknown" });
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): only one first identity is created when asked many times at once",
  ({ layer }) =>
    Effect.gen(function* firstIdentityAtOnce() {
      const { storage } = yield* openStore(layer);
      const results = yield* pipe(
        Arr.makeBy(AT_ONCE, String),
        Effect.forEach(
          (index) =>
            storage.createIdentityIfNoneExist(identity(`admin-${index}`), tokenHash(Str.repeat(HASH_LENGTH)(index))),
          { concurrency: "unbounded" },
        ),
      );
      const identities = yield* storage.listIdentities();

      expect(Arr.filter(results, (created) => created)).toStrictEqual([true]);
      expect(identities).toMatchObject([{ admin: false }]);
    }),
);

it.effect.each(storageLayers)("storage contract ($adapter): identities cannot be used in a closed store", ({ layer }) =>
  Effect.gen(function* closedStore() {
    const { close, storage } = yield* openStore(layer);
    yield* close;
    const listed = yield* Effect.flip(storage.listIdentities());
    const created = yield* Effect.flip(storage.createIdentity(identity("late"), hashA));
    const found = yield* Effect.flip(storage.findIdentityByTokenHash(hashA));

    expect([listed, created, found]).toMatchObject([unavailable, unavailable, unavailable]);
  }),
);
