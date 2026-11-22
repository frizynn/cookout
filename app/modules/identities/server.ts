/**
 * Identities on the backend: bearer auth, issuing tokens,
 * the admin identity made on first boot, and `GET /v1/whoami`. A token is
 * never stored: only its hash, made by `Secrets`, goes into `Storage`.
 */
import { Context, Effect, Layer } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import type { Refusal } from "../http/index.ts";
import type { Gate, Route } from "../http/server.ts";
import { Secrets } from "../secrets/server.ts";
import { Storage, type StorageUnavailable } from "../storage/server.ts";
import { type Identity, type Token, whoamiPath } from "./index.ts";
import { authenticate, Caller, type IssuedToken, issueToken } from "./lib/server/auth.ts";
import { firstAdmin, identityAdminRoutes } from "./lib/server/routes.ts";
import {
  IdentityResponseSchema,
  IdentityWithTokenResponseSchema,
  ListIdentitiesResponseSchema,
} from "./lib/server/wire.ts";

export { Caller };

export type IdentitiesService = {
  /** The identity behind an `Authorization` header. Refuses with 401 `token_missing`, `token_unknown` or `token_revoked`. */
  readonly authenticate: (authorization: string | undefined) => Effect.Effect<Identity, Refusal | StorageUnavailable>;
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
 * request's bearer token and provides its identity as `Caller`. Refuses
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
    const identity = yield* identities.authenticate(request.headers["authorization"]);
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

const whoamiRoute: Route<Caller> = {
  method: "GET",
  path: whoamiPath,
  handle: () =>
    Effect.gen(function* () {
      const identity = yield* Caller;
      return yield* HttpServerResponse.schemaJson(IdentityResponseSchema)({ identity });
    }),
};

/**
 * The identity routes, for the server's route list: whoami, and create,
 * list, rotate and delete. They need `Caller`, which `requireToken` provides.
 */
export const identityRoutes: ReadonlyArray<Route<Caller | Storage | Secrets>> = [whoamiRoute, ...identityAdminRoutes];

/** The response Schemas of the identity routes, for the SDK's generated validators. */
export const identityResponseSchemas = {
  IdentityResponse: IdentityResponseSchema,
  IdentityWithTokenResponse: IdentityWithTokenResponseSchema,
  ListIdentitiesResponse: ListIdentitiesResponseSchema,
};
