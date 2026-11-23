/**
 * Live updates on the backend: the route that opens a caller's Server-Sent
 * Events stream (ADR 0002). The stream merges separate event sources, each
 * started when the caller connects with the caller and the request, so each
 * new kind of event is one more entry in `sources` (`lib/server/sources.ts`):
 * a first `connected` event with the board's latest message ID, read once
 * every other source is listening; the
 * caller's new inbox items, which the `Messages` service's hub feeds; the
 * caller's new read positions, which the `Inbox` service's hub feeds on every
 * ack from any session; and, when the request asks with `?channels=all`,
 * every new message on every channel and every identity whose display name
 * changes (fed by the `DisplayNames` hub), for the web UI; and a comment
 * heartbeat every 15 s, so proxies keep the connection open. On a reconnect
 * with `Last-Event-ID`, the inbox items first replay what the caller missed.
 * An agent's lease
 * renewals, which keep the lease alive while the stream is open, are one
 * more source, here because they need the request's lease ID. The stream
 * starts with a comment, so Node sends the headers at once and the caller
 * knows every source is listening. A source that sends a `refusal` event
 * (`lease_lost`) ends the stream with it. The route sits behind the server's
 * token gate, and opens only with the lease an agent's watch needs (ADR 0004,
 * ADR 0028), and only while the caller holds fewer than `COOKOUT_STREAMS_PER_IDENTITY` streams (429
 * `too_many_streams`, ADR 0033); closing the stream frees its place.
 */
import type { Connected, EventSource } from "./lib/server/source.ts";
import {
  ConnectedEventSchema,
  IdentityEventSchema,
  InboxItemEventSchema,
  MessageEventSchema,
  ReadPositionEventSchema,
} from "./lib/server/wire.ts";
import { Effect, Exit, Scope, Stream } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import { isLast, lastEventIdIn, refusalSseEvent, sseText } from "./lib/server/source.ts";
import { keepRenewingSentLease, requireLeaseWhileHeld } from "../leases/server.ts";
import { Caller } from "../identities/server.ts";
import type { Leases } from "../leases/server.ts";
import type { Limits } from "../limits/server.ts";
import type { Route } from "../http/server.ts";
import type { SourceNeeds } from "./lib/server/sources.ts";
import { eventsPath } from "./index.ts";
import { holdStreamPlace } from "../limits/server.ts";
import { sources } from "./lib/server/sources.ts";

type LeaseNeeds = Caller | Leases | HttpServerRequest.HttpServerRequest;

type Needs = SourceNeeds | LeaseNeeds | Limits;

function leaseRenewals(): Connected<LeaseNeeds> {
  return Effect.map(Effect.context<LeaseNeeds>(), (context) =>
    Stream.fromEffect(Effect.flatMap(Effect.provideContext(keepRenewingSentLease, context), refusalSseEvent)),
  );
}

const allSources: readonly EventSource<Needs>[] = [...sources, leaseRenewals];

const SSE_HEADERS = { "cache-control": "no-cache" } as const;
const OPENED = ": open\n\n";

const eventsRoute: Route<Needs> = {
  handle: () =>
    Effect.gen(function* openEventStream() {
      yield* requireLeaseWhileHeld;
      const caller = yield* Caller;
      const { headers, url } = yield* HttpServerRequest.HttpServerRequest;
      const lastEventId = lastEventIdIn(headers["last-event-id"]);
      const connection = yield* Scope.make();
      yield* holdStreamPlace.pipe(Scope.provide(connection));
      const streams = yield* Effect.forEach(allSources, (source) => source({ caller, lastEventId, url }), {
        concurrency: "unbounded",
      }).pipe(Scope.provide(connection));
      const body = Stream.mergeAll(streams, { concurrency: "unbounded" }).pipe(
        Stream.takeUntil(isLast),
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
 * sources need: `Inbox`, which `inboxLayer` provides, `Messages`, which `messagesLayer` provides, and `Leases`, which
 * `leasesLayer` provides.
 * @internal
 */
export const eventRoutes: readonly Route<Needs>[] = [eventsRoute];

/** The Schemas of the stream's events, for the SDK's generated validators. */
export const eventResponseSchemas = {
  ConnectedEvent: ConnectedEventSchema,
  IdentityEvent: IdentityEventSchema,
  InboxItemEvent: InboxItemEventSchema,
  MessageEvent: MessageEventSchema,
  ReadPositionEvent: ReadPositionEventSchema,
};
