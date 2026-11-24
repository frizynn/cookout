import { Array as Arr, Context, DateTime, Duration, Effect, Layer, PubSub, Queue, Schedule, Stream } from "effect";
import { Messages, Reactions } from "../../../messages/server.ts";
import type { StorageUnavailable, StoredNudge } from "../../../storage/server.ts";
import { nudgeIntervals, quietAgentDays } from "../../index.ts";
import { DeactivationOffers } from "./deactivation-offers.ts";
import { IdentityChanges } from "../../../identities/server.ts";
import type { IdentityName } from "../../../identities/index.ts";
import type { IsoTime } from "../../../time/index.ts";
import type { Nudge } from "../../index.ts";
import type { Scope } from "effect";
import { Storage } from "../../../storage/server.ts";
import { isoTimeOf } from "../../../time/server.ts";
import { shownNudges } from "./listing.ts";

interface RaisedNudge {
  readonly recipient: IdentityName;
  readonly nudge: Nudge;
}

interface NudgesService {
  readonly raised: Effect.Effect<PubSub.Subscription<RaisedNudge>, never, Scope.Scope>;
}

interface Scheduling {
  readonly storage: Storage["Service"];
  readonly offers: DeactivationOffers["Service"];
  readonly publish: (raised: readonly RaisedNudge[]) => Effect.Effect<void>;
  readonly woken: Effect.Effect<true>;
}

type WakeNeeds = Messages | Reactions | IdentityChanges | DeactivationOffers | Scope.Scope;

const RETRY_AFTER_TROUBLE = "1 minute";
const NO_WAIT = 0;
const ONE_WAKE_IS_ENOUGH = 1;

class Nudges extends Context.Service<Nudges, NudgesService>()(
  "@ai-hero/cookout/inbox/lib/server/nudge-scheduler/Nudges",
) {}

function soonest(left: IsoTime | null, right: IsoTime | null): IsoTime | null {
  if (left === null || (right !== null && right < left)) {
    return right;
  }
  return left;
}

function untilDue(next: IsoTime | null): Effect.Effect<void> {
  if (next === null) {
    return Effect.never;
  }
  return Effect.flatMap(DateTime.now, (now) => {
    const wait = DateTime.toEpochMillis(DateTime.makeUnsafe(next)) - DateTime.toEpochMillis(now);
    return Effect.sleep(Duration.millis(Math.max(wait, NO_WAIT)));
  });
}

function announced(
  storage: Storage["Service"],
  stored: StoredNudge,
): Effect.Effect<readonly RaisedNudge[], StorageUnavailable> {
  return Effect.map(shownNudges({ storage, stored: [stored] }), (shown) =>
    Arr.map(shown, ({ read: _read, ...nudge }) => ({ nudge, recipient: stored.recipient })),
  );
}

function raiseThenWait({ offers, publish, storage, woken }: Scheduling): Effect.Effect<void, StorageUnavailable> {
  return Effect.gen(function* raiseDueWork() {
    const now = yield* Effect.map(DateTime.now, isoTimeOf);
    const raised = yield* storage.raiseDueNudges(now, nudgeIntervals);
    const shown = yield* Effect.forEach(raised, (stored) => announced(storage, stored), { concurrency: 1 });
    yield* publish(Arr.flatten(shown));
    yield* offers.deactivateQuietAgents(now);
    const offered = yield* storage.raiseDueDeactivationOffers(now, quietAgentDays);
    yield* offers.publish(offered);
    const nextNudge = yield* storage.nextNudgeDue(nudgeIntervals);
    const nextOffer = yield* storage.nextDeactivationOfferDue(quietAgentDays);
    yield* Effect.raceFirst(untilDue(soonest(nextNudge, nextOffer)), woken);
  });
}

function wakeOn(wake: (signal: true) => Effect.Effect<boolean>): Effect.Effect<void, never, WakeNeeds> {
  return Effect.gen(function* listenForActivity() {
    const { identities, messages, offers, reactions } = yield* Effect.all(
      {
        identities: IdentityChanges,
        messages: Messages,
        offers: DeactivationOffers,
        reactions: Reactions,
      },
      { concurrency: 1 },
    );
    const posted = yield* messages.posted;
    const changed = yield* messages.threadChanged;
    const reacted = yield* reactions.changed;
    const identityChanged = yield* identities.changed;
    const presence = yield* offers.presenceChanges;
    const signals: readonly Stream.Stream<unknown>[] = [
      Stream.fromSubscription(posted),
      Stream.fromSubscription(changed),
      Stream.fromSubscription(reacted),
      Stream.fromSubscription(identityChanged),
      Stream.fromSubscription(presence),
    ];
    yield* Effect.forkScoped(
      Stream.runForEach(Stream.mergeAll(signals, { concurrency: "unbounded" }), () => wake(true)),
    );
  });
}

const nudgesLayer: Layer.Layer<Nudges, never, Storage | Exclude<WakeNeeds, Scope.Scope>> = Layer.effect(
  Nudges,
  Effect.gen(function* scheduleNudges() {
    const storage = yield* Storage;
    const offers = yield* DeactivationOffers;
    const hub = yield* PubSub.unbounded<RaisedNudge>();
    const wake = yield* Queue.sliding<true>(ONE_WAKE_IS_ENOUGH);
    yield* wakeOn((signal) => Queue.offer(wake, signal));
    function publish(raised: readonly RaisedNudge[]): Effect.Effect<void> {
      return Effect.asVoid(PubSub.publishAll(hub, raised));
    }
    const step = raiseThenWait({ offers, publish, storage, woken: Queue.take(wake) }).pipe(
      Effect.retry(Schedule.spaced(RETRY_AFTER_TROUBLE)),
    );
    yield* Effect.forkScoped(Effect.forever(step));
    return { raised: PubSub.subscribe(hub) };
  }),
);

export { Nudges, nudgesLayer };
