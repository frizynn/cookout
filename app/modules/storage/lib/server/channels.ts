import { Effect, Schema } from "effect";
import type { Channel, ChannelName } from "../../../channels/index.ts";
import { isChannelName } from "../../../channels/index.ts";
import type { SqliteDatabase } from "./adapters/sqlite.ts";
import { StorageUnavailable } from "./errors.ts";
import type { MemoryState } from "./memory-state.ts";

type Fails<A> = Effect.Effect<A, StorageUnavailable>;

export type ChannelsSection = {
  readonly createChannel: (channel: Channel) => Fails<"created" | "name_taken">;
  readonly listChannels: () => Fails<ReadonlyArray<Channel>>;
  readonly findChannel: (name: ChannelName) => Fails<Channel | undefined>;
};

const byName = (a: Channel, b: Channel) => (a.name < b.name ? -1 : 1);

export const memoryChannels = (state: MemoryState): ChannelsSection => {
  const channels = new Map<ChannelName, Channel>();
  const open = <A>(work: () => A): Fails<A> => Effect.andThen(state.ensureOpen, Effect.sync(work));
  return {
    createChannel: (channel) =>
      open(() => (channels.has(channel.name) ? "name_taken" : (channels.set(channel.name, { ...channel }), "created"))),
    listChannels: () => open(() => [...channels.values()].sort(byName).map((found) => ({ ...found }))),
    findChannel: (name) =>
      open(() => {
        const found = channels.get(name);
        return found === undefined ? undefined : { ...found };
      }),
  };
};

const ChannelRow = Schema.Struct({
  name: Schema.String.pipe(Schema.refine(isChannelName)),
  description: Schema.NullOr(Schema.String),
  created_at: Schema.String,
});

const unreadable = () => new StorageUnavailable({ message: "The database holds a row this cookout can't read." });

const toChannel = (row: unknown): Fails<Channel> =>
  Schema.decodeUnknownEffect(ChannelRow)(row).pipe(
    Effect.mapError(unreadable),
    Effect.map(({ name, description, created_at: createdAt }) =>
      description === null ? { name, createdAt } : { name, description, createdAt },
    ),
  );

const channelColumns = "name, description, created_at";

export const sqliteChannels = (db: SqliteDatabase): ChannelsSection => {
  const find = (name: ChannelName) =>
    db
      .get(`SELECT ${channelColumns} FROM channels WHERE name = ?`, name)
      .pipe(Effect.flatMap((row) => (row === undefined ? Effect.succeed(undefined) : toChannel(row))));
  return {
    createChannel: (channel) =>
      db.transaction(
        Effect.gen(function* () {
          if ((yield* find(channel.name)) !== undefined) return "name_taken" as const;
          yield* db.run(
            "INSERT INTO channels (name, description, created_at) VALUES (?, ?, ?)",
            channel.name,
            channel.description ?? null,
            channel.createdAt,
          );
          return "created" as const;
        }),
      ),
    listChannels: () =>
      db.all(`SELECT ${channelColumns} FROM channels ORDER BY name`).pipe(Effect.flatMap(Effect.forEach(toChannel))),
    findChannel: find,
  };
};
