/**
 * The inbox on the backend: the `Inbox` service over `Storage`, and the
 * routes that read the caller's inbox, ack a message, follow and unfollow a
 * thread, and subscribe to and unsubscribe from a channel. Ack needs the
 * lease while one is held (ADR 0004). Routes sit behind the server's token
 * gate.
 */
import {
  AckRequestSchema,
  AckResponseSchema,
  FollowResponseSchema,
  InboxResponseSchema,
  SubscriptionResponseSchema,
} from "./lib/server/wire.ts";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import { ackPath, followPath, inboxPath, subscriptionPath } from "./index.ts";
import { Caller } from "../identities/server.ts";
import { Effect } from "effect";
import { Inbox } from "./lib/server/service.ts";
import type { Leases } from "../leases/server.ts";
import type { Route } from "../http/server.ts";
import { requireLeaseWhileHeld } from "../leases/server.ts";

type Needs = Caller | Inbox | Leases;

type Change = "PUT" | "DELETE";

const ALL_ERRORS = { errors: "all" } as const;
const DIGITS = /^\d+$/u;

const inboxRoute: Route<Needs> = {
  handle: () =>
    Effect.gen(function* inboxRouteHandler() {
      const caller = yield* Caller;
      const inbox = yield* Inbox;
      const answer = yield* inbox.inbox(caller);
      return yield* HttpServerResponse.schemaJson(InboxResponseSchema)(answer);
    }),
  method: "GET",
  path: inboxPath,
};

const ackRoute: Route<Needs> = {
  handle: () =>
    Effect.gen(function* ackRouteHandler() {
      const { messageId } = yield* HttpServerRequest.schemaBodyJson(AckRequestSchema, ALL_ERRORS);
      yield* requireLeaseWhileHeld;
      const caller = yield* Caller;
      const inbox = yield* Inbox;
      const answer = yield* inbox.ack(caller, messageId);
      return yield* HttpServerResponse.schemaJson(AckResponseSchema)(answer);
    }),
  method: "POST",
  path: ackPath,
};

function followRoute(method: Change, change: "follow" | "unfollow"): Route<Needs> {
  return {
    handle: (params) =>
      Effect.gen(function* followRouteHandler() {
        const caller = yield* Caller;
        const inbox = yield* Inbox;
        const answer = yield* inbox[change](caller, String(params["id"]));
        return yield* HttpServerResponse.schemaJson(FollowResponseSchema)(answer);
      }),
    method,
    path: followPath,
    segments: { id: (segment) => DIGITS.test(segment) },
  };
}

function subscriptionRoute(method: Change, change: "subscribe" | "unsubscribe"): Route<Needs> {
  return {
    handle: (params) =>
      Effect.gen(function* subscriptionRouteHandler() {
        const caller = yield* Caller;
        const inbox = yield* Inbox;
        const answer = yield* inbox[change](caller, String(params["name"]));
        return yield* HttpServerResponse.schemaJson(SubscriptionResponseSchema)(answer);
      }),
    method,
    path: subscriptionPath,
  };
}

export { inboxLayer } from "./lib/server/service.ts";

/**
 * The inbox routes, for the server's route list. They need `Caller`, which the token gate provides, `Inbox`, which
 * `inboxLayer` provides, and `Leases`, for ack.
 * @internal
 */
export const inboxRoutes: readonly Route<Needs>[] = [
  inboxRoute,
  ackRoute,
  followRoute("PUT", "follow"),
  followRoute("DELETE", "unfollow"),
  subscriptionRoute("PUT", "subscribe"),
  subscriptionRoute("DELETE", "unsubscribe"),
];

/** The response Schemas of the inbox routes, for the SDK's generated validators. */
export const inboxResponseSchemas = {
  AckResponse: AckResponseSchema,
  FollowResponse: FollowResponseSchema,
  InboxResponse: InboxResponseSchema,
  SubscriptionResponse: SubscriptionResponseSchema,
};
