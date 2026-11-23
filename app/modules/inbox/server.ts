/**
 * The inbox on the backend: the `Inbox` service over `Storage`, and the
 * routes that read the caller's inbox, a page of its inbox history and its read positions, ack a message or the whole
 * inbox, mark a message unread, follow and unfollow a
 * thread, and subscribe to and unsubscribe from a channel. Each read position an ack moves is also
 * published to an in-process hub, which `acked` subscribes to, for live
 * updates. Routes sit
 * behind the server's token gate.
 */
import {
  AckAllRequestSchema,
  AckAllResponseSchema,
  AckRequestSchema,
  AckResponseSchema,
  FollowResponseSchema,
  InboxHistoryQuerySchema,
  InboxHistoryResponseSchema,
  InboxResponseSchema,
  MarkUnreadRequestSchema,
  MarkUnreadResponseSchema,
  OfflineAlertResponseSchema,
  ReadPositionsResponseSchema,
  SubscriptionResponseSchema,
} from "./lib/server/wire.ts";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import {
  ackAllPath,
  ackPath,
  followPath,
  inboxHistoryPath,
  inboxPath,
  markUnreadPath,
  offlineAlertReadPath,
  readPositionsPath,
  subscriptionPath,
} from "./index.ts";
import { Caller } from "../identities/server.ts";
import { Effect } from "effect";
import { Inbox } from "./lib/server/service.ts";
import type { Route } from "../http/server.ts";

type Needs = Caller | Inbox;

type Change = "PUT" | "DELETE";

const ALL_ERRORS = { errors: "all" } as const;
const DIGITS = /^\d+$/u;
const PATH_BASE = "http://cookout.invalid";

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

const historyRoute: Route<Needs> = {
  handle: () =>
    Effect.gen(function* inboxHistoryRouteHandler() {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const search = HttpServerRequest.searchParamsFromURL(new URL(request.url, PATH_BASE));
      const query = yield* HttpServerRequest.schemaSearchParams(InboxHistoryQuerySchema, ALL_ERRORS).pipe(
        Effect.provideService(HttpServerRequest.ParsedSearchParams, search),
      );
      const caller = yield* Caller;
      const inbox = yield* Inbox;
      const answer = yield* inbox.history(caller, query);
      return yield* HttpServerResponse.schemaJson(InboxHistoryResponseSchema)(answer);
    }),
  method: "GET",
  path: inboxHistoryPath,
};

const readPositionsRoute: Route<Needs> = {
  handle: () =>
    Effect.gen(function* readPositionsRouteHandler() {
      const caller = yield* Caller;
      const inbox = yield* Inbox;
      const answer = yield* inbox.readPositions(caller);
      return yield* HttpServerResponse.schemaJson(ReadPositionsResponseSchema)(answer);
    }),
  method: "GET",
  path: readPositionsPath,
};

const ackRoute: Route<Needs> = {
  handle: () =>
    Effect.gen(function* ackRouteHandler() {
      const { messageId } = yield* HttpServerRequest.schemaBodyJson(AckRequestSchema, ALL_ERRORS);
      const caller = yield* Caller;
      const inbox = yield* Inbox;
      const answer = yield* inbox.ack(caller, messageId);
      return yield* HttpServerResponse.schemaJson(AckResponseSchema)(answer);
    }),
  method: "POST",
  path: ackPath,
};

const ackAllRoute: Route<Needs> = {
  handle: () =>
    Effect.gen(function* ackAllRouteHandler() {
      const asked = yield* HttpServerRequest.schemaBodyJson(AckAllRequestSchema, ALL_ERRORS);
      const caller = yield* Caller;
      const inbox = yield* Inbox;
      const answer = yield* inbox.ackAll(caller, asked);
      return yield* HttpServerResponse.schemaJson(AckAllResponseSchema)(answer);
    }),
  method: "POST",
  path: ackAllPath,
};

const markUnreadRoute: Route<Needs> = {
  handle: () =>
    Effect.gen(function* markUnreadRouteHandler() {
      const { messageId } = yield* HttpServerRequest.schemaBodyJson(MarkUnreadRequestSchema, ALL_ERRORS);
      const caller = yield* Caller;
      const inbox = yield* Inbox;
      const answer = yield* inbox.markUnread(caller, messageId);
      return yield* HttpServerResponse.schemaJson(MarkUnreadResponseSchema)(answer);
    }),
  method: "POST",
  path: markUnreadPath,
};

const alertReadRoute: Route<Needs> = {
  handle: (params) =>
    Effect.gen(function* alertReadRouteHandler() {
      const caller = yield* Caller;
      const inbox = yield* Inbox;
      const answer = yield* inbox.markAlertRead(caller, String(params["id"]));
      return yield* HttpServerResponse.schemaJson(OfflineAlertResponseSchema)(answer);
    }),
  method: "POST",
  path: offlineAlertReadPath,
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

export { Inbox, inboxLayer } from "./lib/server/service.ts";

/** Offline alerts: raised by presence, listed in the owner's inbox, sent to the owner's streams as they change. */
export { OfflineAlerts, offlineAlertsLayer } from "./lib/server/offline-alerts.ts";

/** The Schemas of an inbox item, a read position, a moved-back one and a subscription, for the events that carry one. */
export {
  InboxItemSchema,
  MovedBackReadPositionSchema,
  OfflineAlertSchema,
  ReadPositionSchema,
  SubscriptionResponseSchema,
} from "./lib/server/wire.ts";

/**
 * The inbox routes, for the server's route list. They need `Caller`, which the token gate provides, `Inbox`, which
 * `inboxLayer` provides.
 */
export const inboxRoutes: readonly Route<Needs>[] = [
  inboxRoute,
  historyRoute,
  readPositionsRoute,
  ackRoute,
  ackAllRoute,
  markUnreadRoute,
  alertReadRoute,
  followRoute("PUT", "follow"),
  followRoute("DELETE", "unfollow"),
  subscriptionRoute("PUT", "subscribe"),
  subscriptionRoute("DELETE", "unsubscribe"),
];

/** The response Schemas of the inbox routes, for the SDK's generated validators. */
export const inboxResponseSchemas = {
  AckAllResponse: AckAllResponseSchema,
  AckResponse: AckResponseSchema,
  FollowResponse: FollowResponseSchema,
  InboxHistoryResponse: InboxHistoryResponseSchema,
  InboxResponse: InboxResponseSchema,
  MarkUnreadResponse: MarkUnreadResponseSchema,
  OfflineAlertResponse: OfflineAlertResponseSchema,
  ReadPositionsResponse: ReadPositionsResponseSchema,
  SubscriptionResponse: SubscriptionResponseSchema,
};
