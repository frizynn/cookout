import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { tokenHash } from "../../identities/index.ts";
import { identityFixture as identity, identityName as nameOf, openStore, storageLayers } from "../../testing/server.ts";

const hashA = tokenHash("a".repeat(64));
const hashB = tokenHash("b".repeat(64));
const hashC = tokenHash("c".repeat(64));

for (const [adapter, layer] of Object.entries(storageLayers)) {
  describe(`storage contract (${adapter})`, () => {
    describe("identities and token hashes", () => {
      it.effect("a new store has no identities", () =>
        Effect.gen(function* () {
          const { storage } = yield* openStore(layer);
          expect(yield* storage.listIdentities()).toEqual([]);
        }),
      );

      it.effect("an identity is created with or without an owner and listed by name", () =>
        Effect.gen(function* () {
          const { storage } = yield* openStore(layer);
          expect(yield* storage.createIdentity(identity("zed", { owner: "matt" }), hashA)).toBe("created");
          expect(yield* storage.createIdentity(identity("auth-griller"), hashB)).toBe("created");
          expect(yield* storage.listIdentities()).toEqual([
            identity("auth-griller"),
            identity("zed", { owner: "matt" }),
          ]);
        }),
      );

      it.effect("the admin flag is kept", () =>
        Effect.gen(function* () {
          const { storage } = yield* openStore(layer);
          yield* storage.createIdentity(identity("boss", { admin: true }), hashA);
          expect(yield* storage.listIdentities()).toEqual([identity("boss", { admin: true })]);
        }),
      );

      it.effect("a name can be used only once", () =>
        Effect.gen(function* () {
          const { storage } = yield* openStore(layer);
          yield* storage.createIdentity(identity("dup", { owner: "matt" }), hashA);
          expect(yield* storage.createIdentity(identity("dup"), hashB)).toBe("name_taken");
          expect(yield* storage.listIdentities()).toEqual([identity("dup", { owner: "matt" })]);
          expect(yield* storage.findIdentityByTokenHash(hashB)).toEqual({ status: "unknown" });
        }),
      );

      it.effect("a token hash finds its identity", () =>
        Effect.gen(function* () {
          const { storage } = yield* openStore(layer);
          yield* storage.createIdentity(identity("one", { owner: "matt" }), hashA);
          yield* storage.createIdentity(identity("two"), hashB);
          expect(yield* storage.findIdentityByTokenHash(hashA)).toEqual({
            status: "active",
            identity: identity("one", { owner: "matt" }),
          });
          expect(yield* storage.findIdentityByTokenHash(hashB)).toEqual({
            status: "active",
            identity: identity("two"),
          });
        }),
      );

      it.effect("a token hash that was never stored is unknown", () =>
        Effect.gen(function* () {
          const { storage } = yield* openStore(layer);
          yield* storage.createIdentity(identity("one"), hashA);
          expect(yield* storage.findIdentityByTokenHash(hashC)).toEqual({ status: "unknown" });
        }),
      );

      it.effect("replacing a token revokes the old hash at once", () =>
        Effect.gen(function* () {
          const { storage } = yield* openStore(layer);
          yield* storage.createIdentity(identity("one"), hashA);
          expect(yield* storage.replaceToken(nameOf("one"), hashB)).toEqual({
            status: "replaced",
            identity: identity("one"),
          });
          expect(yield* storage.findIdentityByTokenHash(hashA)).toEqual({ status: "revoked" });
          expect(yield* storage.findIdentityByTokenHash(hashB)).toEqual({
            status: "active",
            identity: identity("one"),
          });
        }),
      );

      it.effect("replacing the token of a missing identity changes nothing", () =>
        Effect.gen(function* () {
          const { storage } = yield* openStore(layer);
          expect(yield* storage.replaceToken(nameOf("nobody"), hashA)).toEqual({ status: "not_found" });
          expect(yield* storage.findIdentityByTokenHash(hashA)).toEqual({ status: "unknown" });
        }),
      );

      it.effect("the first identity is created only when there are none", () =>
        Effect.gen(function* () {
          const { storage } = yield* openStore(layer);
          expect(yield* storage.createIdentityIfNoneExist(identity("admin", { admin: true }), hashA)).toBe(true);
          expect(yield* storage.createIdentityIfNoneExist(identity("admin-2", { admin: true }), hashB)).toBe(false);
          expect(yield* storage.listIdentities()).toEqual([identity("admin", { admin: true })]);
          expect(yield* storage.findIdentityByTokenHash(hashB)).toEqual({ status: "unknown" });
        }),
      );

      it.effect("only one first identity is created when asked many times at once", () =>
        Effect.gen(function* () {
          const { storage } = yield* openStore(layer);
          const results = yield* Effect.all(
            Array.from({ length: 10 }, (_, i) =>
              storage.createIdentityIfNoneExist(identity(`admin-${i}`), tokenHash(String(i).repeat(64))),
            ),
            { concurrency: "unbounded" },
          );
          expect(results.filter(Boolean)).toHaveLength(1);
          expect(yield* storage.listIdentities()).toHaveLength(1);
        }),
      );

      it.effect("identities cannot be used in a closed store", () =>
        Effect.gen(function* () {
          const { storage, close } = yield* openStore(layer);
          yield* close;
          for (const attempt of [
            Effect.asVoid(storage.listIdentities()),
            Effect.asVoid(storage.createIdentity(identity("late"), hashA)),
            Effect.asVoid(storage.findIdentityByTokenHash(hashA)),
          ]) {
            expect((yield* Effect.flip(attempt))._tag).toBe("StorageUnavailable");
          }
        }),
      );
    });
  });
}
