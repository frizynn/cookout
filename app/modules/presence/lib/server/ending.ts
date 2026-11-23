import { Array as Arr, Option } from "effect";
import type { At, BookState, Closing, Connection, End } from "./book.ts";
import { endedAs, heldAs, heldBy, presenceIn, withoutBootGrace } from "./book.ts";
import type { IsoTime } from "../../../time/index.ts";
import type { LiveConnectionId } from "../../index.ts";

interface Ending extends At {
  readonly ending: (connection: Connection, id: LiveConnectionId) => boolean;
  readonly end: End;
  readonly endedAt: IsoTime;
  readonly always: boolean;
}

const NONE = 0;

function closeCleanly(closing: Closing): readonly [boolean, BookState] {
  const held = heldBy(closing);
  if (held.connections.has(closing.connection)) {
    const closingCleanly = new Set([...closing.state.closingCleanly, closing.connection]);
    return [true, { ...closing.state, closingCleanly }];
  }
  const inGrace = Option.filter(held.grace, (grace) => grace.closing === closing.connection);
  return Option.match(inGrace, {
    onNone: () => [false, closing.state] as const,
    onSome: (grace) =>
      [true, heldAs({ ...closing, held: { ...held, grace: Option.some({ ...grace, clean: true }) } })] as const,
  });
}

function offlineAtOnce(ending: Ending, connections: ReadonlyMap<LiveConnectionId, Connection>): BookState {
  const held = heldBy(ending);
  const lastSeen = new Map([...ending.state.lastSeen, [ending.identity, ending.endedAt]]);
  const state = { ...ending.state, lastSeen, onBootGrace: withoutBootGrace(ending) };
  const ended = heldAs({ ...ending, held: { ...held, connections, grace: Option.none() }, state });
  return endedAs({ ...ending, end: ending.end, state: ended });
}

function endingIds(ending: Ending): readonly LiveConnectionId[] {
  const { connections } = heldBy(ending);
  return Arr.filter([...connections.keys()], (id) =>
    Option.exists(Option.fromNullishOr(connections.get(id)), (connection) => ending.ending(connection, id)),
  );
}

function withoutIds(
  connections: ReadonlyMap<LiveConnectionId, Connection>,
  ids: readonly LiveConnectionId[],
): ReadonlyMap<LiveConnectionId, Connection> {
  const kept = new Map(connections);
  for (const id of ids) {
    kept.delete(id);
  }
  return kept;
}

function goesOffline(ending: Ending, ended: readonly LiveConnectionId[]): boolean {
  return ended.length > NONE || ending.always || presenceIn(ending).online;
}

function endAtOnce(ending: Ending): readonly [readonly LiveConnectionId[], BookState] {
  const held = heldBy(ending);
  const ended = endingIds(ending);
  const connections = withoutIds(held.connections, ended);
  if (connections.size > NONE) {
    return [ended, heldAs({ ...ending, held: { ...held, connections } })];
  }
  if (goesOffline(ending, ended)) {
    return [ended, offlineAtOnce(ending, connections)];
  }
  return [ended, ending.state];
}

export { type Ending, closeCleanly, endAtOnce };
