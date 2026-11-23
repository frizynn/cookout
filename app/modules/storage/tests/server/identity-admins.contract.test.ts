import { Array as Arr, Effect, String as Str } from "effect";
import { expect, it } from "@effect/vitest";
import {
  identityFixture as identity,
  identityName as nameOf,
  openStore,
  storageLayers,
} from "../../../testing/server.ts";
import type { Identity } from "../../../identities/index.ts";
import { tokenHash } from "../../../identities/index.ts";

const HASH_LENGTH = 64;
const hashA = tokenHash(Str.repeat(HASH_LENGTH)("a"));
const hashB = tokenHash(Str.repeat(HASH_LENGTH)("b"));
const hashC = tokenHash(Str.repeat(HASH_LENGTH)("c"));

function human(name: string, admin = false): Identity {
  return identity(name, { admin, kind: "human" });
}

it.effect.each(storageLayers)(
  "storage contract ($adapter): setting the admin flag makes a human an admin",
  ({ layer }) =>
    Effect.gen(function* makeAdmin() {
      const { storage } = yield* openStore(layer);
      yield* storage.createIdentity(human("boss", true), hashA);
      yield* storage.createIdentity(human("grace"), hashB);
      const result = yield* storage.setAdmin(nameOf("grace"), true);
      const found = yield* storage.findIdentityByName(nameOf("grace"));
      const byToken = yield* storage.findIdentityByTokenHash(hashB);

      expect(result).toStrictEqual({ identity: human("grace", true), status: "set" });
      expect(found).toStrictEqual(human("grace", true));
      expect(byToken).toStrictEqual({ identity: human("grace", true), status: "active" });
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): clearing the admin flag works while another admin remains",
  ({ emptyLayer }) =>
    Effect.gen(function* clearAdmin() {
      const { storage } = yield* openStore(emptyLayer);
      yield* storage.createIdentity(human("boss", true), hashA);
      yield* storage.createIdentity(human("grace", true), hashB);
      const result = yield* storage.setAdmin(nameOf("grace"), false);
      const identities = yield* storage.listIdentities();

      expect(result).toStrictEqual({ identity: human("grace"), status: "set" });
      expect(identities).toStrictEqual([human("boss", true), human("grace")]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): setting the flag it already has changes nothing",
  ({ layer }) =>
    Effect.gen(function* setUnchanged() {
      const { storage } = yield* openStore(layer);
      yield* storage.createIdentity(human("boss", true), hashA);
      yield* storage.createIdentity(human("grace"), hashB);
      const again = yield* storage.setAdmin(nameOf("boss"), true);
      const notAdmin = yield* storage.setAdmin(nameOf("grace"), false);

      expect(again).toStrictEqual({ identity: human("boss", true), status: "set" });
      expect(notAdmin).toStrictEqual({ identity: human("grace"), status: "set" });
    }),
);

it.effect.each(storageLayers)("storage contract ($adapter): clearing the last admin's flag is refused", ({ layer }) =>
  Effect.gen(function* lastAdmin() {
    const { storage } = yield* openStore(layer);
    yield* storage.createIdentity(human("boss", true), hashA);
    const result = yield* storage.setAdmin(nameOf("boss"), false);
    const found = yield* storage.findIdentityByName(nameOf("boss"));

    expect(result).toStrictEqual({ status: "last_admin" });
    expect(found).toStrictEqual(human("boss", true));
  }),
);

it.effect.each(storageLayers)("storage contract ($adapter): two admins cleared at once leave one admin", ({ layer }) =>
  Effect.gen(function* clearTwoAtOnce() {
    const { storage } = yield* openStore(layer);
    yield* storage.createIdentity(human("boss", true), hashA);
    yield* storage.createIdentity(human("grace", true), hashB);
    const results = yield* Effect.all(
      [storage.setAdmin(nameOf("boss"), false), storage.setAdmin(nameOf("grace"), false)],
      { concurrency: "unbounded" },
    );
    const identities = yield* storage.listIdentities();
    const statuses = Arr.map(results, ({ status }) => status);

    expect(Arr.sort(statuses, Str.Order)).toStrictEqual(["last_admin", "set"]);
    expect(Arr.filter(identities, ({ admin }) => admin)).toMatchObject([{ admin: true }]);
  }),
);

it.effect.each(storageLayers)("storage contract ($adapter): an agent can't be made an admin", ({ layer }) =>
  Effect.gen(function* agentRefused() {
    const { storage } = yield* openStore(layer);
    yield* storage.createIdentity(human("boss", true), hashA);
    yield* storage.createIdentity(identity("release-bot"), hashC);
    const result = yield* storage.setAdmin(nameOf("release-bot"), true);
    const found = yield* storage.findIdentityByName(nameOf("release-bot"));

    expect(result).toStrictEqual({ identity: identity("release-bot"), status: "agent" });
    expect(found).toStrictEqual(identity("release-bot"));
  }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): setting the flag on a missing identity finds nothing",
  ({ layer }) =>
    Effect.gen(function* missing() {
      const { storage } = yield* openStore(layer);
      const result = yield* storage.setAdmin(nameOf("nobody"), true);

      expect(result).toStrictEqual({ status: "not_found" });
    }),
);
