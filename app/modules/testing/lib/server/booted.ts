import { Context, Effect, Layer, Predicate, Schedule } from "effect";
import type { HttpServer } from "effect/http";
import type { Identities } from "../../../identities/server.ts";
import { PresenceRegistry } from "../../../presence/server.ts";
import type { Scope } from "effect";
import { Storage } from "../../../storage/server.ts";
import type { StoredPresence } from "../../../storage/server.ts";
import { TestClock } from "effect/testing";
import type { WebhookFake } from "../../../webhook-fake/server.ts";
import { identityName } from "./identities.ts";
import { serverUrl } from "../../../http/server.ts";

type BootedContext = Context.Context<Storage | Identities | WebhookFake | PresenceRegistry>;

interface Booted {
  readonly url: string;
  readonly server: BootedContext;
}

const NO_CONNECTIONS = 0;
const NOTICED_EVERY = "2 millis";

function booted<Failure>(
  layer: Layer.Layer<Storage | Identities | WebhookFake | PresenceRegistry | HttpServer.HttpServer, Failure>,
): Effect.Effect<Booted, Failure, Scope.Scope> {
  return Effect.gen(function* buildServer() {
    const server = yield* Layer.build(layer);
    const url = yield* serverUrl.pipe(Effect.provideContext(server));
    return { server, url };
  });
}

function liveConnectionsClosedOn({
  name,
  server,
}: {
  readonly server: BootedContext;
  readonly name: string;
}): Effect.Effect<void> {
  const registry = Context.get(server, PresenceRegistry);
  return registry
    .liveConnections(identityName(name))
    .pipe(
      Effect.repeat({ schedule: Schedule.spaced(NOTICED_EVERY), until: (open) => open === NO_CONNECTIONS }),
      TestClock.withLive,
      Effect.asVoid,
    );
}

type LastEnd = Pick<StoredPresence, "endedUnexpectedly" | "offlineReason">;

function endIn(kept: StoredPresence | undefined): LastEnd {
  if (Predicate.isUndefined(kept)) {
    return {};
  }
  const { identity: _identity, lastSeenAt: _lastSeenAt, online: _online, ...end } = kept;
  return end;
}

function lastEndOn({
  name,
  server,
}: {
  readonly server: BootedContext;
  readonly name: string;
}): Effect.Effect<LastEnd> {
  const storage = Context.get(server, Storage);
  return storage.listPresence([identityName(name)]).pipe(
    Effect.map(([kept]) => endIn(kept)),
    Effect.orDie,
  );
}

export { type Booted, type LastEnd, booted, lastEndOn, liveConnectionsClosedOn };
