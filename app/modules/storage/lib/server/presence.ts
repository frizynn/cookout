import { Array as Arr, Effect, Option, Order, Schema, String as Str } from "effect";
import type { Fails } from "./errors.ts";
import type { IdentityName } from "../../../identities/index.ts";
import type { IsoTime } from "../../../time/index.ts";
import { IsoTimeSchema } from "../../../time/server.ts";
import type { MemoryState } from "./memory-state.ts";
import type { SqliteDatabase } from "./adapters/sqlite.ts";
import { isIdentityName } from "../../../identities/index.ts";
import { unreadable } from "./errors.ts";

interface StoredPresence {
  readonly identity: IdentityName;
  readonly online: boolean;
  readonly lastSeenAt: IsoTime;
}

interface PresenceSection {
  readonly recordPresence: (presence: StoredPresence) => Fails<void>;
  readonly listPresence: (identities: readonly IdentityName[]) => Fails<readonly StoredPresence[]>;
}

const ONLINE = 1;
const OFFLINE = 0;

const PresenceRow = Schema.Struct({
  identity_name: Schema.String.pipe(Schema.refine(isIdentityName)),
  last_seen_at: IsoTimeSchema,
  online: Schema.Literals([OFFLINE, ONLINE]),
});

const byIdentity = Order.mapInput(Str.Order, (presence: StoredPresence) => presence.identity);

function onlineColumn(online: boolean): number {
  if (online) {
    return ONLINE;
  }
  return OFFLINE;
}

type MemoryPresenceSection = PresenceSection & {
  readonly dropPresence: (identity: IdentityName) => Effect.Effect<void>;
};

function memoryPresence(state: MemoryState): MemoryPresenceSection {
  const kept = new Map<IdentityName, StoredPresence>();
  return {
    dropPresence: (identity) =>
      Effect.sync(() => {
        kept.delete(identity);
      }),
    listPresence: (identities) =>
      Effect.andThen(
        state.ensureOpen,
        Effect.sync(() =>
          Arr.sort(
            Arr.flatMap(identities, (identity) => Option.toArray(Option.fromNullishOr(kept.get(identity)))),
            byIdentity,
          ),
        ),
      ),
    recordPresence: (presence) =>
      Effect.andThen(
        state.ensureOpen,
        Effect.sync(() => {
          kept.set(presence.identity, { ...presence });
        }),
      ),
  };
}

function decodeRows(rows: readonly unknown[]): Fails<readonly (typeof PresenceRow.Type)[]> {
  return Schema.decodeUnknownEffect(Schema.Array(PresenceRow))(rows).pipe(Effect.mapError(unreadable));
}

function storedPresenceOf(row: typeof PresenceRow.Type): StoredPresence {
  return { identity: row.identity_name, lastSeenAt: row.last_seen_at, online: row.online === ONLINE };
}

function sqlitePresence(db: SqliteDatabase): PresenceSection {
  return {
    listPresence: (identities) =>
      db
        .all(
          `SELECT * FROM presence WHERE identity_name IN (${Arr.join(
            Arr.map(identities, () => "?"),
            ", ",
          )}) ORDER BY identity_name`,
          ...identities,
        )
        .pipe(Effect.flatMap(decodeRows), Effect.map(Arr.map(storedPresenceOf))),
    recordPresence: ({ identity, lastSeenAt, online }) =>
      db.run(
        `INSERT INTO presence (identity_name, online, last_seen_at) VALUES (?, ?, ?)
         ON CONFLICT (identity_name) DO UPDATE SET online = excluded.online, last_seen_at = excluded.last_seen_at`,
        identity,
        onlineColumn(online),
        lastSeenAt,
      ),
  };
}

export { type PresenceSection, type StoredPresence, memoryPresence, sqlitePresence };
