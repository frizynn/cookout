import { DateTime, Effect, Schema } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import type { Identity, IdentityName } from "../../index.ts";
import {
  IdentityNameSchema,
  IdentityResponseSchema,
  IdentityWithTokenResponseSchema,
  ListIdentitiesResponseSchema,
  OwnerSchema,
} from "./wire.ts";
import { identitiesPath, identityPath, identityTokenPath, isIdentityName } from "../../index.ts";
import { issueToken, requireAdmin } from "./auth.ts";
import type { Caller } from "./auth.ts";
import type { Refusal } from "../../../http/index.ts";
import type { Route } from "../../../http/server.ts";
import type { Secrets } from "../../../secrets/server.ts";
import { Storage } from "../../../storage/server.ts";

const CreateIdentityRequestSchema = Schema.Struct({
  name: IdentityNameSchema,
  owner: Schema.optionalKey(OwnerSchema),
});

type CreateIdentityBody = typeof CreateIdentityRequestSchema.Type;

const CONFLICT = 409;
const CREATED = 201;
const NOT_FOUND = 404;

function identityNotFound(name: string): Refusal {
  return { code: "identity_not_found", message: `There is no identity named ${name}.`, status: NOT_FOUND };
}

function identityExists(name: string): Refusal {
  return { code: "identity_exists", message: `The name ${name} is taken.`, status: CONFLICT };
}

function lastAdmin(name: string): Refusal {
  return {
    code: "last_admin",
    message: `${name} is the last admin. Make another admin before deleting it.`,
    status: CONFLICT,
  };
}

function nameParam(params: Readonly<Record<string, string>>): Effect.Effect<IdentityName, Refusal> {
  const name = params["name"] ?? "";
  if (isIdentityName(name)) {
    return Effect.succeed(name);
  }
  return Effect.fail(identityNotFound(name));
}

function newIdentity({ name, owner }: CreateIdentityBody, createdAt: string): Identity {
  if (typeof owner === "string") {
    return { admin: false, createdAt, name, owner };
  }
  return { admin: false, createdAt, name };
}

const withToken = HttpServerResponse.schemaJson(IdentityWithTokenResponseSchema);

const createRoute: Route<Caller | Storage | Secrets> = {
  handle: () =>
    Effect.gen(function* createIdentityRoute() {
      yield* requireAdmin;
      const body = yield* HttpServerRequest.schemaBodyJson(CreateIdentityRequestSchema);
      const now = yield* DateTime.now;
      const identity = newIdentity(body, DateTime.formatIso(now));
      const { token, hash } = yield* issueToken;
      const storage = yield* Storage;
      const result = yield* storage.createIdentity(identity, hash);
      if (result === "name_taken") {
        return yield* Effect.fail(identityExists(identity.name));
      }
      return yield* withToken({ identity, token }, { status: CREATED });
    }),
  method: "POST",
  path: identitiesPath,
};

const listRoute: Route<Storage> = {
  handle: () =>
    Effect.gen(function* listIdentitiesRoute() {
      const storage = yield* Storage;
      const identities = yield* storage.listIdentities();
      return yield* HttpServerResponse.schemaJson(ListIdentitiesResponseSchema)({ identities });
    }),
  method: "GET",
  path: identitiesPath,
};

const rotateRoute: Route<Caller | Storage | Secrets> = {
  handle: (params) =>
    Effect.gen(function* rotateTokenRoute() {
      yield* requireAdmin;
      const name = yield* nameParam(params);
      const { token, hash } = yield* issueToken;
      const storage = yield* Storage;
      const result = yield* storage.replaceToken(name, hash);
      if (result.status === "not_found") {
        return yield* Effect.fail(identityNotFound(name));
      }
      return yield* withToken({ identity: result.identity, token });
    }),
  method: "POST",
  path: identityTokenPath,
};

const deleteRoute: Route<Caller | Storage> = {
  handle: (params) =>
    Effect.gen(function* deleteIdentityRoute() {
      yield* requireAdmin;
      const name = yield* nameParam(params);
      const storage = yield* Storage;
      const result = yield* storage.deleteIdentity(name);
      if (result.status === "not_found") {
        return yield* Effect.fail(identityNotFound(name));
      }
      if (result.status === "last_admin") {
        return yield* Effect.fail(lastAdmin(name));
      }
      return yield* HttpServerResponse.schemaJson(IdentityResponseSchema)({ identity: result.identity });
    }),
  method: "DELETE",
  path: identityPath,
};

export const identityAdminRoutes: readonly Route<Caller | Storage | Secrets>[] = [
  createRoute,
  listRoute,
  rotateRoute,
  deleteRoute,
];
