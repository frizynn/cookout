import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { tokenHash } from "../../identities/index.ts";
import { identityFixture as identity, identityName as nameOf, openStore, storageLayers } from "../../testing/server.ts";

const hashA = tokenHash("a".repeat(64));
const hashB = tokenHash("b".repeat(64));

for (const [adapter, layer] of Object.entries(storageLayers)) {
  describe(`storage contract (${adapter})`, () => {
    describe("identities and token hashes", () => {
      it.effect("deleting an identity removes it and revokes its token", () =>
        Effect.gen(function* () {
          const { storage } = yield* openStore(layer);
          yield* storage.createIdentity(identity("gone", { owner: "matt" }), hashA);
          yield* storage.createIdentity(identity("stays"), hashB);
          expect(yield* storage.deleteIdentity(nameOf("gone"))).toEqual({
            status: "deleted",
            identity: identity("gone", { owner: "matt" }),
          });
          expect(yield* storage.listIdentities()).toEqual([identity("stays")]);
          expect(yield* storage.findIdentityByTokenHash(hashA)).toEqual({ status: "revoked" });
        }),
      );

      it.effect("deleting a missing identity returns nothing", () =>
        Effect.gen(function* () {
          const { storage } = yield* openStore(layer);
          expect(yield* storage.deleteIdentity(nameOf("nobody"))).toEqual({ status: "not_found" });
        }),
      );

      it.effect("the last admin can't be deleted", () =>
        Effect.gen(function* () {
          const { storage } = yield* openStore(layer);
          yield* storage.createIdentity(identity("boss", { admin: true }), hashA);
          yield* storage.createIdentity(identity("agent"), hashB);
          expect(yield* storage.deleteIdentity(nameOf("boss"))).toEqual({ status: "last_admin" });
          expect(yield* storage.listIdentities()).toEqual([identity("agent"), identity("boss", { admin: true })]);
          expect(yield* storage.findIdentityByTokenHash(hashA)).toEqual({
            status: "active",
            identity: identity("boss", { admin: true }),
          });
        }),
      );

      it.effect("an admin can be deleted while another admin remains", () =>
        Effect.gen(function* () {
          const { storage } = yield* openStore(layer);
          yield* storage.createIdentity(identity("boss", { admin: true }), hashA);
          yield* storage.createIdentity(identity("boss-2", { admin: true }), hashB);
          expect(yield* storage.deleteIdentity(nameOf("boss"))).toMatchObject({ status: "deleted" });
          expect(yield* storage.deleteIdentity(nameOf("boss-2"))).toEqual({ status: "last_admin" });
        }),
      );

      it.effect("two admins deleted at once leave one admin", () =>
        Effect.gen(function* () {
          const { storage } = yield* openStore(layer);
          yield* storage.createIdentity(identity("boss", { admin: true }), hashA);
          yield* storage.createIdentity(identity("boss-2", { admin: true }), hashB);
          const results = yield* Effect.all(
            [storage.deleteIdentity(nameOf("boss")), storage.deleteIdentity(nameOf("boss-2"))],
            { concurrency: "unbounded" },
          );
          expect(results.map((result) => result.status).sort()).toEqual(["deleted", "last_admin"]);
          expect((yield* storage.listIdentities()).filter((found) => found.admin)).toHaveLength(1);
        }),
      );

      it.effect("a deleted name can be created again, and the old token stays revoked", () =>
        Effect.gen(function* () {
          const { storage } = yield* openStore(layer);
          yield* storage.createIdentity(identity("again"), hashA);
          yield* storage.deleteIdentity(nameOf("again"));
          expect(yield* storage.createIdentity(identity("again"), hashB)).toBe("created");
          expect(yield* storage.findIdentityByTokenHash(hashA)).toEqual({ status: "revoked" });
          expect(yield* storage.findIdentityByTokenHash(hashB)).toEqual({
            status: "active",
            identity: identity("again"),
          });
        }),
      );
    });
  });
}
