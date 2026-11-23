/**
 * Channels on the backend: the `Channels` service over `Storage`, and the
 * routes that create, list, get and delete channels. Any identity can create a
 * channel; only an admin can delete one. The routes sit behind the server's token gate.
 */
import { ChannelResponseSchema, CreateChannelRequestSchema, ListChannelsResponseSchema } from "./lib/server/wire.ts";
import { Context, DateTime, Effect, Layer } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import { channelPath, channelsPath, isChannelName } from "./index.ts";
import type { Caller } from "../identities/server.ts";
import type { Channel } from "./index.ts";
import type { IsoTime } from "../time/index.ts";
import type { Refusal } from "../http/index.ts";
import type { Route } from "../http/server.ts";
import { Storage } from "../storage/server.ts";
import type { StorageUnavailable } from "../storage/server.ts";
import { echoed } from "../http/index.ts";
import { isoTimeOf } from "../time/server.ts";
import { requireAdmin } from "../identities/server.ts";

type NewChannel = typeof CreateChannelRequestSchema.Type;

const CONFLICT = 409;
const CREATED = 201;
const NOT_FOUND = 404;

function channelExists(name: string): Refusal {
  return { code: "channel_exists", message: `The channel ${name} already exists.`, status: CONFLICT };
}

function missingChannel(name: string): Refusal {
  return { code: "channel_not_found", message: `There is no channel named ${echoed(name)}.`, status: NOT_FOUND };
}

function stamped(fields: NewChannel, createdAt: IsoTime): Channel {
  if (typeof fields.description === "string") {
    return { createdAt, description: fields.description, name: fields.name };
  }
  return { createdAt, name: fields.name };
}

function channelsOn(storage: Storage["Service"]): ChannelsService {
  return {
    create: (fields) =>
      Effect.gen(function* createChannel() {
        const now = yield* DateTime.now;
        const channel = stamped(fields, isoTimeOf(now));
        const outcome = yield* storage.createChannel(channel);
        if (outcome === "name_taken") {
          return yield* Effect.fail(channelExists(channel.name));
        }
        return channel;
      }),
    get: (name) =>
      Effect.gen(function* getChannel() {
        if (!isChannelName(name)) {
          return yield* Effect.fail(missingChannel(name));
        }
        const found = yield* storage.findChannel(name);
        if (typeof found === "object") {
          return found;
        }
        return yield* Effect.fail(missingChannel(name));
      }),
    list: Effect.suspend(() => storage.listChannels()),
    remove: (name) =>
      Effect.gen(function* deleteChannel() {
        if (!isChannelName(name)) {
          return yield* Effect.fail(missingChannel(name));
        }
        const deleted = yield* storage.deleteChannel(name);
        if (typeof deleted === "object") {
          return deleted;
        }
        return yield* Effect.fail(missingChannel(name));
      }),
  };
}

/**
 * The refusal for a channel that doesn't exist, 404 `channel_not_found`, for
 * every route that names a channel.
 */
export const channelNotFound: (name: string) => Refusal = missingChannel;

export interface ChannelsService {
  /** Makes a channel, stamped with the current time. Refuses with 409 `channel_exists` when the name is in use. */
  readonly create: (channel: NewChannel) => Effect.Effect<Channel, Refusal | StorageUnavailable>;
  /** Every channel, sorted by name. */
  readonly list: Effect.Effect<readonly Channel[], StorageUnavailable>;
  /** The channel named `name`. Refuses with 404 `channel_not_found` when there is none. */
  readonly get: (name: string) => Effect.Effect<Channel, Refusal | StorageUnavailable>;
  /**
   * Deletes the channel named `name` and everything in it: its messages and threads, their mentions, follows,
   * subscriptions, read positions, command calls and pending deliveries. Refuses with 404 `channel_not_found`
   * when there is none. Answers the deleted channel.
   */
  readonly remove: (name: string) => Effect.Effect<Channel, Refusal | StorageUnavailable>;
}

export class Channels extends Context.Service<Channels, ChannelsService>()(
  "@ai-hero/cookout/channels/server/Channels",
) {}

/** `Channels` on the running `Storage`. */
export const channelsLayer: Layer.Layer<Channels, never, Storage> = Layer.effect(
  Channels,
  Effect.gen(function* channelsOnStorage() {
    const storage = yield* Storage;
    return channelsOn(storage);
  }),
);

/**
 * The channel routes, for the server's route list. They need `Channels`, which `channelsLayer` provides, and
 * `Caller`, which the token gate provides.
 * @internal
 */
export const channelRoutes: readonly Route<Caller | Channels>[] = [
  {
    handle: () =>
      Effect.gen(function* createChannelRoute() {
        const fields = yield* HttpServerRequest.schemaBodyJson(CreateChannelRequestSchema, { errors: "all" });
        const channels = yield* Channels;
        const channel = yield* channels.create(fields);
        return yield* HttpServerResponse.schemaJson(ChannelResponseSchema)({ channel }, { status: CREATED });
      }),
    method: "POST",
    path: channelsPath,
  },
  {
    handle: () =>
      Effect.gen(function* listChannelsRoute() {
        const service = yield* Channels;
        const channels = yield* service.list;
        return yield* HttpServerResponse.schemaJson(ListChannelsResponseSchema)({ channels });
      }),
    method: "GET",
    path: channelsPath,
  },
  {
    handle: (params) =>
      Effect.gen(function* getChannelRoute() {
        const channels = yield* Channels;
        const channel = yield* channels.get(String(params["name"]));
        return yield* HttpServerResponse.schemaJson(ChannelResponseSchema)({ channel });
      }),
    method: "GET",
    path: channelPath,
  },
  {
    handle: (params) =>
      Effect.gen(function* deleteChannelRoute() {
        yield* requireAdmin;
        const channels = yield* Channels;
        const channel = yield* channels.remove(String(params["name"]));
        return yield* HttpServerResponse.schemaJson(ChannelResponseSchema)({ channel });
      }),
    method: "DELETE",
    path: channelPath,
  },
];

/** The Schemas of a channel and its name, for other modules' answers that hold channels. */
export { ChannelNameSchema, ChannelSchema } from "./lib/server/wire.ts";

/** The response Schemas of the channel routes, for the SDK's generated validators. */
export const channelResponseSchemas = {
  ChannelResponse: ChannelResponseSchema,
  ListChannelsResponse: ListChannelsResponseSchema,
};
