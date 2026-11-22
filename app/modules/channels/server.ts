/**
 * Channels on the backend: the `Channels` service over `Storage`, and the
 * routes that create, list and get channels. Any identity can create a
 * channel; the routes sit behind the server's token gate.
 */
import { Context, DateTime, Effect, Layer } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import type { Refusal } from "../http/index.ts";
import type { Route } from "../http/server.ts";
import { Storage, type StorageUnavailable } from "../storage/server.ts";
import type { Channel } from "./index.ts";
import { channelPath, channelsPath, isChannelName } from "./index.ts";
import { ChannelResponseSchema, CreateChannelRequestSchema, ListChannelsResponseSchema } from "./lib/server/wire.ts";

type NewChannel = typeof CreateChannelRequestSchema.Type;

export type ChannelsService = {
  /** Makes a channel, stamped with the current time. Refuses with 409 `channel_exists` when the name is in use. */
  readonly create: (channel: NewChannel) => Effect.Effect<Channel, Refusal | StorageUnavailable>;
  /** Every channel, sorted by name. */
  readonly list: Effect.Effect<ReadonlyArray<Channel>, StorageUnavailable>;
  /** The channel named `name`. Refuses with 404 `channel_not_found` when there is none. */
  readonly get: (name: string) => Effect.Effect<Channel, Refusal | StorageUnavailable>;
};

export class Channels extends Context.Service<Channels, ChannelsService>()("cookout/channels/Channels") {}

const channelExists = (name: string): Refusal => ({
  status: 409,
  code: "channel_exists",
  message: `The channel ${name} already exists.`,
});

const channelNotFound = (name: string): Refusal => ({
  status: 404,
  code: "channel_not_found",
  message: `There is no channel named ${name}.`,
});

/** `Channels` on the running `Storage`. */
export const channelsLayer: Layer.Layer<Channels, never, Storage> = Layer.effect(
  Channels,
  Effect.map(Storage, (storage) => ({
    create: (fields) =>
      Effect.gen(function* () {
        const channel: Channel = { ...fields, createdAt: DateTime.formatIso(yield* DateTime.now) };
        if ((yield* storage.createChannel(channel)) === "name_taken")
          return yield* Effect.fail(channelExists(channel.name));
        return channel;
      }),
    list: Effect.suspend(() => storage.listChannels()),
    get: (name) =>
      Effect.gen(function* () {
        const found = isChannelName(name) ? yield* storage.findChannel(name) : undefined;
        return found ?? (yield* Effect.fail(channelNotFound(name)));
      }),
  })),
);

const createRoute: Route<Channels> = {
  method: "POST",
  path: channelsPath,
  handle: () =>
    Effect.gen(function* () {
      const fields = yield* HttpServerRequest.schemaBodyJson(CreateChannelRequestSchema, { errors: "all" });
      const channel = yield* (yield* Channels).create(fields);
      return yield* HttpServerResponse.schemaJson(ChannelResponseSchema)({ channel }, { status: 201 });
    }),
};

const listRoute: Route<Channels> = {
  method: "GET",
  path: channelsPath,
  handle: () =>
    Effect.gen(function* () {
      const channels = yield* (yield* Channels).list;
      return yield* HttpServerResponse.schemaJson(ListChannelsResponseSchema)({ channels });
    }),
};

const getRoute: Route<Channels> = {
  method: "GET",
  path: channelPath,
  handle: (params) =>
    Effect.gen(function* () {
      const channel = yield* (yield* Channels).get(params["name"] ?? "");
      return yield* HttpServerResponse.schemaJson(ChannelResponseSchema)({ channel });
    }),
};

/** The channel routes, for the server's route list. They need `Channels`, which `channelsLayer` provides. */
export const channelRoutes: ReadonlyArray<Route<Channels>> = [createRoute, listRoute, getRoute];

/** The response Schemas of the channel routes, for the SDK's generated validators. */
export const channelResponseSchemas = {
  ChannelResponse: ChannelResponseSchema,
  ListChannelsResponse: ListChannelsResponseSchema,
};
