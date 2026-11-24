import { Array as Arr, Effect, Option, Predicate } from "effect";
import type { Board, Due, OfferRecord, QuietDays } from "./deactivation-offer-board.ts";
import { dueOffers, isOpen, lastActivityIn, nextDueIn, recipientsOf } from "./deactivation-offer-board.ts";
import type { DeactivationOfferId } from "../../../inbox/index.ts";
import type { IdentitiesSection } from "./identities.ts";
import type { IdentityName } from "../../../identities/index.ts";
import type { IsoTime } from "../../../time/index.ts";
import type { PresenceSection } from "./presence.ts";
import type { RecordActivity } from "./activity.ts";
import type { StorageUnavailable } from "./errors.ts";

type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

type NewOfferRecord = Omit<OfferRecord, "id" | "cleared">;

type StoredDeactivationOffer = OfferRecord;

interface OfferChanges {
  readonly raised: readonly StoredDeactivationOffer[];
  readonly cleared: readonly StoredDeactivationOffer[];
}

interface ActivityRecords {
  readonly since: Effect.Effect<IsoTime, StorageUnavailable>;
  readonly activity: Effect.Effect<ReadonlyMap<IdentityName, IsoTime>, StorageUnavailable>;
  readonly recordActivity: RecordActivity;
  readonly offers: Effect.Effect<readonly OfferRecord[], StorageUnavailable>;
  readonly insert: (record: NewOfferRecord) => Fails<OfferRecord>;
  readonly clear: (ids: readonly DeactivationOfferId[]) => Fails<void>;
}

interface DeactivationOffersSection {
  readonly recordActivity: RecordActivity;
  readonly lastActivityOf: (identity: IdentityName) => Fails<IsoTime | null>;
  readonly nextDeactivationOfferDue: (days: QuietDays) => Fails<IsoTime | null>;
  readonly raiseDueDeactivationOffers: (now: IsoTime, days: QuietDays) => Fails<OfferChanges>;
  readonly listDeactivationOffers: (
    recipient: IdentityName,
    which: "open" | "all",
  ) => Fails<readonly StoredDeactivationOffer[]>;
  readonly keepDeactivationOffer: (
    recipient: IdentityName,
    id: DeactivationOfferId,
  ) => Fails<StoredDeactivationOffer | null>;
  readonly keepDeactivationOffersUpTo: (
    recipient: IdentityName,
    upTo: DeactivationOfferId,
  ) => Fails<readonly StoredDeactivationOffer[]>;
}

type OfferSources = Pick<IdentitiesSection, "listIdentities" | "deactivateIdentity"> &
  Pick<PresenceSection, "listPresence">;

interface OffersOn {
  readonly records: ActivityRecords;
  readonly sources: OfferSources;
  readonly atomically: (
    work: Effect.Effect<OfferChanges, StorageUnavailable>,
  ) => Effect.Effect<OfferChanges, StorageUnavailable>;
}

interface Kept {
  readonly matched: readonly StoredDeactivationOffer[];
  readonly cleared: readonly StoredDeactivationOffer[];
}

const ONE_AT_A_TIME = { concurrency: 1 } as const;

function asCleared(record: OfferRecord): StoredDeactivationOffer {
  return { ...record, cleared: true };
}

function onlineIn(presence: Effect.Success<ReturnType<OfferSources["listPresence"]>>): ReadonlySet<IdentityName> {
  return new Set(Arr.flatMap(presence, ({ identity, online }) => Arr.filter([identity], () => online)));
}

function boardOn({ records, sources }: Pick<OffersOn, "records" | "sources">): Fails<Board> {
  return Effect.gen(function* readBoard() {
    const identities = yield* sources.listIdentities();
    const presence = yield* sources.listPresence(Arr.map(identities, ({ name }) => name));
    const activity = yield* records.activity;
    const since = yield* records.since;
    const offers = yield* records.offers;
    return { activity, identities, offers, online: onlineIn(presence), since };
  });
}

function settled(on: OffersOn, board: Board): Fails<readonly StoredDeactivationOffer[]> {
  const stale = Arr.filter(board.offers, (record) => !record.cleared && !isOpen({ board, record }));
  return Effect.as(on.records.clear(Arr.map(stale, ({ id }) => id)), Arr.map(stale, asCleared));
}

function raiseOne(on: OffersOn, board: Board, now: IsoTime): (due: Due) => Fails<OfferChanges> {
  return ({ identity, quietDays }) =>
    Effect.gen(function* raiseOffer() {
      const replaced = Arr.filter(
        board.offers,
        (record) => record.identity === identity.name && isOpen({ board, record }),
      );
      yield* on.records.clear(Arr.map(replaced, ({ id }) => id));
      const recipients = recipientsOf({ board, identity });
      const raised = yield* on.records.insert({ identity: identity.name, quietDays, raisedAt: now, recipients });
      return { cleared: Arr.map(replaced, asCleared), raised: [raised] };
    });
}

function raiseDue(on: OffersOn, now: IsoTime, days: QuietDays): Fails<OfferChanges> {
  return Effect.gen(function* raiseDueOffers() {
    const board = yield* boardOn(on);
    const stale = yield* settled(on, board);
    const ready = Arr.filter(dueOffers({ board, days }), ({ at }) => at <= now);
    const changes = yield* Effect.forEach(ready, raiseOne(on, board, now), ONE_AT_A_TIME);
    return {
      cleared: [...stale, ...Arr.flatMap(changes, ({ cleared }) => cleared)],
      raised: Arr.flatMap(changes, ({ raised }) => raised),
    };
  });
}

function offeredTo(recipient: IdentityName): (record: OfferRecord) => boolean {
  return (record) => record.recipients.includes(recipient);
}

function listed(on: OffersOn, recipient: IdentityName): Fails<readonly StoredDeactivationOffer[]> {
  return Effect.map(boardOn(on), (board) =>
    Arr.map(Arr.filter(board.offers, offeredTo(recipient)), (record) => ({
      ...record,
      cleared: !isOpen({ board, record }),
    })),
  );
}

function keepWhere(on: OffersOn, recipient: IdentityName, kept: (record: OfferRecord) => boolean): Fails<Kept> {
  return Effect.gen(function* keepOffers() {
    const board = yield* boardOn(on);
    const matched = Arr.filter(board.offers, (record) => offeredTo(recipient)(record) && kept(record));
    const clearing = Arr.filter(matched, (record) => isOpen({ board, record }));
    yield* on.records.clear(Arr.map(clearing, ({ id }) => id));
    return { cleared: Arr.map(clearing, asCleared), matched: Arr.map(matched, asCleared) };
  });
}

function lastActivityOf(on: OffersOn, name: IdentityName): Fails<IsoTime | null> {
  return Effect.map(boardOn(on), (board) => {
    const identity = Arr.findFirst(board.identities, (each) => each.name === name).pipe(Option.getOrUndefined);
    if (Predicate.isUndefined(identity)) {
      return null;
    }
    return lastActivityIn({ board, identity });
  });
}

function deactivationOffersOn(on: OffersOn): DeactivationOffersSection {
  return {
    keepDeactivationOffer: (recipient, id) =>
      Effect.map(
        keepWhere(on, recipient, (record) => record.id === id),
        ({ matched }) => Option.getOrNull(Arr.head(matched)),
      ),
    keepDeactivationOffersUpTo: (recipient, upTo) =>
      Effect.map(
        keepWhere(on, recipient, (record) => record.id <= upTo),
        ({ cleared }) => cleared,
      ),
    lastActivityOf: (name) => lastActivityOf(on, name),
    listDeactivationOffers: (recipient, which) =>
      Effect.map(listed(on, recipient), (all) => Arr.filter(all, (offer) => which === "all" || !offer.cleared)),
    nextDeactivationOfferDue: (days) => Effect.map(boardOn(on), (board) => nextDueIn({ board, days })),
    raiseDueDeactivationOffers: (now, days) => on.atomically(raiseDue(on, now, days)),
    recordActivity: on.records.recordActivity,
  };
}

export {
  type ActivityRecords,
  type DeactivationOffersSection,
  type OfferChanges,
  type OfferSources,
  type StoredDeactivationOffer,
  boardOn,
  deactivationOffersOn,
};
