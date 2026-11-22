import { Array as Arr, Effect, Option, String as Str } from "effect";
import type { Storage, StorageUnavailable } from "../../server.ts";
import { expect, it } from "@effect/vitest";
import {
  identityFixture as identity,
  leaseId,
  identityName as nameOf,
  openStore,
  storageLayers,
} from "../../../testing/server.ts";
import type { Layer } from "effect";
import { tokenHash } from "../../../identities/index.ts";

const HASH_LENGTH = 64;
const T0 = "2026-01-01T00:00:00.000Z";
const T30 = "2026-01-01T00:00:30.000Z";
const T60 = "2026-01-01T00:01:00.000Z";
const T90 = "2026-01-01T00:01:30.000Z";
const AGENT = nameOf("agent");
const OTHER = nameOf("other");
const LEASE_ONE = leaseId("lease_one_0123456789");
const LEASE_TWO = leaseId("lease_two_0123456789");
const unavailable = { _tag: "StorageUnavailable" };
const ONE_AT_A_TIME = { concurrency: 1 } as const;

type TakeResult = ReturnType<Storage["Service"]["takeLease"]>;

interface Take {
  readonly expiresAt: string;
  readonly force?: boolean;
  readonly id: typeof LEASE_ONE;
  readonly now: string;
}

function withIdentities(
  layer: Layer.Layer<Storage, StorageUnavailable>,
): Effect.Effect<Storage["Service"], StorageUnavailable> {
  return Effect.gen(function* twoIdentities() {
    const { storage } = yield* openStore(layer);
    yield* storage.createIdentity(identity("agent"), tokenHash(Str.repeat(HASH_LENGTH)("a")));
    yield* storage.createIdentity(identity("other"), tokenHash(Str.repeat(HASH_LENGTH)("b")));
    return storage;
  });
}

function take(storage: Storage["Service"], { expiresAt, force = false, id, now }: Take): TakeResult {
  return storage.takeLease({ expiresAt, force, identity: AGENT, leaseId: id, now });
}

it.effect.each(storageLayers)(
  "storage contract ($adapter): an identity nobody holds can be leased, and the lease is found until it ends",
  ({ layer }) =>
    Effect.gen(function* leaseFree() {
      const storage = yield* withIdentities(layer);
      const before = yield* storage.findLease(AGENT, T0);
      const taken = yield* take(storage, { expiresAt: T60, id: LEASE_ONE, now: T0 });
      const found = yield* Effect.all(
        [storage.findLease(AGENT, T30), storage.findLease(AGENT, T60), storage.findLease(OTHER, T30)],
        ONE_AT_A_TIME,
      );
      const lease = { expiresAt: T60, identity: AGENT, leaseId: LEASE_ONE };

      expect(before).toBeUndefined();
      expect(taken).toStrictEqual({ lease, status: "taken" });
      expect(Arr.map(found, Option.fromNullishOr)).toStrictEqual([Option.some(lease), Option.none(), Option.none()]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): a live lease refuses a second take and says until when",
  ({ layer }) =>
    Effect.gen(function* leaseHeld() {
      const storage = yield* withIdentities(layer);
      yield* take(storage, { expiresAt: T60, id: LEASE_ONE, now: T0 });
      const second = yield* take(storage, { expiresAt: T90, id: LEASE_TWO, now: T30 });
      const found = yield* storage.findLease(AGENT, T30);

      expect(second).toStrictEqual({ heldUntil: T60, status: "held" });
      expect(found).toMatchObject({ leaseId: LEASE_ONE });
    }),
);

it.effect.each(storageLayers)("storage contract ($adapter): an ended lease can be taken again", ({ layer }) =>
  Effect.gen(function* leaseEnded() {
    const storage = yield* withIdentities(layer);
    yield* take(storage, { expiresAt: T60, id: LEASE_ONE, now: T0 });
    const again = yield* take(storage, { expiresAt: T90, id: LEASE_TWO, now: T60 });
    const found = yield* storage.findLease(AGENT, T60);

    expect(again).toMatchObject({ status: "taken" });
    expect(found).toMatchObject({ leaseId: LEASE_TWO });
  }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): a forced take replaces a live lease, and the old lease ID stops working",
  ({ layer }) =>
    Effect.gen(function* forcedTake() {
      const storage = yield* withIdentities(layer);
      yield* take(storage, { expiresAt: T60, id: LEASE_ONE, now: T0 });
      const forced = yield* take(storage, { expiresAt: T90, force: true, id: LEASE_TWO, now: T30 });
      const renewed = yield* storage.renewLease({ expiresAt: T90, identity: AGENT, leaseId: LEASE_ONE, now: T30 });
      const released = yield* storage.releaseLease({ identity: AGENT, leaseId: LEASE_ONE, now: T30 });
      const found = yield* storage.findLease(AGENT, T30);

      expect(forced).toMatchObject({ status: "taken" });
      expect(renewed).toStrictEqual({ heldUntil: T90, status: "lost" });
      expect(released).toStrictEqual({ heldUntil: T90, status: "lost" });
      expect(found).toMatchObject({ leaseId: LEASE_TWO });
    }),
);

it.effect.each(storageLayers)("storage contract ($adapter): renewing the live lease moves its end", ({ layer }) =>
  Effect.gen(function* renewLive() {
    const storage = yield* withIdentities(layer);
    yield* take(storage, { expiresAt: T60, id: LEASE_ONE, now: T0 });
    const renewed = yield* storage.renewLease({ expiresAt: T90, identity: AGENT, leaseId: LEASE_ONE, now: T30 });
    const found = yield* storage.findLease(AGENT, T60);
    const lease = { expiresAt: T90, identity: AGENT, leaseId: LEASE_ONE };

    expect(renewed).toStrictEqual({ lease, status: "renewed" });
    expect(found).toStrictEqual(lease);
  }),
);

it.effect.each(storageLayers)("storage contract ($adapter): an ended lease cannot be renewed", ({ layer }) =>
  Effect.gen(function* renewEnded() {
    const storage = yield* withIdentities(layer);
    yield* take(storage, { expiresAt: T30, id: LEASE_ONE, now: T0 });
    const renewed = yield* storage.renewLease({ expiresAt: T90, identity: AGENT, leaseId: LEASE_ONE, now: T30 });
    const found = yield* storage.findLease(AGENT, T30);

    expect(renewed).toStrictEqual({ heldUntil: null, status: "lost" });
    expect(found).toBeUndefined();
  }),
);

it.effect.each(storageLayers)("storage contract ($adapter): a lease ID only works for its own identity", ({ layer }) =>
  Effect.gen(function* ownIdentityOnly() {
    const storage = yield* withIdentities(layer);
    yield* take(storage, { expiresAt: T60, id: LEASE_ONE, now: T0 });
    const renewed = yield* storage.renewLease({ expiresAt: T90, identity: OTHER, leaseId: LEASE_ONE, now: T30 });
    const released = yield* storage.releaseLease({ identity: OTHER, leaseId: LEASE_ONE, now: T30 });
    const found = yield* storage.findLease(AGENT, T30);

    expect(renewed).toStrictEqual({ heldUntil: null, status: "lost" });
    expect(released).toStrictEqual({ heldUntil: null, status: "lost" });
    expect(found).toMatchObject({ leaseId: LEASE_ONE });
  }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): releasing the live lease lets the next take succeed at once",
  ({ layer }) =>
    Effect.gen(function* releaseLive() {
      const storage = yield* withIdentities(layer);
      yield* take(storage, { expiresAt: T60, id: LEASE_ONE, now: T0 });
      const released = yield* storage.releaseLease({ identity: AGENT, leaseId: LEASE_ONE, now: T30 });
      const found = yield* storage.findLease(AGENT, T30);
      const again = yield* storage.releaseLease({ identity: AGENT, leaseId: LEASE_ONE, now: T30 });
      const next = yield* take(storage, { expiresAt: T90, id: LEASE_TWO, now: T30 });

      expect(released).toStrictEqual({ status: "released" });
      expect(found).toBeUndefined();
      expect(again).toStrictEqual({ heldUntil: null, status: "lost" });
      expect(next).toMatchObject({ status: "taken" });
    }),
);

it.effect.each(storageLayers)("storage contract ($adapter): deleting an identity drops its lease", ({ layer }) =>
  Effect.gen(function* deleteDropsLease() {
    const storage = yield* withIdentities(layer);
    yield* take(storage, { expiresAt: T60, id: LEASE_ONE, now: T0 });
    yield* storage.deleteIdentity(AGENT);
    const found = yield* storage.findLease(AGENT, T30);

    expect(found).toBeUndefined();
  }),
);

it.effect.each(storageLayers)("storage contract ($adapter): leases cannot be used in a closed store", ({ layer }) =>
  Effect.gen(function* closedStore() {
    const { close, storage } = yield* openStore(layer);
    yield* close;
    const taken = yield* Effect.flip(take(storage, { expiresAt: T60, id: LEASE_ONE, now: T0 }));
    const found = yield* Effect.flip(storage.findLease(AGENT, T0));
    const renewed = yield* Effect.flip(
      storage.renewLease({ expiresAt: T60, identity: AGENT, leaseId: LEASE_ONE, now: T0 }),
    );
    const released = yield* Effect.flip(storage.releaseLease({ identity: AGENT, leaseId: LEASE_ONE, now: T0 }));

    expect([taken, found, renewed, released]).toMatchObject([unavailable, unavailable, unavailable, unavailable]);
  }),
);
