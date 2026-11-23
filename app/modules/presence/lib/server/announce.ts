import type { BookState, End } from "./book.ts";
import { DateTime, Effect, Option, Predicate, PubSub } from "effect";
import type { OfflineReason, Presence } from "../../index.ts";
import type { Storage, StoredPresence } from "../../../storage/server.ts";
import { endIn, presenceIn } from "./book.ts";
import type { IsoTime } from "../../../time/index.ts";
import { OfflineAlerts } from "../../../inbox/server.ts";
import { isoTimeOf } from "../../../time/server.ts";

type IdentityName = Presence["identity"];

interface Turn {
  readonly alerts: OfflineAlerts["Service"];
  readonly was: Presence;
  readonly is: Presence;
  readonly end: End | undefined;
}

function unexpectedReason({ end, is, was }: Turn): Option.Option<OfflineReason> {
  if (!was.online || is.online) {
    return Option.none();
  }
  return Option.fromNullishOr(end).pipe(
    Option.filter(({ unexpected }) => unexpected),
    Option.flatMap(({ offlineReason }) => Option.fromNullishOr(offlineReason)),
  );
}

function alerting(turn: Turn): Effect.Effect<void> {
  if (!turn.was.online && turn.is.online) {
    return turn.alerts.backOnline(turn.is.identity);
  }
  return Option.match(unexpectedReason(turn), {
    onNone: () => Effect.void,
    onSome: (reason) => turn.alerts.raise(turn.is.identity, reason),
  });
}

interface Announce {
  readonly record: (presence: StoredPresence) => Effect.Effect<void>;
  readonly publish: (presence: Presence) => Effect.Effect<void>;
  readonly alerts: OfflineAlerts["Service"];
}

interface Change {
  readonly before: BookState;
  readonly after: BookState;
  readonly identity: IdentityName;
}

const now: Effect.Effect<IsoTime> = Effect.map(DateTime.now, isoTimeOf);

function connectionKey(connection: Presence["connection"]): string {
  if (Predicate.isUndefined(connection)) {
    return "";
  }
  if (connection.via === "web") {
    return "web";
  }
  return `watch ${connection.host ?? ""}`;
}

function samePresence(left: Presence, right: Presence): boolean {
  return (
    left.online === right.online &&
    left.lastSeenAt === right.lastSeenAt &&
    left.offlineReason === right.offlineReason &&
    connectionKey(left.connection) === connectionKey(right.connection)
  );
}

function lastSeenOf(presence: Presence): Effect.Effect<IsoTime> {
  const { lastSeenAt } = presence;
  if (presence.online || Predicate.isUndefined(lastSeenAt)) {
    return now;
  }
  return Effect.succeed(lastSeenAt);
}

function announced({
  after,
  announce,
  before,
  identity,
}: Change & { readonly announce: Announce }): Effect.Effect<void> {
  return Effect.gen(function* announceChange() {
    const was = presenceIn({ identity, state: before });
    const is = presenceIn({ identity, state: after });
    if (was.online !== is.online || before.ends.get(identity) !== after.ends.get(identity)) {
      const lastSeenAt = yield* lastSeenOf(is);
      yield* announce.record({ identity, lastSeenAt, online: is.online, ...endIn({ identity, state: after }) });
    }
    if (!samePresence(was, is)) {
      yield* announce.publish(is);
    }
    yield* alerting({ alerts: announce.alerts, end: after.ends.get(identity), is, was });
  });
}

function announcer(
  storage: Storage["Service"],
): Effect.Effect<Announce & { readonly hub: PubSub.PubSub<Presence> }, never, OfflineAlerts> {
  return Effect.gen(function* openAnnouncer() {
    const hub = yield* PubSub.unbounded<Presence>();
    const alerts = yield* OfflineAlerts;
    return {
      alerts,
      hub,
      publish: (presence) => Effect.asVoid(PubSub.publish(hub, presence)),
      record: (presence) => Effect.ignore(storage.recordPresence(presence)),
    };
  });
}

type AnnounceNeeds = OfflineAlerts;

export { type Announce, type AnnounceNeeds, announced, announcer, now };
