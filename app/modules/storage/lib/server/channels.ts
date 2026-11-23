import { Array as Arr, Effect, Order, Schema } from "effect";
import type { Channel, ChannelName } from "../../../channels/index.ts";
import { IsoTimeSchema } from "../../../time/server.ts";
import type { MemoryState } from "./memory-state.ts";
import type { SqliteDatabase } from "./adapters/sqlite.ts";
import type { StorageUnavailable } from "./errors.ts";
import { isChannelName } from "../../../channels/index.ts";
import { unreadable } from "./errors.ts";

type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

interface ChannelsSection {
  readonly createChannel: (channel: Channel) => Fails<"created" | "name_taken">;
  readonly listChannels: () => Fails<readonly Channel[]>;
  readonly findChannel: (name: ChannelName) => Fails<Channel | undefined>;
}

const CHANNEL_COLUMNS = "name, description, created_at";

const byName: Order.Order<Channel> = Order.mapInput(Order.String, (channel: Channel) => channel.name);

const ChannelRow = Schema.Struct({
  created_at: IsoTimeSchema,
  description: Schema.NullOr(Schema.String),
  name: Schema.String.pipe(Schema.refine(isChannelName)),
});

type ChannelRowType = typeof ChannelRow.Type;

function memoryChannels(state: MemoryState): ChannelsSection {
  const channels = new Map<ChannelName, Channel>();
  function open<Value>(work: () => Value): Fails<Value> {
    return Effect.andThen(state.ensureOpen, Effect.sync(work));
  }
  function create(channel: Channel): "created" | "name_taken" {
    if (channels.has(channel.name)) {
      return "name_taken";
    }
    channels.set(channel.name, channel);
    return "created";
  }
  return {
    createChannel: (channel) => open(() => create(channel)),
    findChannel: (name) => open(() => channels.get(name)),
    listChannels: () => open(() => Arr.sort(channels.values(), byName)),
  };
}

function fromRow({ created_at: createdAt, description, name }: ChannelRowType): Channel {
  if (typeof description === "string") {
    return { createdAt, description, name };
  }
  return { createdAt, name };
}

function toChannel(row: unknown): Fails<Channel> {
  return Schema.decodeUnknownEffect(ChannelRow)(row).pipe(
    Effect.mapBoth({ onFailure: unreadable, onSuccess: fromRow }),
  );
}

function insert(db: SqliteDatabase, channel: Channel): Fails<void> {
  if (typeof channel.description === "string") {
    return db.run(
      "INSERT INTO channels (name, description, created_at) VALUES (?, ?, ?)",
      channel.name,
      channel.description,
      channel.createdAt,
    );
  }
  return db.run("INSERT INTO channels (name, created_at) VALUES (?, ?)", channel.name, channel.createdAt);
}

function sqliteChannels(db: SqliteDatabase): ChannelsSection {
  function find(name: ChannelName): Fails<Channel | undefined> {
    return db.get(`SELECT ${CHANNEL_COLUMNS} FROM channels WHERE name = ?`, name).pipe(
      Effect.flatMap((row) => {
        if (typeof row === "object" && row !== null) {
          return toChannel(row);
        }
        return Effect.undefined;
      }),
    );
  }
  return {
    createChannel: (channel) =>
      db.transaction(
        Effect.gen(function* createChannel() {
          const existing = yield* find(channel.name);
          if (typeof existing === "object") {
            return "name_taken" as const;
          }
          yield* insert(db, channel);
          return "created" as const;
        }),
      ),
    findChannel: find,
    listChannels: () =>
      db
        .all(`SELECT ${CHANNEL_COLUMNS} FROM channels ORDER BY name`)
        .pipe(Effect.flatMap((rows) => Effect.forEach(rows, (row) => toChannel(row), { concurrency: 1 }))),
  };
}

export { type ChannelsSection, memoryChannels, sqliteChannels };
