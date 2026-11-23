import { Effect, String as Str } from "effect";
import { expect, it } from "@effect/vitest";
import {
  identityFixture as identity,
  identityName as nameOf,
  openStore,
  storageLayers,
} from "../../../testing/server.ts";
import { isDisplayName, tokenHash } from "../../../identities/index.ts";
import type { DisplayName } from "../../../identities/index.ts";

const HASH_LENGTH = 64;
const LONGEST = 80;
const hashA = tokenHash(Str.repeat(HASH_LENGTH)("a"));
const hashB = tokenHash(Str.repeat(HASH_LENGTH)("b"));
const hashC = tokenHash(Str.repeat(HASH_LENGTH)("c"));
const unavailable = { _tag: "StorageUnavailable" };

function displayName(value: string): DisplayName {
  if (isDisplayName(value)) {
    return value;
  }
  return expect.unreachable(`${value} is not a display name`);
}

it.effect.each(storageLayers)(
  "storage contract ($adapter): a display name is set and kept when listed, found by name or token and rotated",
  ({ layer }) =>
    Effect.gen(function* displayNameKept() {
      const { storage } = yield* openStore(layer);
      yield* storage.createIdentity(identity("ada", { kind: "human" }), hashA);
      const set = yield* storage.setDisplayName(nameOf("ada"), displayName("Ada Lovelace"));
      const named = identity("ada", { displayName: "Ada Lovelace", kind: "human" });
      const listed = yield* storage.listIdentities();
      const byName = yield* storage.findIdentityByName(nameOf("ada"));
      const byToken = yield* storage.findIdentityByTokenHash(hashA);
      const rotated = yield* storage.replaceToken(nameOf("ada"), hashB);

      expect(set).toStrictEqual({ identity: named, status: "set" });
      expect([listed, byName, byToken, rotated]).toStrictEqual([
        [named],
        named,
        { identity: named, status: "active" },
        { identity: named, status: "replaced" },
      ]);
    }),
);

it.effect.each(storageLayers)("storage contract ($adapter): an identity is created with a display name", ({ layer }) =>
  Effect.gen(function* createdWithDisplayName() {
    const { storage } = yield* openStore(layer);
    yield* storage.createIdentity(identity("release-bot", { displayName: "Release bot", owner: "ada" }), hashA);
    const found = yield* storage.findIdentityByName(nameOf("release-bot"));

    expect(found).toStrictEqual(identity("release-bot", { displayName: "Release bot", owner: "ada" }));
  }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): clearing a display name removes it, and a new one replaces the old",
  ({ layer }) =>
    Effect.gen(function* clearAndReplace() {
      const { storage } = yield* openStore(layer);
      yield* storage.createIdentity(identity("ada", { displayName: "Ada", kind: "human" }), hashA);
      yield* storage.createIdentity(identity("grace", { displayName: "Grace", kind: "human" }), hashB);
      const cleared = yield* storage.setDisplayName(nameOf("ada"), null);
      const replaced = yield* storage.setDisplayName(nameOf("grace"), displayName("Grace Hopper"));
      const listed = yield* storage.listIdentities();

      expect([cleared, replaced]).toStrictEqual([
        { identity: identity("ada", { kind: "human" }), status: "set" },
        { identity: identity("grace", { displayName: "Grace Hopper", kind: "human" }), status: "set" },
      ]);
      expect(listed).toStrictEqual([
        identity("ada", { kind: "human" }),
        identity("grace", { displayName: "Grace Hopper", kind: "human" }),
      ]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): a display name of 80 characters is kept whole, and two identities may share one",
  ({ layer }) =>
    Effect.gen(function* longestAndShared() {
      const { storage } = yield* openStore(layer);
      const longest = Str.repeat(LONGEST)("é");
      yield* storage.createIdentity(identity("ada", { kind: "human" }), hashA);
      yield* storage.createIdentity(identity("ada-bot", { owner: "ada" }), hashB);
      yield* storage.setDisplayName(nameOf("ada"), displayName(longest));
      yield* storage.setDisplayName(nameOf("ada-bot"), displayName(longest));
      const listed = yield* storage.listIdentities();

      expect(listed).toStrictEqual([
        identity("ada", { displayName: longest, kind: "human" }),
        identity("ada-bot", { displayName: longest, owner: "ada" }),
      ]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): setting the display name of a missing identity finds nothing",
  ({ layer }) =>
    Effect.gen(function* missingIdentity() {
      const { storage } = yield* openStore(layer);
      const result = yield* storage.setDisplayName(nameOf("nobody"), displayName("Nobody"));
      const listed = yield* storage.listIdentities();

      expect(result).toStrictEqual({ status: "not_found" });
      expect(listed).toStrictEqual([]);
    }),
);

it.effect.each(storageLayers)("storage contract ($adapter): a closed store sets no display name", ({ layer }) =>
  Effect.gen(function* closedStore() {
    const { close, storage } = yield* openStore(layer);
    yield* storage.createIdentity(identity("ada", { kind: "human" }), hashC);
    yield* close;
    const refused = yield* Effect.flip(storage.setDisplayName(nameOf("ada"), null));

    expect(refused).toMatchObject(unavailable);
  }),
);
