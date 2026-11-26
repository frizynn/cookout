import type { BoardLimits, Channel, ChannelName, ChannelRouting } from "../../../channels/index.ts";
import { Effect, Option, Schema } from "effect";
import type { IdentityName } from "../../../identities/index.ts";
import type { MemoryState } from "./memory-state.ts";
import type { SqlDatabase } from "./adapters/sql-database.ts";
import type { StorageUnavailable } from "./errors.ts";
import { defaultBoardLimits } from "../../../channels/index.ts";

type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

interface StoredRouting {
  readonly routing: ChannelRouting;
  readonly routerSecret?: string;
}

interface ChannelRoutingSection {
  readonly setChannelRouting: (name: ChannelName, routing: StoredRouting) => Fails<Channel | undefined>;
  readonly findRouterSecret: (name: ChannelName) => Fails<string | undefined>;
  readonly getBoardLimits: () => Fails<BoardLimits>;
  readonly setBoardLimits: (limits: BoardLimits) => Fails<BoardLimits>;
}

interface RoutingColumns {
  readonly owner?: IdentityName | null | undefined;
  readonly router?: string | null | undefined;
  readonly fallback?: IdentityName | null | undefined;
}

const LimitsRow = Schema.Struct({ agent_mentions: Schema.Int, agent_turns: Schema.Int });
const SecretRow = Schema.Struct({ secret: Schema.NullOr(Schema.String) });

const ROUTING_MIGRATION = `ALTER TABLE channels ADD COLUMN owner TEXT;
   ALTER TABLE channels ADD COLUMN router TEXT;
   ALTER TABLE channels ADD COLUMN router_secret TEXT;
   ALTER TABLE channels ADD COLUMN fallback TEXT;
   ALTER TABLE messages ADD COLUMN route TEXT;
   CREATE TABLE message_routes (
     identity_name TEXT NOT NULL,
     message_id INTEGER NOT NULL REFERENCES messages (id),
     reason TEXT NOT NULL,
     PRIMARY KEY (identity_name, message_id)
   ) STRICT, WITHOUT ROWID;
   CREATE TABLE board_limits (agent_mentions INTEGER NOT NULL, agent_turns INTEGER NOT NULL) STRICT;`;

const POSTGRES_ROUTING_MIGRATION: readonly string[] = [
  'ALTER TABLE channels ADD COLUMN owner text COLLATE "C"',
  'ALTER TABLE channels ADD COLUMN router text COLLATE "C"',
  'ALTER TABLE channels ADD COLUMN router_secret text COLLATE "C"',
  'ALTER TABLE channels ADD COLUMN fallback text COLLATE "C"',
  'ALTER TABLE messages ADD COLUMN route text COLLATE "C"',
  `CREATE TABLE message_routes (
       identity_name text COLLATE "C" NOT NULL,
       message_id bigint NOT NULL REFERENCES messages (id),
       reason text COLLATE "C" NOT NULL,
       PRIMARY KEY (identity_name, message_id)
     )`,
  "CREATE TABLE board_limits (agent_mentions integer NOT NULL, agent_turns integer NOT NULL)",
];

function routingFields({ fallback, owner, router }: RoutingColumns): ChannelRouting {
  return {
    ...Option.match(Option.fromNullishOr(owner), { onNone: () => ({}), onSome: (found) => ({ owner: found }) }),
    ...Option.match(Option.fromNullishOr(router), { onNone: () => ({}), onSome: (found) => ({ router: found }) }),
    ...Option.match(Option.fromNullishOr(fallback), { onNone: () => ({}), onSome: (found) => ({ fallback: found }) }),
  };
}

function bareChannel({ createdAt, description, name }: Channel): Channel {
  if (typeof description === "string") {
    return { createdAt, description, name };
  }
  return { createdAt, name };
}

interface MemoryRouting {
  readonly state: MemoryState;
  readonly channels: Map<ChannelName, Channel>;
  readonly routerSecrets: Map<ChannelName, string>;
}

function memoryRouting({ channels, routerSecrets, state }: MemoryRouting): ChannelRoutingSection {
  let limits = defaultBoardLimits;
  function open<Value>(work: () => Value): Fails<Value> {
    return Effect.andThen(state.ensureOpen, Effect.sync(work));
  }
  function route(name: ChannelName, { routerSecret, routing }: StoredRouting): Channel | undefined {
    const found = channels.get(name);
    routerSecrets.delete(name);
    if (typeof found !== "object") {
      return found;
    }
    const changed = { ...bareChannel(found), ...routingFields(routing) };
    channels.set(name, changed);
    if (typeof routerSecret === "string") {
      routerSecrets.set(name, routerSecret);
    }
    return changed;
  }
  return {
    findRouterSecret: (name) => open(() => routerSecrets.get(name)),
    getBoardLimits: () => open(() => limits),
    setBoardLimits: (changed) =>
      open(() => {
        limits = changed;
        return limits;
      }),
    setChannelRouting: (name, stored) => open(() => route(name, stored)),
  };
}

function limitsIn(db: SqlDatabase): Fails<BoardLimits> {
  return db.get("SELECT agent_mentions, agent_turns FROM board_limits").pipe(
    Effect.map((row) => {
      if (!Schema.is(LimitsRow)(row)) {
        return defaultBoardLimits;
      }
      return { agentMentions: row.agent_mentions, agentTurns: row.agent_turns };
    }),
  );
}

const isSecretRow = Schema.is(SecretRow);

function secretIn(row: unknown): string | undefined {
  const secret = Option.flatMap(Option.liftPredicate(row, isSecretRow), (found) => Option.fromNullishOr(found.secret));
  return Option.getOrUndefined(secret);
}

function replaceLimits(db: SqlDatabase, limits: BoardLimits): Fails<BoardLimits> {
  const insert = db.run(
    "INSERT INTO board_limits (agent_mentions, agent_turns) VALUES (?, ?)",
    limits.agentMentions,
    limits.agentTurns,
  );
  return db.transaction(Effect.andThen(db.run("DELETE FROM board_limits"), Effect.as(insert, limits)));
}

interface SqlRouting {
  readonly db: SqlDatabase;
  readonly find: (name: ChannelName) => Fails<Channel | undefined>;
}

function sqlRouting({ db, find }: SqlRouting): ChannelRoutingSection {
  return {
    findRouterSecret: (name) =>
      Effect.map(db.get("SELECT router_secret AS secret FROM channels WHERE name = ?", name), secretIn),
    getBoardLimits: () => limitsIn(db),
    setBoardLimits: (limits) => replaceLimits(db, limits),
    setChannelRouting: (name, { routerSecret, routing }) =>
      db.transaction(
        Effect.andThen(
          db.run(
            "UPDATE channels SET owner = ?, router = ?, fallback = ?, router_secret = ? WHERE name = ?",
            routing.owner ?? null,
            routing.router ?? null,
            routing.fallback ?? null,
            routerSecret ?? null,
            name,
          ),
          find(name),
        ),
      ),
  };
}

export {
  type ChannelRoutingSection,
  POSTGRES_ROUTING_MIGRATION,
  ROUTING_MIGRATION,
  type StoredRouting,
  memoryRouting,
  routingFields,
  sqlRouting,
};
