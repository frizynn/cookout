import { Array as Arr, Effect, String as Str } from "effect";
import { expect, it } from "@effect/vitest";
import {
  identityFixture as identity,
  identityName as nameOf,
  openStore,
  storageLayers,
} from "../../../testing/server.ts";
import { tokenHash } from "../../../identities/index.ts";

const HASH_LENGTH = 64;
const hashA = tokenHash(Str.repeat(HASH_LENGTH)("a"));
const hashB = tokenHash(Str.repeat(HASH_LENGTH)("b"));

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
      expect(identities).toStrictEqual([identity("stays")]);
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
    expect(identities).toStrictEqual([identity("agent"), identity("boss", { admin: true })]);
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
