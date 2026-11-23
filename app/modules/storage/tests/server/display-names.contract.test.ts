import type { DisplayName, Identity } from "../../../identities/index.ts";
import { Effect, String as Str } from "effect";
import { expect, it } from "@effect/vitest";
import {
  identityFixture as identity,
  identityName as nameOf,
  openStore,
  storageLayers,
} from "../../../testing/server.ts";
import { isDisplayName, tokenHash } from "../../../identities/index.ts";

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

function named(unnamed: Identity, text: string): Identity {
  return { ...unnamed, displayName: displayName(text) };
}

it.effect.each(storageLayers)(
  "storage contract ($adapter): a display name is set and kept when listed, found by name or token and rotated",
  ({ emptyLayer }) =>
    Effect.gen(function* displayNameKept() {
      const { storage } = yield* openStore(emptyLayer);
      yield* storage.createIdentity(identity("ada", { kind: "human" }), hashA);
      const set = yield* storage.setDisplayName(nameOf("ada"), displayName("Ada Lovelace"));
      const ada = named(identity("ada", { kind: "human" }), "Ada Lovelace");
      const listed = yield* storage.listIdentities();
      const byName = yield* storage.findIdentityByName(nameOf("ada"));
      const byToken = yield* storage.findIdentityByTokenHash(hashA);
      const rotated = yield* storage.replaceToken(nameOf("ada"), hashB);

      expect(set).toStrictEqual({ identity: ada, status: "set" });
      expect([listed, byName, byToken, rotated]).toStrictEqual([
        [ada],
        ada,
        { identity: ada, status: "active" },
        { identity: ada, status: "replaced" },
      ]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): an identity is created with a display name",
  ({ emptyLayer }) =>
    Effect.gen(function* createdWithDisplayName() {
      const { storage } = yield* openStore(emptyLayer);
      yield* storage.createIdentity(identity("ada", { kind: "human" }), hashB);
      yield* storage.createIdentity(named(identity("release-bot", { owner: "ada" }), "Release bot"), hashA);
      const found = yield* storage.findIdentityByName(nameOf("release-bot"));

      expect(found).toStrictEqual(named(identity("release-bot", { owner: "ada" }), "Release bot"));
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): clearing a display name removes it, and a new one replaces the old",
  ({ emptyLayer }) =>
    Effect.gen(function* clearAndReplace() {
      const { storage } = yield* openStore(emptyLayer);
      yield* storage.createIdentity(named(identity("ada", { kind: "human" }), "Ada"), hashA);
      yield* storage.createIdentity(named(identity("grace", { kind: "human" }), "Grace"), hashB);
      const cleared = yield* storage.setDisplayName(nameOf("ada"), null);
      const replaced = yield* storage.setDisplayName(nameOf("grace"), displayName("Grace Hopper"));
      const listed = yield* storage.listIdentities();

      expect([cleared, replaced]).toStrictEqual([
        { identity: identity("ada", { kind: "human" }), status: "set" },
        { identity: named(identity("grace", { kind: "human" }), "Grace Hopper"), status: "set" },
      ]);
      expect(listed).toStrictEqual([
        identity("ada", { kind: "human" }),
        named(identity("grace", { kind: "human" }), "Grace Hopper"),
      ]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): a display name of 80 characters is kept whole, and two identities may share one",
  ({ emptyLayer }) =>
    Effect.gen(function* longestAndShared() {
      const { storage } = yield* openStore(emptyLayer);
      const longest = Str.repeat(LONGEST)("é");
      yield* storage.createIdentity(identity("ada", { kind: "human" }), hashA);
      yield* storage.createIdentity(identity("ada-bot", { owner: "ada" }), hashB);
      yield* storage.setDisplayName(nameOf("ada"), displayName(longest));
      yield* storage.setDisplayName(nameOf("ada-bot"), displayName(longest));
      const listed = yield* storage.listIdentities();

      expect(listed).toStrictEqual([
        named(identity("ada", { kind: "human" }), longest),
        named(identity("ada-bot", { owner: "ada" }), longest),
      ]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): setting the display name of a missing identity finds nothing",
  ({ emptyLayer }) =>
    Effect.gen(function* missingIdentity() {
      const { storage } = yield* openStore(emptyLayer);
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
