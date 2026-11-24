import { Array as Arr, DateTime, Duration, Option, Order, Predicate } from "effect";
import type { Identity, IdentityName } from "../../../identities/index.ts";
import type { DeactivationOfferId } from "../../../inbox/index.ts";
import type { IsoTime } from "../../../time/index.ts";
import { isoTimeOf } from "../../../time/server.ts";

interface QuietDays {
  readonly offer: number;
  readonly automaticDeactivation: number;
}

interface OfferRecord {
  readonly id: DeactivationOfferId;
  readonly identity: IdentityName;
  readonly recipients: readonly IdentityName[];
  readonly raisedAt: IsoTime;
  readonly quietDays: number;
  readonly cleared: boolean;
}

interface Board {
  readonly identities: readonly Identity[];
  readonly online: ReadonlySet<IdentityName>;
  readonly activity: ReadonlyMap<IdentityName, IsoTime>;
  readonly since: IsoTime;
  readonly offers: readonly OfferRecord[];
}

interface Due {
  readonly at: IsoTime;
  readonly identity: Identity;
  readonly quietDays: number;
}

type DueDeactivation = Omit<Due, "quietDays">;

interface Dating {
  readonly board: Board;
  readonly days: QuietDays;
}

interface Quiet {
  readonly identity: Identity;
  readonly quietSince: IsoTime;
  readonly latest: OfferRecord | undefined;
}

interface Regarding {
  readonly board: Board;
  readonly identity: Identity;
}

const byAt: Order.Order<DueDeactivation> = Order.mapInput(Order.String, (due: DueDeactivation) => due.at);

function later(at: IsoTime, days: number): IsoTime {
  return isoTimeOf(DateTime.addDuration(DateTime.makeUnsafe(at), Duration.days(days)));
}

function laterOf(left: IsoTime, right: IsoTime): IsoTime {
  if (right > left) {
    return right;
  }
  return left;
}

function isActive(identity: Identity): boolean {
  return identity.deactivated !== true;
}

function ownLastActivityIn({
  board,
  identity,
}: {
  readonly board: Pick<Board, "activity" | "since">;
  readonly identity: Identity;
}): IsoTime {
  const recorded = board.activity.get(identity.name) ?? identity.createdAt;
  return laterOf(laterOf(identity.createdAt, board.since), recorded);
}

function activeAgentsOf({ board, identity }: Regarding): readonly Identity[] {
  if (identity.kind !== "human") {
    return [];
  }
  return Arr.filter(
    board.identities,
    (each) => each.kind === "agent" && each.owner === identity.name && isActive(each),
  );
}

function lastActivityIn(regarding: Regarding): IsoTime {
  return Arr.reduce(activeAgentsOf(regarding), ownLastActivityIn(regarding), (latest, agent) =>
    laterOf(latest, ownLastActivityIn({ board: regarding.board, identity: agent })),
  );
}

function identityIn(board: Board, name: IdentityName): Identity | undefined {
  return Arr.findFirst(board.identities, (identity) => identity.name === name).pipe(Option.getOrUndefined);
}

function recipientsOf({ board, identity }: Regarding): readonly IdentityName[] {
  if (identity.kind === "agent") {
    const owner = identityIn(board, identity.owner);
    if (Predicate.isNotUndefined(owner) && isActive(owner)) {
      return [owner.name];
    }
  }
  const admins = Arr.filter(board.identities, (each) => each.admin && isActive(each) && each.name !== identity.name);
  return Arr.map(admins, ({ name }) => name);
}

function isQuiet(board: Board, identity: Identity | undefined): identity is Identity {
  if (
    Predicate.isUndefined(identity) ||
    !isActive(identity) ||
    Arr.isReadonlyArrayEmpty(recipientsOf({ board, identity }))
  ) {
    return false;
  }
  return !Arr.some([identity, ...activeAgentsOf({ board, identity })], ({ name }) => board.online.has(name));
}

function isOpen({ board, record }: { readonly board: Board; readonly record: OfferRecord }): boolean {
  const identity = identityIn(board, record.identity);
  if (record.cleared || !isQuiet(board, identity)) {
    return false;
  }
  return lastActivityIn({ board, identity }) < record.raisedAt;
}

function latestOffer(board: Board, identity: IdentityName): OfferRecord | undefined {
  return Arr.findLast(board.offers, (record) => record.identity === identity).pipe(Option.getOrUndefined);
}

function nextOf({ identity, latest, quietSince }: Quiet, days: QuietDays): readonly Due[] {
  if (Predicate.isUndefined(latest) || latest.raisedAt <= quietSince) {
    return [{ at: later(quietSince, days.offer), identity, quietDays: days.offer }];
  }
  const quietDays = latest.quietDays + days.offer;
  if (identity.kind === "agent" && quietDays >= days.automaticDeactivation) {
    return [];
  }
  return [{ at: later(latest.raisedAt, days.offer), identity, quietDays }];
}

function dueOf(board: Board, days: QuietDays): (identity: Identity) => readonly Due[] {
  return (identity) => {
    if (!isQuiet(board, identity)) {
      return [];
    }
    return nextOf(
      { identity, latest: latestOffer(board, identity.name), quietSince: lastActivityIn({ board, identity }) },
      days,
    );
  };
}

function dueOffers({ board, days }: Dating): readonly Due[] {
  return Arr.sort(Arr.flatMap(board.identities, dueOf(board, days)), byAt);
}

function deactivationDueOf(board: Board, days: QuietDays): (identity: Identity) => readonly DueDeactivation[] {
  return (identity) => {
    if (identity.kind !== "agent" || !isQuiet(board, identity)) {
      return [];
    }
    return [{ at: later(lastActivityIn({ board, identity }), days.automaticDeactivation), identity }];
  };
}

function dueDeactivations({ board, days }: Dating): readonly DueDeactivation[] {
  return Arr.sort(Arr.flatMap(board.identities, deactivationDueOf(board, days)), byAt);
}

function nextDueIn({ board, days }: Dating): IsoTime | null {
  const soonest = Arr.head(Arr.sort([...dueOffers({ board, days }), ...dueDeactivations({ board, days })], byAt));
  return Option.getOrNull(Option.map(soonest, ({ at }) => at));
}

export {
  type Board,
  type Due,
  type DueDeactivation,
  type OfferRecord,
  type QuietDays,
  dueDeactivations,
  dueOffers,
  isOpen,
  lastActivityIn,
  nextDueIn,
  recipientsOf,
};
