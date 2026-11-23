/**
 * Presence on the backend (ADR "presence comes from live connections"): the `PresenceRegistry` service keeps every
 * identity's live connections in memory, as the per-identity limits do (ADR 0033), and `GET /v1/presence` answers
 * every identity's presence. Every `/v1/events` stream is a live connection, whatever its query: the stream holds one
 * for as long as it is open, and the all-channels feed sends each change as a `presence` event. An identity stays
 * online for `COOKOUT_PRESENCE_GRACE_SECONDS` after its last live connection closes, and storage keeps when it was
 * last seen and whether it was online, so after a restart the identities that were online keep showing online for
 * 5 minutes, the time a `cookout watch` keeps retrying, or until they reconnect.
 */
import type { Config, PubSub, Scope } from "effect";
import { Context, Duration, Effect, Layer } from "effect";
import type { Identity, IdentityName } from "../identities/index.ts";
import type { LiveConnectionDetail, Presence } from "./index.ts";
import { HttpServerResponse } from "effect/http";
import { PresenceResponseSchema } from "./lib/server/wire.ts";
import type { Registry } from "./lib/server/registry.ts";
import type { Route } from "../http/server.ts";
import { Storage } from "../storage/server.ts";
import type { StorageUnavailable } from "../storage/server.ts";
import { connectionDetail } from "./lib/server/connection.ts";
import { openRegistry } from "./lib/server/registry.ts";
import { presenceGraceSeconds } from "../config/server.ts";
import { presencePath } from "./index.ts";

const BOOT_GRACE = Duration.toMillis("5 minutes");
const ONE_AT_A_TIME = { concurrency: 1 } as const;

function shownFor(identity: Identity, presence: Presence): Presence {
  if (identity.deactivated !== true || !presence.online) {
    return presence;
  }
  return { identity: identity.name, online: false };
}

function presenceOfEach(registry: Registry, identities: readonly Identity[]): Effect.Effect<readonly Presence[]> {
  return Effect.forEach(
    identities,
    (identity) => Effect.map(registry.presenceOf(identity.name), (presence) => shownFor(identity, presence)),
    ONE_AT_A_TIME,
  );
}

/** The presence of the running server's identities. */
export interface PresenceService {
  /** Holds a live connection of `identity`, with how it connects, until the scope closes. */
  readonly holdLiveConnection: (
    identity: IdentityName,
    detail: LiveConnectionDetail,
  ) => Effect.Effect<void, never, Scope.Scope>;
  /** Every identity's presence, Deactivated ones (always offline) included, sorted by name. */
  readonly everyone: Effect.Effect<readonly Presence[], StorageUnavailable>;
  /** Each identity's presence the moment it changes. */
  readonly changed: Effect.Effect<PubSub.Subscription<Presence>, never, Scope.Scope>;
  /** How many live connections `identity` holds now, for tests that wait for a closed stream to be noticed. */
  readonly liveConnections: (identity: IdentityName) => Effect.Effect<number>;
}

export class PresenceRegistry extends Context.Service<PresenceRegistry, PresenceService>()(
  "@ai-hero/cookout/presence/server/PresenceRegistry",
) {}

/** `PresenceRegistry` on the running `Storage`, with the grace from `COOKOUT_PRESENCE_GRACE_SECONDS`. */
export const presenceLayer: Layer.Layer<PresenceRegistry, Config.ConfigError, Storage> = Layer.effect(
  PresenceRegistry,
  Effect.gen(function* openPresence() {
    const storage = yield* Storage;
    const graceSeconds = yield* presenceGraceSeconds;
    const graceMillis = Duration.toMillis(Duration.seconds(graceSeconds));
    const registry = yield* openRegistry({ bootGraceMillis: BOOT_GRACE, graceMillis });
    return {
      changed: registry.changed,
      everyone: Effect.flatMap(storage.listIdentities(), (identities) => presenceOfEach(registry, identities)),
      holdLiveConnection: registry.hold,
      liveConnections: registry.liveConnections,
    };
  }),
);

/**
 * Holds a live connection of the stream's caller until the scope closes. A stream sent with no `Authorization`
 * header (so with the web UI's session cookie) is a web tab; any other is a `cookout watch`, with the host its agent
 * session was joined from when it was sent with an agent session token whose joining client sent one.
 */
export const holdLiveConnection = Effect.fnUntraced(function* holdCallersLiveConnection(stream: {
  readonly caller: Identity;
  readonly authorization: string | undefined;
}): Effect.fn.Return<void, never, PresenceRegistry | Storage | Scope.Scope> {
  const presence = yield* PresenceRegistry;
  const detail = yield* connectionDetail(stream);
  yield* presence.holdLiveConnection(stream.caller.name, detail);
});

/** `GET /v1/presence`, for the server's route list, behind the token gate. */
export const presenceRoutes: readonly Route<PresenceRegistry>[] = [
  {
    handle: () =>
      Effect.gen(function* everyonesPresence() {
        const presence = yield* PresenceRegistry;
        const everyone = yield* presence.everyone;
        return yield* HttpServerResponse.schemaJson(PresenceResponseSchema)({ presence: everyone });
      }),
    method: "GET",
    path: presencePath,
  },
];

/** The Schemas of one identity's presence and of `GET /v1/presence`'s answer, for the live stream and the SDK's validators. */
export { PresenceResponseSchema, PresenceSchema } from "./lib/server/wire.ts";
