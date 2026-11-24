import type { AgentIdentity, Identity, IdentityName } from "../../../identities/index.ts";
import { Array as Arr, DateTime, Duration, Option, Order, Predicate } from "effect";
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
  readonly agent: AgentIdentity;
  readonly quietDays: number;
}

interface Dating {
  readonly board: Board;
  readonly days: QuietDays;
}

interface Quiet {
  readonly agent: AgentIdentity;
  readonly quietSince: IsoTime;
  readonly latest: OfferRecord | undefined;
}

const byAt: Order.Order<Due> = Order.mapInput(Order.String, (due: Due) => due.at);

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

function lastActivityIn({
  board,
  identity,
}: {
  readonly board: Pick<Board, "activity" | "since">;
  readonly identity: Identity;
}): IsoTime {
  const recorded = board.activity.get(identity.name) ?? identity.createdAt;
  return laterOf(laterOf(identity.createdAt, board.since), recorded);
}

function identityIn(board: Board, name: IdentityName): Identity | undefined {
  return Arr.findFirst(board.identities, (identity) => identity.name === name).pipe(Option.getOrUndefined);
}

function isQuietAgent(board: Board, identity: Identity | undefined): identity is Identity {
  return Predicate.isNotUndefined(identity) && isActive(identity) && !board.online.has(identity.name);
}

function isOpen({ board, record }: { readonly board: Board; readonly record: OfferRecord }): boolean {
  const identity = identityIn(board, record.identity);
  if (record.cleared || !isQuietAgent(board, identity)) {
    return false;
  }
  return lastActivityIn({ board, identity }) <= record.raisedAt;
}

function latestOffer(board: Board, identity: IdentityName): OfferRecord | undefined {
  return Arr.findLast(board.offers, (record) => record.identity === identity).pipe(Option.getOrUndefined);
}

function nextOf({ agent, latest, quietSince }: Quiet, days: QuietDays): readonly Due[] {
  if (Predicate.isUndefined(latest) || latest.raisedAt < quietSince) {
    return [{ agent, at: later(quietSince, days.offer), quietDays: days.offer }];
  }
  const quietDays = latest.quietDays + days.offer;
  if (quietDays >= days.automaticDeactivation) {
    return [];
  }
  return [{ agent, at: later(latest.raisedAt, days.offer), quietDays }];
}

function dueOf(board: Board, days: QuietDays): (agent: Identity) => readonly Due[] {
  return (agent) => {
    if (agent.kind !== "agent" || !isQuietAgent(board, agent)) {
      return [];
    }
    return nextOf(
      { agent, latest: latestOffer(board, agent.name), quietSince: lastActivityIn({ board, identity: agent }) },
      days,
    );
  };
}

function dueOffers({ board, days }: Dating): readonly Due[] {
  return Arr.sort(Arr.flatMap(board.identities, dueOf(board, days)), byAt);
}

function nextDueIn({ board, days }: Dating): IsoTime | null {
  const soonest = Arr.head(dueOffers({ board, days }));
  return Option.getOrNull(Option.map(soonest, ({ at }) => at));
}

function recipientsOf({
  agent,
  board,
}: {
  readonly board: Board;
  readonly agent: AgentIdentity;
}): readonly IdentityName[] {
  const owner = identityIn(board, agent.owner);
  if (Predicate.isNotUndefined(owner) && isActive(owner)) {
    return [owner.name];
  }
  const admins = Arr.filter(board.identities, (identity) => identity.admin && isActive(identity));
  return Arr.map(admins, ({ name }) => name);
}

export {
  type Board,
  type Due,
  type OfferRecord,
  type QuietDays,
  dueOffers,
  isOpen,
  lastActivityIn,
  nextDueIn,
  recipientsOf,
};
