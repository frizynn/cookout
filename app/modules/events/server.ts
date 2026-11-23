/**
 * Live updates on the backend: the route that opens a caller's Server-Sent
 * Events stream (ADR 0002). The stream merges separate event sources, each
 * started when the caller connects, so each new kind of event is one more
 * entry in `sources`: the caller's new inbox items, which the `Messages`
 * service's hub feeds, and an agent's lease renewals, which keep the lease
 * alive while the stream is open. The stream starts with a comment, so Node
 * sends the headers at once and the caller knows every source is listening.
 * A source that sends a `refusal` event (`lease_lost`) ends the stream with it. The route sits behind the server's token gate, and opens
 * only with the lease an agent's watch needs (ADR 0004, ADR 0028).
 */
import type { Connected, EventSource } from "./lib/server/source.ts";
import { Effect, Exit, Scope, Stream } from "effect";
import { isLast, refusalSseEvent, sseText } from "./lib/server/source.ts";
import { keepRenewingSentLease, requireLeaseWhileHeld } from "../leases/server.ts";
import { Caller } from "../identities/server.ts";
import type { HttpServerRequest } from "effect/http";
import { HttpServerResponse } from "effect/http";
import { InboxItemEventSchema } from "./lib/server/wire.ts";
import type { InboxItemNeeds } from "./lib/server/inbox-items.ts";
import type { Leases } from "../leases/server.ts";
import type { Route } from "../http/server.ts";
import { eventsPath } from "./index.ts";
import { inboxItems } from "./lib/server/inbox-items.ts";

type LeaseNeeds = Caller | Leases | HttpServerRequest.HttpServerRequest;

type Needs = InboxItemNeeds | LeaseNeeds;

function leaseRenewals(): Connected<LeaseNeeds> {
  return Effect.map(Effect.context<LeaseNeeds>(), (context) =>
    Stream.fromEffect(Effect.flatMap(Effect.provideContext(keepRenewingSentLease, context), refusalSseEvent)),
  );
}

const sources: readonly EventSource<Needs>[] = [inboxItems, leaseRenewals];

const SSE_HEADERS = { "cache-control": "no-cache" } as const;
const OPENED = ": open\n\n";

const eventsRoute: Route<Needs> = {
  handle: () =>
    Effect.gen(function* openEventStream() {
      yield* requireLeaseWhileHeld;
      const caller = yield* Caller;
      const connection = yield* Scope.make();
      const streams = yield* Effect.forEach(sources, (source) => source(caller), { concurrency: "unbounded" }).pipe(
        Scope.provide(connection),
      );
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
export const eventResponseSchemas = { InboxItemEvent: InboxItemEventSchema };
