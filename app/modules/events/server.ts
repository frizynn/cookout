/**
 * Live updates on the backend: the route that opens a caller's Server-Sent
 * Events stream (ADR 0002). The stream merges separate event sources, each
 * started when the caller connects, so each new kind of event is one more
 * entry in `sources`: the caller's new inbox items, which the `Messages`
 * service's hub feeds (after replaying, on a reconnect with `Last-Event-ID`,
 * the items the caller missed), and a comment heartbeat every 15 s so proxies
 * keep the connection open. The stream starts with a comment, so Node
 * sends the headers at once and the caller knows every source is listening.
 * The route sits behind the server's token gate; the lease gate comes later.
 */
import { Effect, Exit, Scope, Stream } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import { LastEventId, heartbeat, lastEventIdIn, sseText } from "./lib/server/source.ts";
import { Caller } from "../identities/server.ts";
import type { EventSource } from "./lib/server/source.ts";
import type { Inbox } from "../inbox/server.ts";
import { InboxItemEventSchema } from "./lib/server/wire.ts";
import type { Messages } from "../messages/server.ts";
import type { Route } from "../http/server.ts";
import { eventsPath } from "./index.ts";
import { inboxItems } from "./lib/server/inbox-items.ts";

type Needs = Caller | Inbox | Messages;

const sources: readonly EventSource<Needs | LastEventId>[] = [inboxItems, heartbeat];

const SSE_HEADERS = { "cache-control": "no-cache" } as const;
const OPENED = ": open\n\n";

const eventsRoute: Route<Needs> = {
  handle: () =>
    Effect.gen(function* openEventStream() {
      const caller = yield* Caller;
      const request = yield* HttpServerRequest.HttpServerRequest;
      const lastEventId = lastEventIdIn(request.headers["last-event-id"]);
      const connection = yield* Scope.make();
      const streams = yield* Effect.forEach(sources, (source) => source(caller), {
        concurrency: "unbounded",
      }).pipe(Scope.provide(connection), Effect.provideService(LastEventId, lastEventId));
      const body = Stream.mergeAll(streams, { concurrency: "unbounded" }).pipe(
        Stream.map(sseText),
        Stream.prepend([OPENED]),
        Stream.encodeText,
        Stream.ensuring(Scope.close(connection, Exit.void)),
      );
      return HttpServerResponse.stream(body, { contentType: "text/event-stream", headers: SSE_HEADERS });
    }),
  method: "GET",
  path: eventsPath,
};

/**
 * The events route, for the server's route list. It needs `Caller`, which the token gate provides, and what its
 * sources need: `Inbox`, which `inboxLayer` provides, and `Messages`, which `messagesLayer` provides.
 * @internal
 */
export const eventRoutes: readonly Route<Needs>[] = [eventsRoute];

/** The Schemas of the stream's events, for the SDK's generated validators. */
export const eventResponseSchemas = { InboxItemEvent: InboxItemEventSchema };
