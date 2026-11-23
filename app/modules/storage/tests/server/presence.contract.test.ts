import { Effect, String as Str } from "effect";
import { expect, it } from "@effect/vitest";
import {
  identityFixture as identity,
  isoTime,
  identityName as nameOf,
  openStore,
  storageLayers,
} from "../../../testing/server.ts";
import { tokenHash } from "../../../identities/index.ts";

const HASH_LENGTH = 64;
const hashA = tokenHash(Str.repeat(HASH_LENGTH)("a"));
const hashB = tokenHash(Str.repeat(HASH_LENGTH)("b"));
const ONE_AT_A_TIME = { concurrency: 1 } as const;

it.effect.each(storageLayers)(
  "storage contract ($adapter): last seen, and whether each identity was online, are kept and read back",
  ({ layer }) =>
    Effect.gen(function* presenceKept() {
      const { storage } = yield* openStore(layer);
      yield* storage.createIdentity(identity("ada", { kind: "human" }), hashA);
      yield* storage.createIdentity(identity("release-bot"), hashB);
      const before = yield* storage.listPresence;
      yield* Effect.forEach(
        [
          { identity: nameOf("release-bot"), lastSeenAt: isoTime("2026-01-01T00:00:00.000Z"), online: true },
          { identity: nameOf("ada"), lastSeenAt: isoTime("2026-01-01T00:01:00.000Z"), online: true },
          { identity: nameOf("ada"), lastSeenAt: isoTime("2026-01-01T00:02:00.000Z"), online: false },
        ],
        storage.recordPresence,
        ONE_AT_A_TIME,
      );
      const after = yield* storage.listPresence;

      expect(before).toStrictEqual([]);
      expect(after).toStrictEqual([
        { identity: "ada", lastSeenAt: "2026-01-01T00:02:00.000Z", online: false },
        { identity: "release-bot", lastSeenAt: "2026-01-01T00:00:00.000Z", online: true },
      ]);
    }),
);
