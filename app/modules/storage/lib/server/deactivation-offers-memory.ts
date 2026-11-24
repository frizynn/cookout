import type { ActivityRecords, DeactivationOffersSection, OfferSources } from "./deactivation-offers.ts";
import { Array as Arr, DateTime, Effect, Option, Ref } from "effect";
import type { AutomaticDeactivationId, DeactivationOfferId } from "../../../inbox/index.ts";
import type {
  AutomaticDeactivationRecords,
  AutomaticDeactivationsSection,
  StoredAutomaticDeactivation,
} from "./automatic-deactivations.ts";
import { automaticDeactivationsOn, deactivatingWith } from "./automatic-deactivations.ts";
import { boardOn, deactivationOffersOn } from "./deactivation-offers.ts";
import { isAutomaticDeactivationId, isDeactivationOfferId } from "../../../inbox/index.ts";
import type { IdentityName } from "../../../identities/index.ts";
import type { IsoTime } from "../../../time/index.ts";
import type { OfferRecord } from "./deactivation-offer-board.ts";
import type { Scope } from "effect";
import { isoTimeOf } from "../../../time/server.ts";
import { openMemoryState } from "./memory-state.ts";

interface Kept {
  readonly last: number;
  readonly offers: readonly OfferRecord[];
  readonly activity: ReadonlyMap<IdentityName, IsoTime>;
}

const NEXT = 1;
const EMPTY: Kept = { activity: new Map(), last: 0, offers: [] };

function asEntryId(value: number): AutomaticDeactivationId {
  return Option.getOrThrow(Option.liftPredicate(value, isAutomaticDeactivationId));
}

function asOfferId(value: number): DeactivationOfferId {
  return Option.getOrThrow(Option.liftPredicate(value, isDeactivationOfferId));
}

function inserted(data: Kept, record: Omit<OfferRecord, "id" | "cleared">): readonly [OfferRecord, Kept] {
  const stored: OfferRecord = { ...record, cleared: false, id: asOfferId(data.last + NEXT) };
  return [stored, { ...data, last: data.last + NEXT, offers: [...data.offers, stored] }];
}

function clearedIn(data: Kept, ids: readonly DeactivationOfferId[]): Kept {
  const offers = Arr.map(data.offers, (record) => {
    if (ids.includes(record.id)) {
      return { ...record, cleared: true };
    }
    return record;
  });
  return { ...data, offers };
}

function activityIn(data: Kept, identity: IdentityName, at: IsoTime): Kept {
  const before = data.activity.get(identity) ?? at;
  if (before > at) {
    return data;
  }
  return { ...data, activity: new Map([...data.activity, [identity, at]]) };
}

function memoryActivityRecords(): Effect.Effect<ActivityRecords, never, Scope.Scope> {
  return Effect.gen(function* openActivityRecords() {
    const state = yield* openMemoryState;
    const opened = yield* DateTime.now;
    const since = isoTimeOf(opened);
    const kept = yield* Ref.make(EMPTY);
    const read = Effect.andThen(state.ensureOpen, Ref.get(kept));
    function change(work: (data: Kept) => Kept): Effect.Effect<void, Effect.Error<typeof state.ensureOpen>> {
      return Effect.andThen(state.ensureOpen, Ref.update(kept, work));
    }
    return {
      activity: Effect.map(read, ({ activity }) => activity),
      clear: (ids) => change((data) => clearedIn(data, ids)),
      insert: (record) =>
        Effect.andThen(
          state.ensureOpen,
          Ref.modify(kept, (data) => inserted(data, record)),
        ),
      offers: Effect.map(read, ({ offers }) => offers),
      recordActivity: (identity, at) => change((data) => activityIn(data, identity, at)),
      since: Effect.as(state.ensureOpen, since),
    };
  });
}

function memoryAutomaticDeactivationRecords(): Effect.Effect<AutomaticDeactivationRecords, never, Scope.Scope> {
  return Effect.gen(function* openAutomaticDeactivationRecords() {
    const state = yield* openMemoryState;
    const kept = yield* Ref.make<readonly StoredAutomaticDeactivation[]>([]);
    return {
      automaticDeactivations: Effect.andThen(state.ensureOpen, Ref.get(kept)),
      insert: (record) =>
        Effect.andThen(
          state.ensureOpen,
          Ref.modify(kept, (all) => {
            const stored: StoredAutomaticDeactivation = { ...record, id: asEntryId(all.length + NEXT), read: false };
            return [stored, [...all, stored]] as const;
          }),
        ),
      markRead: (ids) =>
        Effect.andThen(
          state.ensureOpen,
          Ref.update(kept, (all) =>
            Arr.map(all, (record) => ({ ...record, read: record.read || ids.includes(record.id) })),
          ),
        ),
    };
  });
}

function memoryDeactivationOffers(
  sources: OfferSources,
): Effect.Effect<DeactivationOffersSection & AutomaticDeactivationsSection, never, Scope.Scope> {
  return Effect.gen(function* openDeactivationOffers() {
    const records = yield* memoryActivityRecords();
    const entries = yield* memoryAutomaticDeactivationRecords();
    const on = {
      atomically: <Value, Failure>(work: Effect.Effect<Value, Failure>): Effect.Effect<Value, Failure> => work,
      records,
      sources,
    };
    return {
      ...deactivationOffersOn(on),
      ...automaticDeactivationsOn({
        board: boardOn(on),
        deactivate: deactivatingWith(sources.deactivateIdentity),
        records: entries,
      }),
    };
  });
}

export { memoryDeactivationOffers };
