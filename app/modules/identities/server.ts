/**
 * Identities on the backend: bearer auth, issuing tokens,
 * the admin identity made on first boot, and `GET /v1/whoami`. A token is
 * never stored: only its hash, made by `Secrets`, goes into `Storage`.
 */
import { Context, DateTime, Effect, Layer } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import type { Refusal } from "../http/index.ts";
import type { Route } from "../http/server.ts";
import { Secrets } from "../secrets/server.ts";
import { Storage, type StorageUnavailable } from "../storage/server.ts";
import { firstAdminName, type Identity, type Token, type TokenHash, whoamiPath } from "./index.ts";
import { authenticate } from "./lib/server/auth.ts";
import { IdentityResponseSchema } from "./lib/server/wire.ts";

type IssuedToken = { readonly token: Token; readonly hash: TokenHash };

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
    const issueToken = Effect.gen(function* () {
      const token = yield* secrets.newToken;
      return { token, hash: yield* secrets.hashToken(token) };
    });
    return { authenticate: authenticate(storage, secrets), issueToken };
  }),
);

const authenticated: Effect.Effect<
  Identity,
  Refusal | StorageUnavailable,
  Identities | HttpServerRequest.HttpServerRequest
> = Effect.gen(function* () {
  const identities = yield* Identities;
  const request = yield* HttpServerRequest.HttpServerRequest;
  return yield* identities.authenticate(request.headers["authorization"]);
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
    const createdAt = DateTime.formatIso(yield* DateTime.now);
    const made = yield* storage.createIdentityIfNoneExist({ name: firstAdminName, admin: true, createdAt }, hash);
    return { adminToken: made ? token : undefined };
  }),
);

const whoamiRoute: Route<Identities> = {
  method: "GET",
  path: whoamiPath,
  handle: () =>
    Effect.flatMap(authenticated, (identity) => HttpServerResponse.schemaJson(IdentityResponseSchema)({ identity })),
};

/** The identity routes, for the server's route list. */
export const identityRoutes: ReadonlyArray<Route<Identities>> = [whoamiRoute];

/** The response Schemas of the identity routes, for the SDK's generated validators. */
export const identityResponseSchemas = { IdentityResponse: IdentityResponseSchema };
