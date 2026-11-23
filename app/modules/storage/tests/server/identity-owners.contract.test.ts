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
const ONE_AT_A_TIME = { concurrency: 1 } as const;
const hashA = tokenHash(Str.repeat(HASH_LENGTH)("a"));
const hashB = tokenHash(Str.repeat(HASH_LENGTH)("b"));
const hashC = tokenHash(Str.repeat(HASH_LENGTH)("c"));
const hashD = tokenHash(Str.repeat(HASH_LENGTH)("d"));

it.effect.each(storageLayers)(
  "storage contract ($adapter): an agent's owner must be an existing human, or nothing is stored",
  ({ layer }) =>
    Effect.gen(function* ownerIsHuman() {
      const { storage } = yield* openStore(layer);
      yield* storage.createIdentity(identity("helper"), hashA);
      const results = yield* Effect.forEach(
        [identity("by-nobody", { owner: "nobody" }), identity("by-agent", { owner: "helper" })],
        (agent) => storage.createIdentity(agent, hashB),
        ONE_AT_A_TIME,
      );
      const identities = yield* storage.listIdentities();
      const unused = yield* storage.findIdentityByTokenHash(hashB);

      expect(results).toStrictEqual(["owner_not_human", "owner_not_human"]);
      expect(Arr.map(identities, ({ name }) => name)).toStrictEqual(["helper", "matt"]);
      expect(unused).toStrictEqual({ status: "unknown" });
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): a namespaced name is stored only on an agent its first part owns",
  ({ layer }) =>
    Effect.gen(function* namespacedNames() {
      const { storage } = yield* openStore(layer);
      yield* storage.createIdentity(identity("ada", { kind: "human" }), hashA);
      const owned = yield* storage.createIdentity(identity("matt/helper"), hashB);
      const refused = yield* Effect.forEach(
        [identity("ada/helper"), identity("matt/person", { kind: "human" })],
        (named) => storage.createIdentity(named, hashC),
        ONE_AT_A_TIME,
      );
      const [found, byToken, rotated] = yield* Effect.all(
        [
          storage.findIdentityByName(nameOf("matt/helper")),
          storage.findIdentityByTokenHash(hashB),
          storage.replaceToken(nameOf("matt/helper"), hashD),
        ],
        ONE_AT_A_TIME,
      );

      expect([owned, ...refused]).toStrictEqual(["created", "name_not_owned", "name_not_owned"]);
      expect(found).toStrictEqual(identity("matt/helper", { owner: "matt" }));
      expect(byToken).toStrictEqual({ identity: identity("matt/helper"), status: "active" });
      expect(rotated).toStrictEqual({ identity: identity("matt/helper"), status: "replaced" });
    }),
);
