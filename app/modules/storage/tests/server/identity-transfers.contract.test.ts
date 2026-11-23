import { Effect, String as Str } from "effect";
import type { Storage, StorageUnavailable } from "../../server.ts";
import { expect, it } from "@effect/vitest";
import {
  identityFixture as identity,
  identityName as nameOf,
  openStore,
  storageLayers,
} from "../../../testing/server.ts";
import type { Layer } from "effect";
import type { TokenHash } from "../../../identities/index.ts";
import { tokenHash } from "../../../identities/index.ts";

const HASH_LENGTH = 64;
const ONE_AT_A_TIME = { concurrency: 1 } as const;

function hash(character: string): TokenHash {
  return tokenHash(Str.repeat(HASH_LENGTH)(character));
}

function seeded(
  layer: Layer.Layer<Storage, StorageUnavailable>,
): Effect.Effect<Storage["Service"], StorageUnavailable> {
  return Effect.gen(function* seed() {
    const { storage } = yield* openStore(layer);
    yield* Effect.all(
      [
        storage.createIdentity(identity("ada", { kind: "human" }), hash("a")),
        storage.createIdentity(identity("grace", { kind: "human" }), hash("b")),
        storage.createIdentity(identity("release-bot", { owner: "ada" }), hash("c")),
        storage.createIdentity(identity("ada/x", { owner: "ada" }), hash("d")),
      ],
      ONE_AT_A_TIME,
    );
    return storage;
  });
}

it.effect.each(storageLayers)(
  "storage contract ($adapter): transferring an agent gives it to another human, keeping its token",
  ({ layer }) =>
    Effect.gen(function* transfers() {
      const storage = yield* seeded(layer);
      const result = yield* storage.transferAgent(nameOf("release-bot"), nameOf("grace"));
      const found = yield* storage.findIdentityByName(nameOf("release-bot"));
      const byToken = yield* storage.findIdentityByTokenHash(hash("c"));
      const moved = identity("release-bot", { owner: "grace" });

      expect(result).toStrictEqual({ identity: moved, status: "transferred" });
      expect(found).toStrictEqual(moved);
      expect(byToken).toStrictEqual({ identity: moved, status: "active" });
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): a transfer is refused for a missing identity, a human, a non-human owner or a namespaced agent",
  ({ layer }) =>
    Effect.gen(function* refusesTransfers() {
      const storage = yield* seeded(layer);
      const results = yield* Effect.all(
        [
          storage.transferAgent(nameOf("nobody"), nameOf("grace")),
          storage.transferAgent(nameOf("ada"), nameOf("grace")),
          storage.transferAgent(nameOf("release-bot"), nameOf("release-bot")),
          storage.transferAgent(nameOf("release-bot"), nameOf("nobody")),
          storage.transferAgent(nameOf("ada/x"), nameOf("grace")),
        ],
        ONE_AT_A_TIME,
      );
      const kept = yield* storage.findIdentityByName(nameOf("ada/x"));

      expect(results).toStrictEqual([
        { status: "not_found" },
        { status: "not_agent" },
        { status: "owner_not_human" },
        { status: "owner_not_human" },
        { status: "name_not_owned" },
      ]);
      expect(kept).toStrictEqual(identity("ada/x", { owner: "ada" }));
    }),
);
