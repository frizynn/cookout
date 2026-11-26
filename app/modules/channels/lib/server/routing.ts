import type {
  BoardLimits,
  Channel,
  ChannelRouting,
  ChannelRoutingResponse,
  SetChannelRoutingRequest,
  WakeOptions,
} from "../../index.ts";
import {
  BoardLimitsResponseSchema,
  BoardLimitsSchema,
  ChannelRoutingResponseSchema,
  SetChannelRoutingRequestSchema,
  WakeOptionsResponseSchema,
} from "./wire.ts";
import { Effect, Option, Predicate } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import { boardLimitsPath, channelRoutingPath, isChannelName, wakeOptionsPath } from "../../index.ts";
import { checkedRouting, present, wakeOptionsOf } from "./routing-checks.ts";
import type { Caller } from "../../../identities/server.ts";
import type { Refusal } from "../../../http/index.ts";
import type { Route } from "../../../http/server.ts";
import { Secrets } from "../../../secrets/server.ts";
import { Storage } from "../../../storage/server.ts";
import type { StorageUnavailable } from "../../../storage/server.ts";
import { requireAdmin } from "../../../identities/server.ts";

interface RoutingCalls {
  readonly wakeOptions: WakeOptions;
  readonly limits: Effect.Effect<BoardLimits, StorageUnavailable>;
  readonly setLimits: (limits: BoardLimits) => Effect.Effect<BoardLimits, StorageUnavailable>;
  readonly setRouting: (
    name: string,
    routing: SetChannelRoutingRequest,
  ) => Effect.Effect<ChannelRoutingResponse, Refusal | StorageUnavailable>;
}

interface RoutingNeeds {
  readonly wakeOptions: WakeOptions;
  readonly storage: Storage["Service"];
  readonly secrets: Secrets["Service"];
  readonly missingChannel: (name: string) => Refusal;
}

interface SecretChoice {
  readonly kept: Option.Option<string>;
  readonly shown: Option.Option<string>;
}

function routerSecretFor(
  { secrets, storage }: RoutingNeeds,
  before: Channel,
  routing: ChannelRouting,
): Effect.Effect<SecretChoice, StorageUnavailable> {
  if (Predicate.isUndefined(routing.router)) {
    return Effect.succeed({ kept: Option.none(), shown: Option.none() });
  }
  const unchanged = before.router === routing.router;
  return Effect.flatMap(storage.findRouterSecret(before.name), (current): Effect.Effect<SecretChoice> => {
    const kept = Option.filter(Option.fromUndefinedOr(current), () => unchanged);
    if (Option.isSome(kept)) {
      return Effect.succeed({ kept, shown: Option.none() });
    }
    return Effect.map(secrets.newWebhookCommandSecret, (made) => ({
      kept: Option.some(made),
      shown: Option.some(made),
    }));
  });
}

function existing(needs: RoutingNeeds, name: string): Effect.Effect<Channel, Refusal | StorageUnavailable> {
  if (!isChannelName(name)) {
    return Effect.fail(needs.missingChannel(name));
  }
  return Effect.flatMap(needs.storage.findChannel(name), (found) =>
    Effect.fromOption(Option.fromUndefinedOr(found), () => needs.missingChannel(name)),
  );
}

function setRoutingWith(needs: RoutingNeeds): RoutingCalls["setRouting"] {
  return (name, asked) =>
    Effect.gen(function* setRouting() {
      const before = yield* existing(needs, name);
      const routing = yield* checkedRouting({ asked, storage: needs.storage, wakeOptions: needs.wakeOptions });
      const secret = yield* routerSecretFor(needs, before, routing);
      const changed = yield* needs.storage.setChannelRouting(before.name, {
        routing,
        ...present("routerSecret")(secret.kept),
      });
      const channel = yield* Effect.fromOption(Option.fromUndefinedOr(changed), () => needs.missingChannel(name));
      return { channel, ...present("routerSecret")(secret.shown) };
    });
}

type RoutingCallsNeeds = Storage | Secrets;

function routingCallsOf(
  missingChannel: (name: string) => Refusal,
): Effect.Effect<RoutingCalls, never, RoutingCallsNeeds> {
  return Effect.gen(function* openRoutingCalls() {
    const wakeOptions = yield* wakeOptionsOf;
    const needs = { missingChannel, secrets: yield* Secrets, storage: yield* Storage, wakeOptions };
    return {
      limits: Effect.suspend(() => needs.storage.getBoardLimits()),
      setLimits: (limits) => needs.storage.setBoardLimits(limits),
      setRouting: setRoutingWith(needs),
      wakeOptions,
    };
  });
}

function routingRoutes<Service>(
  calls: Effect.Effect<RoutingCalls, never, Service>,
): readonly Route<Caller | Service>[] {
  return [
    {
      handle: (params) =>
        Effect.gen(function* setChannelRoutingRoute() {
          yield* requireAdmin;
          const asked = yield* HttpServerRequest.schemaBodyJson(SetChannelRoutingRequestSchema, { errors: "all" });
          const answer = yield* (yield* calls).setRouting(String(params["name"]), asked);
          return yield* HttpServerResponse.schemaJson(ChannelRoutingResponseSchema)(answer);
        }),
      method: "PUT",
      path: channelRoutingPath,
    },
    {
      handle: () =>
        Effect.gen(function* wakeOptionsRoute() {
          const { wakeOptions } = yield* calls;
          return yield* HttpServerResponse.schemaJson(WakeOptionsResponseSchema)({ options: wakeOptions });
        }),
      method: "GET",
      path: wakeOptionsPath,
    },
    {
      handle: () =>
        Effect.gen(function* boardLimitsRoute() {
          const limits = yield* (yield* calls).limits;
          return yield* HttpServerResponse.schemaJson(BoardLimitsResponseSchema)({ limits });
        }),
      method: "GET",
      path: boardLimitsPath,
    },
    {
      handle: () =>
        Effect.gen(function* setBoardLimitsRoute() {
          yield* requireAdmin;
          const asked = yield* HttpServerRequest.schemaBodyJson(BoardLimitsSchema, { errors: "all" });
          const limits = yield* (yield* calls).setLimits(asked);
          return yield* HttpServerResponse.schemaJson(BoardLimitsResponseSchema)({ limits });
        }),
      method: "PUT",
      path: boardLimitsPath,
    },
  ];
}

export { type RoutingCalls, type RoutingCallsNeeds, routingCallsOf, routingRoutes };
