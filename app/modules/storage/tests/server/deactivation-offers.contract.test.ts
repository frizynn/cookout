import { Array as Arr, DateTime, Effect, Option, String as Str } from "effect";
import type { Storage, StorageUnavailable, StoredDeactivationOffer } from "../../../storage/server.ts";
import {
  appendTo,
  channelFixture as channel,
  identityFixture,
  identityName,
  isoTime,
  newMessageFixture,
  openStore,
  storageLayers,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { DeactivationOfferId } from "../../../inbox/index.ts";
import type { IsoTime } from "../../../time/index.ts";
import type { Layer } from "effect";
import type { Message } from "../../../messages/index.ts";
import { TestClock } from "effect/testing";
import { quietAgentDays } from "../../../inbox/index.ts";
import { tokenHash } from "../../../identities/index.ts";

const MATT = identityName("matt");
const ADA = identityName("ada");
const BEA = identityName("bea");
const SCOUT = identityName("matt/scout");
const HASH_LENGTH = 64;
const CREATED = isoTime("2026-01-01T00:00:00.000Z");
const JAN_10 = isoTime("2026-01-10T00:00:00.000Z");
const JAN_20 = isoTime("2026-01-20T00:00:00.000Z");
const JAN_31 = isoTime("2026-01-31T00:00:00.000Z");
const FEB_9 = isoTime("2026-02-09T00:00:00.000Z");
const MAR_2 = isoTime("2026-03-02T00:00:00.000Z");
const MAR_11 = isoTime("2026-03-11T00:00:00.000Z");
const APR_1 = isoTime("2026-04-01T00:00:00.000Z");
const MAY_1 = isoTime("2026-05-01T00:00:00.000Z");

interface Board {
  readonly storage: Storage["Service"];
  readonly postAt: (at: IsoTime) => Effect.Effect<Message>;
}

function hashOf(letter: string): ReturnType<typeof tokenHash> {
  return tokenHash(Str.repeat(HASH_LENGTH)(letter));
}

function everyPersonOnline(storage: Storage["Service"]): Effect.Effect<void, StorageUnavailable> {
  return Effect.flatMap(storage.listIdentities(), (identities) =>
    Effect.forEach(
      Arr.filter(identities, ({ kind }) => kind === "human"),
      ({ name }) => storage.recordPresence({ identity: name, lastSeenAt: CREATED, online: true }),
      { concurrency: 1, discard: true },
    ),
  );
}

function board<Failure, Needs>(
  layer: Layer.Layer<Storage, Failure, Needs>,
): Effect.Effect<Board, Failure | StorageUnavailable, Needs> {
  return Effect.gen(function* openBoard() {
    const { storage } = yield* openStore(layer);
    yield* storage.createChannel(channel("grill"));
    yield* storage.createIdentity(identityFixture("ada", { admin: true, kind: "human" }), hashOf("a"));
    yield* storage.createIdentity(identityFixture("bea", { admin: true, kind: "human" }), hashOf("b"));
    yield* storage.createIdentity(identityFixture("matt/scout", { owner: "matt" }), hashOf("c"));
    yield* everyPersonOnline(storage);
    const append = appendTo(storage);
    const byScout = { author: { name: "matt/scout", owner: "matt" } } as const;
    return {
      postAt: (at) => append({ ...newMessageFixture("grill", "still here", byScout), createdAt: at }),
      storage,
    };
  });
}

function idOf(offers: readonly StoredDeactivationOffer[]): DeactivationOfferId {
  return Option.getOrThrow(Option.map(Arr.head(offers), ({ id }) => id));
}

function summary(offers: readonly StoredDeactivationOffer[]): readonly unknown[] {
  return Arr.map(offers, ({ cleared, identity, quietDays, raisedAt, recipients }) => ({
    cleared,
    identity,
    quietDays,
    raisedAt,
    recipients,
  }));
}

it.effect.each(storageLayers)(
  "storage contract ($adapter): last activity starts at creation and moves forward on a post, a reaction and presence",
  ({ layer }) =>
    Effect.gen(function* lastActivity() {
      const { postAt, storage } = yield* board(layer);
      const created = yield* storage.lastActivityOf(SCOUT);
      const message = yield* postAt(JAN_10);
      yield* storage.addReaction({
        identity: SCOUT,
        messageId: message.id,
        notifiesAuthor: false,
        reactedAt: JAN_20,
        reaction: "thumbs_up",
      });
      const reacted = yield* storage.lastActivityOf(SCOUT);
      const seen = yield* Effect.andThen(
        storage.recordPresence({ identity: SCOUT, lastSeenAt: JAN_31, online: false }),
        storage.lastActivityOf(SCOUT),
      );
      const notBack = yield* Effect.andThen(postAt(JAN_10), storage.lastActivityOf(SCOUT));
      const nobody = yield* storage.lastActivityOf(identityName("nobody"));

      expect([created, reacted, seen, notBack, nobody]).toStrictEqual([CREATED, JAN_20, JAN_31, JAN_31, null]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): an active agent's offer falls due 30 days after its last activity, and nobody else's",
  ({ layer }) =>
    Effect.gen(function* nextDue() {
      const { postAt, storage } = yield* board(layer);
      const due = yield* storage.nextDeactivationOfferDue(quietAgentDays);
      yield* postAt(JAN_10);
      const afterPost = yield* storage.nextDeactivationOfferDue(quietAgentDays);
      yield* storage.recordPresence({ identity: SCOUT, lastSeenAt: JAN_20, online: true });
      const online = yield* storage.nextDeactivationOfferDue(quietAgentDays);
      yield* storage.recordPresence({ identity: SCOUT, lastSeenAt: JAN_20, online: false });
      yield* storage.deactivateIdentity(SCOUT);
      const deactivated = yield* storage.nextDeactivationOfferDue(quietAgentDays);

      expect([due, afterPost, online, deactivated]).toStrictEqual([JAN_31, FEB_9, null, null]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): a due offer is raised once for the owner, replaced 30 days on, and none at 90 days",
  ({ layer }) =>
    Effect.gen(function* raiseAndReplace() {
      const { storage } = yield* board(layer);
      function raise(at: IsoTime): ReturnType<typeof storage.raiseDueDeactivationOffers> {
        return storage.raiseDueDeactivationOffers(at, quietAgentDays);
      }
      const [early, first, again] = yield* Effect.all([raise(JAN_20), raise(JAN_31), raise(JAN_31)], {
        concurrency: 1,
      });
      const second = yield* storage.raiseDueDeactivationOffers(MAR_2, quietAgentDays);
      const none = yield* storage.nextDeactivationOfferDue(quietAgentDays);
      const third = yield* storage.raiseDueDeactivationOffers(MAY_1, quietAgentDays);
      const [open, all, admins] = yield* Effect.all(
        [
          storage.listDeactivationOffers(MATT, "open"),
          storage.listDeactivationOffers(MATT, "all"),
          storage.listDeactivationOffers(ADA, "all"),
        ],
        { concurrency: 1 },
      );

      expect([early, again, none, third]).toStrictEqual([
        { cleared: [], raised: [] },
        { cleared: [], raised: [] },
        null,
        { cleared: [], raised: [] },
      ]);
      expect([summary(first.raised), summary(second.raised), summary(second.cleared)]).toStrictEqual([
        [{ cleared: false, identity: SCOUT, quietDays: 30, raisedAt: JAN_31, recipients: [MATT] }],
        [{ cleared: false, identity: SCOUT, quietDays: 60, raisedAt: MAR_2, recipients: [MATT] }],
        [{ cleared: true, identity: SCOUT, quietDays: 30, raisedAt: JAN_31, recipients: [MATT] }],
      ]);
      expect([summary(open), Arr.map(all, ({ cleared }) => cleared), admins]).toStrictEqual([
        summary(second.raised),
        [true, false],
        [],
      ]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): activity or deactivation clears an offer, which the next raise reports",
  ({ layer }) =>
    Effect.gen(function* clearedByActivity() {
      const { postAt, storage } = yield* board(layer);
      yield* Effect.andThen(storage.raiseDueDeactivationOffers(JAN_31, quietAgentDays), postAt(FEB_9));
      const open = yield* storage.listDeactivationOffers(MATT, "open");
      const settled = yield* storage.raiseDueDeactivationOffers(FEB_9, quietAgentDays);
      const due = yield* storage.nextDeactivationOfferDue(quietAgentDays);
      const next = yield* storage.raiseDueDeactivationOffers(MAR_11, quietAgentDays);
      const afterDeactivation = yield* Effect.andThen(
        storage.deactivateIdentity(SCOUT),
        storage.raiseDueDeactivationOffers(APR_1, quietAgentDays),
      );

      expect([open, settled.raised, summary(settled.cleared)]).toStrictEqual([
        [],
        [],
        [{ cleared: true, identity: SCOUT, quietDays: 30, raisedAt: JAN_31, recipients: [MATT] }],
      ]);
      expect([due, Arr.map(next.raised, ({ raisedAt }) => raisedAt)]).toStrictEqual([MAR_11, [MAR_11]]);
      expect([afterDeactivation.raised, Arr.map(afterDeactivation.cleared, ({ raisedAt }) => raisedAt)]).toStrictEqual([
        [],
        [MAR_11],
      ]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): Keep clears a shared offer for every admin, and the next falls due 30 days after it",
  ({ layer }) =>
    Effect.gen(function* keepShared() {
      const { storage } = yield* board(layer);
      yield* storage.deactivateIdentity(MATT);
      const { raised } = yield* storage.raiseDueDeactivationOffers(JAN_31, quietAgentDays);
      const notMatts = yield* storage.keepDeactivationOffer(MATT, idOf(raised));
      const kept = yield* storage.keepDeactivationOffer(ADA, idOf(raised));
      const [adas, beas, due] = yield* Effect.all(
        [
          storage.listDeactivationOffers(ADA, "open"),
          storage.listDeactivationOffers(BEA, "all"),
          storage.nextDeactivationOfferDue(quietAgentDays),
        ],
        { concurrency: 1 },
      );

      expect([summary(raised), notMatts]).toStrictEqual([
        [{ cleared: false, identity: SCOUT, quietDays: 30, raisedAt: JAN_31, recipients: [ADA, BEA] }],
        null,
      ]);
      expect([
        Option.map(Option.fromNullishOr(kept), ({ cleared }) => cleared),
        adas,
        Arr.map(beas, ({ cleared }) => cleared),
        due,
      ]).toStrictEqual([Option.some(true), [], [true], MAR_2]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): keeping offers up to one clears only the open ones up to it",
  ({ layer }) =>
    Effect.gen(function* keepUpTo() {
      const { storage } = yield* board(layer);
      const { raised } = yield* storage.raiseDueDeactivationOffers(JAN_31, quietAgentDays);
      const cleared = yield* storage.keepDeactivationOffersUpTo(MATT, idOf(raised));
      const again = yield* storage.keepDeactivationOffersUpTo(MATT, idOf(raised));
      const others = yield* storage.keepDeactivationOffersUpTo(ADA, idOf(raised));

      expect([Arr.map(cleared, ({ id }) => id), again, others]).toStrictEqual([[idOf(raised)], [], []]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): an identity created before activity began is quiet only from then",
  ({ layer }) =>
    Effect.gen(function* beforeActivity() {
      yield* TestClock.setTime(DateTime.toEpochMillis(DateTime.makeUnsafe(JAN_10)));
      const { storage } = yield* board(layer);
      const [since, due] = yield* Effect.all(
        [storage.lastActivityOf(SCOUT), storage.nextDeactivationOfferDue(quietAgentDays)],
        { concurrency: 1 },
      );

      expect([since, due]).toStrictEqual([JAN_10, FEB_9]);
    }),
);

it.effect.each(storageLayers)(
  "storage contract ($adapter): an agent's activity at the moment its offer is raised clears the offer",
  ({ layer }) =>
    Effect.gen(function* clearedAtTheSameMoment() {
      yield* TestClock.setTime(DateTime.toEpochMillis(DateTime.makeUnsafe(CREATED)));
      const { postAt, storage } = yield* board(layer);
      const { raised } = yield* storage.raiseDueDeactivationOffers(JAN_31, quietAgentDays);
      yield* postAt(JAN_31);
      const open = yield* storage.listDeactivationOffers(MATT, "open");
      const settled = yield* storage.raiseDueDeactivationOffers(JAN_31, quietAgentDays);

      expect([Arr.map(raised, ({ raisedAt }) => raisedAt), open]).toStrictEqual([[JAN_31], []]);
      expect(Arr.map(settled.cleared, ({ id }) => id)).toStrictEqual([idOf(raised)]);
    }),
);
