/**
 * Identities on the backend: bearer auth, issuing tokens,
 * the admin identity's token from the setting, `GET /v1/whoami` and the web UI's
 * session cookie. A token is
 * never stored: only its hash, made by `Secrets`, goes into `Storage`.
 */
import {
  Caller,
  CommandThread,
  authenticate,
  credentialsOf,
  issueToken,
  requireCommandRoute,
} from "./lib/server/auth.ts";
import { Context, Effect, Layer, Option } from "effect";
import type { Credentials, IssuedToken, Principal } from "./lib/server/auth.ts";
import type { Gate, Route } from "../http/server.ts";
import { firstAdmin, identityAdminRoutes, responseSchemas } from "./lib/server/routes.ts";
import { HttpServerRequest } from "effect/http";
import type { Refusal } from "../http/index.ts";
import { Secrets } from "../secrets/server.ts";
import { Storage } from "../storage/server.ts";
import type { StorageUnavailable } from "../storage/server.ts";
import type { Token } from "./index.ts";
import { callerRoutes } from "./lib/server/session.ts";

export { Caller };
/**
 * The one thread a request may reply in when it carries a command token, and none for any other token. `Messages`
 * posts such a request only as a reply in this thread.
 */
export { CommandThread } from "./lib/server/auth.ts";

export type IdentitiesService = {
  /**
   * The identity behind a request's `Authorization` header or, without one, its session cookie, and for a command
   * token the thread of its call. Refuses with 401 `token_missing`, `token_unknown`, `token_revoked` or
   * `token_expired`.
   */
  readonly authenticate: (credentials: Credentials) => Effect.Effect<Principal, Refusal | StorageUnavailable>;
  /** A new token and its hash. Creating an identity and rotating a token both issue one. */
  readonly issueToken: Effect.Effect<IssuedToken>;
};

export class Identities extends Context.Service<Identities, IdentitiesService>()(
  "@ai-hero/cookout/identities/server/Identities",
) {}

/** `Identities` on the running `Storage` and `Secrets`. */
export const identitiesLayer: Layer.Layer<Identities, never, Storage | Secrets> = Layer.effect(
  Identities,
  Effect.gen(function* () {
    const storage = yield* Storage;
    const secrets = yield* Secrets;
    return {
      authenticate: authenticate(storage, secrets),
      issueToken: Effect.provideService(issueToken, Secrets, secrets),
    };
  }),
);

/**
 * The gate every route but `/v1/health` sits behind: authenticates the
 * request's bearer token or, without one, its session cookie, and provides
 * its identity as `Caller`. Refuses
 * with 401 `token_missing`, `token_unknown`, `token_revoked` or `token_expired`. A command token gets 403
 * `outside_command_thread` on every route but `POST /v1/messages`, and its thread as `CommandThread`.
 */
export const requireToken: Gate<
  Caller,
  Identities | HttpServerRequest.HttpServerRequest,
  Refusal | StorageUnavailable
> = (effect) =>
  Effect.gen(function* () {
    const identities = yield* Identities;
    const request = yield* HttpServerRequest.HttpServerRequest;
    const { commandThread, identity } = yield* identities.authenticate(credentialsOf(request));
    if (Option.isSome(commandThread)) {
      yield* requireCommandRoute(request);
    }
    return yield* effect.pipe(
      Effect.provideService(Caller, identity),
      Effect.provideService(CommandThread, commandThread),
    );
  });

/**
 * Makes `adminToken` the only token of the `admin` identity, creating the admin on a store without one and giving
 * it back its admin flag if another admin removed it. `cookout
 * serve` runs it at every boot with `COOKOUT_ADMIN_TOKEN` (Matt, 2026-11-23, mattpocock/cookout#85), so a token
 * rotated since, lost or leaked stops working once the setting changes and the server restarts.
 *
 * @param adminToken The token from `COOKOUT_ADMIN_TOKEN`.
 * @returns A Layer that sets the token when it is built.
 */
export function adminTokenSet(adminToken: Token): Layer.Layer<never, StorageUnavailable, Storage | Secrets> {
  return Layer.effectDiscard(
    Effect.gen(function* setAdminToken() {
      const secrets = yield* Secrets;
      const storage = yield* Storage;
      const hash = yield* secrets.hashToken(adminToken);
      const admin = yield* firstAdmin;
      yield* storage.setOnlyToken(admin, hash);
      yield* storage.setAdmin(admin.name, true);
    }),
  );
}

/**
 * The identity routes, for the server's route list: whoami, logging the web
 * UI in and out, create, list, rotate and delete, and making and removing admins. They need `Caller`, which
 * `requireToken` provides.
 */
export const identityRoutes: readonly Route<Caller | Storage | Secrets>[] = [...callerRoutes, ...identityAdminRoutes];

/** The response Schemas of the identity routes, for the SDK's generated validators. */
export const identityResponseSchemas = { ...responseSchemas };

/** Refuses with 403 `admin_only` unless `Caller` is an admin. */
export { requireAdmin } from "./lib/server/auth.ts";
