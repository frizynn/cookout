/**
 * Identities on the backend: bearer auth, issuing tokens,
 * the admin identity's token from the setting, `GET /v1/whoami` and the web UI's
 * session cookie. A token is
 * never stored: only its hash, made by `Secrets`, goes into `Storage`.
 */
import { Caller, authenticate, credentialsOf, issueToken } from "./lib/server/auth.ts";
import { Context, Effect, Layer } from "effect";
import type { Credentials, IssuedToken } from "./lib/server/auth.ts";
import type { Gate, Route } from "../http/server.ts";
import type { Identity, Token } from "./index.ts";
import { firstAdmin, identityAdminRoutes, responseSchemas } from "./lib/server/routes.ts";
import { HttpServerRequest } from "effect/http";
import type { Refusal } from "../http/index.ts";
import { Secrets } from "../secrets/server.ts";
import { Storage } from "../storage/server.ts";
import type { StorageUnavailable } from "../storage/server.ts";
import { callerRoutes } from "./lib/server/session.ts";

export { Caller };

export type IdentitiesService = {
  /**
   * The identity behind a request's `Authorization` header or, without one, its session cookie. Refuses with 401
   * `token_missing`, `token_unknown` or `token_revoked`.
   */
  readonly authenticate: (credentials: Credentials) => Effect.Effect<Identity, Refusal | StorageUnavailable>;
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
 * with 401 `token_missing`, `token_unknown` or `token_revoked`.
 */
export const requireToken: Gate<
  Caller,
  Identities | HttpServerRequest.HttpServerRequest,
  Refusal | StorageUnavailable
> = (effect) =>
  Effect.gen(function* () {
    const identities = yield* Identities;
    const request = yield* HttpServerRequest.HttpServerRequest;
    const identity = yield* identities.authenticate(credentialsOf(request));
    return yield* Effect.provideService(effect, Caller, identity);
  });

/**
 * Makes `adminToken` the only token of the `admin` identity, creating the admin on a store without one. `cookout
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
    }),
  );
}

/**
 * The identity routes, for the server's route list: whoami, logging the web
 * UI in and out, and create, list, rotate and delete. They need `Caller`, which `requireToken` provides.
 */
export const identityRoutes: readonly Route<Caller | Storage | Secrets>[] = [...callerRoutes, ...identityAdminRoutes];

/** The response Schemas of the identity routes, for the SDK's generated validators. */
export const identityResponseSchemas = { ...responseSchemas };

/** Refuses with 403 `admin_only` unless `Caller` is an admin. */
export { requireAdmin } from "./lib/server/auth.ts";
