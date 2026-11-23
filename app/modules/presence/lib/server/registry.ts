import { Array as Arr, DateTime, Effect, Predicate, PubSub, SynchronizedRef } from "effect";
import type { LiveConnectionDetail, Presence } from "../../index.ts";
import {
  connect,
  endBootGrace,
  endGrace,
  liveConnectionsIn,
  onlineAtStop,
  openBook,
  presenceIn,
  release,
} from "./book.ts";
import type { BookState } from "./book.ts";
import type { IdentityName } from "../../../identities/index.ts";
import type { IsoTime } from "../../../time/index.ts";
import type { Scope } from "effect";
import { Storage } from "../../../storage/server.ts";
import type { StoredPresence } from "../../../storage/server.ts";
import { isoTimeOf } from "../../../time/server.ts";

interface Registry {
  readonly hold: (identity: IdentityName, detail: LiveConnectionDetail) => Effect.Effect<void, never, Scope.Scope>;
  readonly presenceOf: (identity: IdentityName) => Effect.Effect<Presence>;
  readonly changed: Effect.Effect<PubSub.Subscription<Presence>, never, Scope.Scope>;
  readonly liveConnections: (identity: IdentityName) => Effect.Effect<number>;
}

interface Graces {
  readonly graceMillis: number;
  readonly bootGraceMillis: number;
}

interface Announce {
  readonly record: (presence: StoredPresence) => Effect.Effect<void>;
  readonly publish: (presence: Presence) => Effect.Effect<void>;
}

interface Book {
  readonly read: Effect.Effect<BookState>;
  readonly modify: <Result>(
    identity: IdentityName,
    update: (state: BookState) => readonly [Result, BookState],
  ) => Effect.Effect<Result>;
  readonly inBackground: (effect: Effect.Effect<void>) => Effect.Effect<void>;
}

const ONE_AT_A_TIME = { concurrency: 1, discard: true } as const;

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

function announced(announce: Announce, before: Presence, after: Presence): Effect.Effect<void> {
  return Effect.gen(function* announceChange() {
    if (before.online !== after.online) {
      const lastSeenAt = yield* lastSeenOf(after);
      yield* announce.record({ identity: after.identity, lastSeenAt, online: after.online });
    }
    if (!samePresence(before, after)) {
      yield* announce.publish(after);
    }
  });
}

function changed(book: Book, identity: IdentityName, update: (state: BookState) => BookState): Effect.Effect<void> {
  return Effect.asVoid(book.modify(identity, (state) => [true, update(state)] as const));
}

function closedLive(
  book: Book,
  graceMillis: number,
  identity: IdentityName,
): (connection: number) => Effect.Effect<void> {
  return (connection) =>
    Effect.gen(function* closeLive() {
      const closedAt = yield* now;
      yield* changed(book, identity, (state) => release({ closedAt, connection, identity, state }));
      const graceEnds = changed(book, identity, (state) => endGrace({ connection, identity, state }));
      yield* book.inBackground(Effect.andThen(Effect.sleep(graceMillis), graceEnds));
    });
}

function held(
  book: Book,
  graceMillis: number,
  { detail, identity }: { readonly detail: LiveConnectionDetail; readonly identity: IdentityName },
): Effect.Effect<void, never, Scope.Scope> {
  const opened = book.modify(identity, (state) => connect({ detail, identity, state }));
  return Effect.asVoid(Effect.acquireRelease(opened, closedLive(book, graceMillis, identity)));
}

function bootGraceEnds(book: Book, kept: readonly StoredPresence[]): Effect.Effect<void> {
  return Effect.forEach(
    kept,
    ({ identity }) => changed(book, identity, (state) => endBootGrace({ identity, state })),
    ONE_AT_A_TIME,
  );
}

function keptOnStop(book: Book, announce: Announce): Effect.Effect<void> {
  return Effect.gen(function* keepOnlineOnStop() {
    const stoppedAt = yield* now;
    const state = yield* book.read;
    yield* Effect.forEach(onlineAtStop({ state, stoppedAt }), announce.record, ONE_AT_A_TIME);
  });
}

function bookOf(announce: Announce, kept: readonly StoredPresence[]): Effect.Effect<Book, never, Scope.Scope> {
  return Effect.gen(function* openRegistryBook() {
    const scope = yield* Effect.scope;
    const ref = yield* SynchronizedRef.make(openBook(kept));
    return {
      inBackground: (effect) => Effect.asVoid(Effect.forkIn(effect, scope)),
      modify: (identity, update) =>
        SynchronizedRef.modifyEffect(ref, (state) => {
          const [result, next] = update(state);
          const before = presenceIn({ identity, state });
          const announcing = announced(announce, before, presenceIn({ identity, state: next }));
          return Effect.as(announcing, [result, next] as const);
        }),
      read: SynchronizedRef.get(ref),
    };
  });
}

function openRegistry(graces: Graces): Effect.Effect<Registry, never, Storage | Scope.Scope> {
  return Effect.gen(function* openPresenceRegistry() {
    const storage = yield* Storage;
    const hub = yield* PubSub.unbounded<Presence>();
    const announce: Announce = {
      publish: (presence) => Effect.asVoid(PubSub.publish(hub, presence)),
      record: (presence) => Effect.ignore(storage.recordPresence(presence)),
    };
    const kept = yield* Effect.orElseSucceed(storage.listPresence, () => []);
    const book = yield* bookOf(announce, kept);
    const wereOnline = Arr.filter(kept, ({ online }) => online);
    yield* book.inBackground(Effect.andThen(Effect.sleep(graces.bootGraceMillis), bootGraceEnds(book, wereOnline)));
    yield* Effect.addFinalizer(() => keptOnStop(book, announce));
    return {
      changed: PubSub.subscribe(hub),
      hold: (identity, detail) => held(book, graces.graceMillis, { detail, identity }),
      liveConnections: (identity) => Effect.map(book.read, (state) => liveConnectionsIn({ identity, state })),
      presenceOf: (identity) => Effect.map(book.read, (state) => presenceIn({ identity, state })),
    };
  });
}

export { type Registry, openRegistry };
