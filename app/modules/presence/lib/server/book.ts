import { Array as Arr, Option, Predicate } from "effect";
import type { LiveConnectionDetail, Presence } from "../../index.ts";
import type { IdentityName } from "../../../identities/index.ts";
import type { IsoTime } from "../../../time/index.ts";
import type { StoredPresence } from "../../../storage/server.ts";

interface Grace {
  readonly closedAt: IsoTime;
  readonly closing: number;
}

interface Held {
  readonly connections: ReadonlyMap<number, LiveConnectionDetail>;
  readonly latest: Option.Option<LiveConnectionDetail>;
  readonly grace: Option.Option<Grace>;
}

interface BookState {
  readonly held: ReadonlyMap<IdentityName, Held>;
  readonly lastSeen: ReadonlyMap<IdentityName, IsoTime>;
  readonly onBootGrace: ReadonlySet<IdentityName>;
  readonly nextConnection: number;
}

interface At {
  readonly state: BookState;
  readonly identity: IdentityName;
}

interface Connecting extends At {
  readonly detail: LiveConnectionDetail;
}

interface Closing extends At {
  readonly connection: number;
}

interface Released extends Closing {
  readonly closedAt: IsoTime;
}

const NONE = 0;
const STEP = 1;
const NOT_HELD: Held = { connections: new Map(), grace: Option.none(), latest: Option.none() };

function heldBy({ identity, state }: At): Held {
  return state.held.get(identity) ?? NOT_HELD;
}

function withHeld({ identity, state }: At, held: Held): BookState {
  return { ...state, held: new Map([...state.held, [identity, held]]) };
}

function withoutBootGrace({ identity, state }: At): ReadonlySet<IdentityName> {
  const left = new Set(state.onBootGrace);
  left.delete(identity);
  return left;
}

function isLive(held: Held): boolean {
  return held.connections.size > NONE || Option.isSome(held.grace);
}

function onlinePresence(identity: IdentityName, latest: Option.Option<LiveConnectionDetail>): Presence {
  return Option.match(latest, {
    onNone: () => ({ identity, online: true }),
    onSome: (connection) => ({ connection, identity, online: true }),
  });
}

function offlinePresence(identity: IdentityName, lastSeenAt: IsoTime | undefined): Presence {
  if (Predicate.isUndefined(lastSeenAt)) {
    return { identity, online: false };
  }
  return { identity, lastSeenAt, online: false };
}

function openBook(kept: readonly StoredPresence[]): BookState {
  const wereOnline = Arr.filter(kept, ({ online }) => online);
  return {
    held: new Map(),
    lastSeen: new Map(Arr.map(kept, ({ identity, lastSeenAt }) => [identity, lastSeenAt] as const)),
    nextConnection: STEP,
    onBootGrace: new Set(Arr.map(wereOnline, ({ identity }) => identity)),
  };
}

function presenceIn(at: At): Presence {
  const held = heldBy(at);
  if (isLive(held)) {
    return onlinePresence(at.identity, held.latest);
  }
  if (at.state.onBootGrace.has(at.identity)) {
    return onlinePresence(at.identity, Option.none());
  }
  return offlinePresence(at.identity, at.state.lastSeen.get(at.identity));
}

function connect(connecting: Connecting): readonly [number, BookState] {
  const connection = connecting.state.nextConnection;
  const connections = new Map([...heldBy(connecting).connections, [connection, connecting.detail]]);
  const next = withHeld(connecting, { connections, grace: Option.none(), latest: Option.some(connecting.detail) });
  return [connection, { ...next, nextConnection: connection + STEP, onBootGrace: withoutBootGrace(connecting) }];
}

function release(released: Released): BookState {
  const held = heldBy(released);
  const connections = new Map(held.connections);
  connections.delete(released.connection);
  if (connections.size > NONE) {
    return withHeld(released, { ...held, connections });
  }
  const grace = Option.some({ closedAt: released.closedAt, closing: released.connection });
  return withHeld(released, { ...held, connections, grace });
}

function endGrace(closing: Closing): BookState {
  const held = heldBy(closing);
  const ending = Option.filter(
    held.grace,
    (grace) => grace.closing === closing.connection && held.connections.size === NONE,
  );
  return Option.match(ending, {
    onNone: () => closing.state,
    onSome: ({ closedAt }) => {
      const lastSeen = new Map([...closing.state.lastSeen, [closing.identity, closedAt]]);
      return { ...withHeld(closing, { ...held, grace: Option.none() }), lastSeen };
    },
  });
}

function endBootGrace(at: At): BookState {
  return { ...at.state, onBootGrace: withoutBootGrace(at) };
}

function forget(at: At): BookState {
  const held = new Map(at.state.held);
  held.delete(at.identity);
  const lastSeen = new Map(at.state.lastSeen);
  lastSeen.delete(at.identity);
  return { ...at.state, held, lastSeen, onBootGrace: withoutBootGrace(at) };
}

function liveConnectionsIn(at: At): number {
  return heldBy(at).connections.size;
}

function heldAtStop(identity: IdentityName, state: BookState): readonly StoredPresence[] {
  return Option.match(heldBy({ identity, state }).grace, {
    onNone: () => [],
    onSome: ({ closedAt }) => [{ identity, lastSeenAt: closedAt, online: true }],
  });
}

function onlineAtStop(state: BookState): readonly StoredPresence[] {
  return Arr.flatMap([...state.held.keys()], (identity) => heldAtStop(identity, state));
}

export {
  type BookState,
  connect,
  endBootGrace,
  endGrace,
  forget,
  liveConnectionsIn,
  onlineAtStop,
  openBook,
  presenceIn,
  release,
};
