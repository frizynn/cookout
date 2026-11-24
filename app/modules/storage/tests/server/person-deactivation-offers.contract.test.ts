import { Array as Arr, DateTime, Effect, String as Str } from "effect";
import type { OfferChanges, Storage, StorageUnavailable } from "../../../storage/server.ts";
import { expect, it } from "@effect/vitest";
import { identityFixture, identityName, isoTime, openStore, storageLayers } from "../../../testing/server.ts";
import type { IsoTime } from "../../../time/index.ts";
import type { Layer } from "effect";
import { TestClock } from "effect/testing";
import { quietAgentDays } from "../../../inbox/index.ts";
import { tokenHash } from "../../../identities/index.ts";

const ADA = identityName("ada");
const BEA = identityName("bea");
const CY = identityName("cy");
const MATT = identityName("matt");
const HELPER = identityName("cy/helper");
const IDLE = identityName("cy/idle");
const HASH_LENGTH = 64;
const CREATED = isoTime("2026-01-01T00:00:00.000Z");
const JAN_10 = isoTime("2026-01-10T00:00:00.000Z");
const JAN_20 = isoTime("2026-01-20T00:00:00.000Z");
const JAN_31 = isoTime("2026-01-31T00:00:00.000Z");
const MAR_2 = isoTime("2026-03-02T00:00:00.000Z");
const APR_1 = isoTime("2026-04-01T00:00:00.000Z");
const MAY_1 = isoTime("2026-05-01T00:00:00.000Z");

type Store = Storage["Service"];

function hashOf(letter: string): ReturnType<typeof tokenHash> {
  return tokenHash(Str.repeat(HASH_LENGTH)(letter));
}

function people<Failure, Needs>(
  layer: Layer.Layer<Storage, Failure, Needs>,
): Effect.Effect<Store, Failure | StorageUnavailable, Needs> {
  return Effect.gen(function* openPeople() {
    const { storage } = yield* openStore(layer);
    yield* storage.createIdentity(identityFixture("ada", { admin: true, kind: "human" }), hashOf("a"));
    yield* storage.createIdentity(identityFixture("bea", { admin: true, kind: "human" }), hashOf("b"));
    yield* storage.createIdentity(identityFixture("cy", { kind: "human" }), hashOf("c"));
    yield* storage.createIdentity(identityFixture("cy/helper", { owner: "cy" }), hashOf("d"));
    yield* storage.createIdentity(identityFixture("cy/idle", { owner: "cy" }), hashOf("e"));
    return storage;
  });
}

function seenOffline(storage: Store, identity: typeof CY, at: IsoTime): ReturnType<Store["recordPresence"]> {
  return storage.recordPresence({ identity, lastSeenAt: at, online: false });
}

function raisedFor(changes: OfferChanges): readonly unknown[] {
  return Arr.map(changes.raised, ({ identity, quietDays, recipients }) => ({ identity, quietDays, recipients }));
}

it.effect.each(storageLayers)(
  "storage contract ($adapter): a person's last activity is the latest of their own and each active agent's they own",
  ({ layer }) =>
    Effect.gen(function* effectiveLastActivity() {
      const storage = yield* people(layer);
      const created = yield* storage.lastActivityOf(CY);
      yield* seenOffline(storage, HELPER, JAN_10);
      yield* seenOffline(storage, IDLE, JAN_20);
      const byAgents = yield* storage.lastActivityOf(CY);
      yield* storage.deactivateIdentity(IDLE);
      const idleGone = yield* storage.lastActivityOf(CY);
      yield* seenOffline(storage, CY, JAN_31);
      const own = yield* Effect.all([storage.lastActivityOf(CY), storage.lastActivityOf(HELPER)], {
        concurrency: 1,
      });

      expect([created, byAgents, idleGone, own]).toStrictEqual([CREATED, JAN_20, JAN_10, [JAN_31, JAN_10]]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): a quiet person's offer goes to every other active admin, every 30 days, never about the last active admin",
  ({ layer }) =>
    Effect.gen(function* personOffers() {
      const storage = yield* people(layer);
      yield* Effect.forEach([HELPER, IDLE], (agent) => storage.deactivateIdentity(agent), { concurrency: 1 });
      const due = yield* storage.nextDeactivationOfferDue(quietAgentDays);
      const first = yield* storage.raiseDueDeactivationOffers(JAN_31, quietAgentDays);
      yield* storage.deactivateIdentity(BEA);
      const second = yield* storage.raiseDueDeactivationOffers(MAR_2, quietAgentDays);
      const third = yield* storage.raiseDueDeactivationOffers(APR_1, quietAgentDays);
      const fourth = yield* storage.raiseDueDeactivationOffers(MAY_1, quietAgentDays);

      expect([due, raisedFor(first)]).toStrictEqual([
        JAN_31,
        [
          { identity: ADA, quietDays: 30, recipients: [BEA] },
          { identity: BEA, quietDays: 30, recipients: [ADA] },
          { identity: CY, quietDays: 30, recipients: [ADA, BEA] },
          { identity: MATT, quietDays: 30, recipients: [ADA, BEA] },
        ],
      ]);
      expect([raisedFor(second), raisedFor(third), raisedFor(fourth)]).toStrictEqual([
        [
          { identity: CY, quietDays: 60, recipients: [ADA] },
          { identity: MATT, quietDays: 60, recipients: [ADA] },
        ],
        [
          { identity: CY, quietDays: 90, recipients: [ADA] },
          { identity: MATT, quietDays: 90, recipients: [ADA] },
        ],
        [
          { identity: CY, quietDays: 120, recipients: [ADA] },
          { identity: MATT, quietDays: 120, recipients: [ADA] },
        ],
      ]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): a person's activity at the moment their offer is raised clears the offer",
  ({ layer }) =>
    Effect.gen(function* clearedAtTheSameMoment() {
      yield* TestClock.setTime(DateTime.toEpochMillis(DateTime.makeUnsafe(CREATED)));
      const storage = yield* people(layer);
      yield* Effect.forEach([HELPER, IDLE], (agent) => storage.deactivateIdentity(agent), { concurrency: 1 });
      yield* storage.raiseDueDeactivationOffers(JAN_31, quietAgentDays);
      yield* seenOffline(storage, CY, JAN_31);
      const open = yield* storage.listDeactivationOffers(ADA, "open");
      const settled = yield* storage.raiseDueDeactivationOffers(JAN_31, quietAgentDays);

      expect(Arr.map(open, ({ identity }) => identity)).toStrictEqual([BEA, MATT]);
      expect(Arr.map(settled.cleared, ({ identity, raisedAt }) => ({ identity, raisedAt }))).toStrictEqual([
        { identity: CY, raisedAt: JAN_31 },
      ]);
    }),
);
