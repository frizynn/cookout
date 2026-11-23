/**
 * Identities on the backend: bearer auth, issuing tokens,
 * the admin identity made on first boot, `GET /v1/whoami` and the web UI's
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
  /** A new token and its hash. Creating an identity, rotating a token and the first boot all issue one. */
  readonly issueToken: Effect.Effect<IssuedToken>;
};

export class Identities extends Context.Service<Identities, IdentitiesService>()("cookout/identities/Identities") {}

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

export type FirstBootService = {
  /** The token of the `admin` identity, if this boot made it. Shown this once; later boots have none. */
  readonly adminToken: Token | undefined;
};

export class FirstBoot extends Context.Service<FirstBoot, FirstBootService>()("cookout/identities/FirstBoot") {}

/** On a store with no identities, makes the `admin` identity and keeps its token in `FirstBoot`. */
export const firstBoot: Layer.Layer<FirstBoot, StorageUnavailable, Identities | Storage> = Layer.effect(
  FirstBoot,
  Effect.gen(function* () {
    const storage = yield* Storage;
    const { token, hash } = yield* (yield* Identities).issueToken;
    const admin = yield* firstAdmin;
    const made = yield* storage.createIdentityIfNoneExist(admin, hash);
    return { adminToken: made ? token : undefined };
  }),
);

/**
 * The identity routes, for the server's route list: whoami, logging the web
 * UI in and out, and create, list, rotate and delete. They need `Caller`, which `requireToken` provides.
 */
export const identityRoutes: readonly Route<Caller | Storage | Secrets>[] = [...callerRoutes, ...identityAdminRoutes];

/** The response Schemas of the identity routes, for the SDK's generated validators. */
export const identityResponseSchemas = { ...responseSchemas };
