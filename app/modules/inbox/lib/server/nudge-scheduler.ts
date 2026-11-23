import { Array as Arr, Context, DateTime, Duration, Effect, Layer, PubSub, Queue, Stream } from "effect";
import type { StorageUnavailable, StoredNudge } from "../../../storage/server.ts";
import type { IdentityName } from "../../../identities/index.ts";
import type { IsoTime } from "../../../time/index.ts";
import { Messages } from "../../../messages/server.ts";
import type { Nudge } from "../../index.ts";
import type { Scope } from "effect";
import { Storage } from "../../../storage/server.ts";
import { isoTimeOf } from "../../../time/server.ts";
import { nudgeIntervals } from "../../index.ts";
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
  readonly publish: (raised: readonly RaisedNudge[]) => Effect.Effect<void>;
  readonly woken: Effect.Effect<true>;
}

const RETRY_AFTER_TROUBLE = "1 minute";
const NO_WAIT = 0;
const ONE_WAKE_IS_ENOUGH = 1;

class Nudges extends Context.Service<Nudges, NudgesService>()(
  "@ai-hero/cookout/inbox/lib/server/nudge-scheduler/Nudges",
) {}

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

function raiseThenWait({ publish, storage, woken }: Scheduling): Effect.Effect<void, StorageUnavailable> {
  return Effect.gen(function* raiseDueNudges() {
    const now = yield* DateTime.now;
    const raised = yield* storage.raiseDueNudges(isoTimeOf(now), nudgeIntervals);
    const shown = yield* Effect.forEach(raised, (stored) => announced(storage, stored), { concurrency: 1 });
    yield* publish(Arr.flatten(shown));
    const next = yield* storage.nextNudgeDue(nudgeIntervals);
    yield* Effect.raceFirst(untilDue(next), woken);
  });
}

function wakeOn(wake: (signal: true) => Effect.Effect<boolean>): Effect.Effect<void, never, Messages | Scope.Scope> {
  return Effect.gen(function* listenForActivity() {
    const messages = yield* Messages;
    const posted = yield* messages.posted;
    const changed = yield* messages.threadChanged;
    const activity = Stream.merge(Stream.fromSubscription(posted), Stream.fromSubscription(changed));
    yield* Effect.forkScoped(Stream.runForEach(activity, () => wake(true)));
  });
}

const nudgesLayer: Layer.Layer<Nudges, never, Storage | Messages> = Layer.effect(
  Nudges,
  Effect.gen(function* scheduleNudges() {
    const storage = yield* Storage;
    const hub = yield* PubSub.unbounded<RaisedNudge>();
    const wake = yield* Queue.sliding<true>(ONE_WAKE_IS_ENOUGH);
    yield* wakeOn((signal) => Queue.offer(wake, signal));
    function publish(raised: readonly RaisedNudge[]): Effect.Effect<void> {
      return Effect.asVoid(PubSub.publishAll(hub, raised));
    }
    const step = raiseThenWait({ publish, storage, woken: Queue.take(wake) }).pipe(
      Effect.catchTag("StorageUnavailable", () => Effect.sleep(RETRY_AFTER_TROUBLE)),
    );
    yield* Effect.forkScoped(Effect.forever(step));
    return { raised: PubSub.subscribe(hub) };
  }),
);

export { Nudges, type RaisedNudge, nudgesLayer };
