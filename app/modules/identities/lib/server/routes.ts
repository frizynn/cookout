import { DateTime, Effect, Schema, SchemaIssue } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import type { Refusal } from "../../../http/index.ts";
import type { Route } from "../../../http/server.ts";
import type { Secrets } from "../../../secrets/server.ts";
import { Storage } from "../../../storage/server.ts";
import type { Identity, IdentityName } from "../../index.ts";
import { identitiesPath, identityPathPattern, identityTokenPathPattern, isIdentityName } from "../../index.ts";
import { type Caller, issueToken, requireAdmin } from "./auth.ts";
import {
  IdentityNameSchema,
  IdentityResponseSchema,
  IdentityWithTokenResponseSchema,
  ListIdentitiesResponseSchema,
  OwnerSchema,
} from "./wire.ts";

const CreateIdentityRequestSchema = Schema.Struct({
  name: IdentityNameSchema,
  owner: Schema.optionalKey(OwnerSchema),
});

const identityNotFound = (name: string): Refusal => ({
  status: 404,
  code: "identity_not_found",
  message: `There is no identity named ${name}.`,
});

const identityExists = (name: string): Refusal => ({
  status: 409,
  code: "identity_exists",
  message: `The name ${name} is taken.`,
});

const lastAdmin = (name: string): Refusal => ({
  status: 409,
  code: "last_admin",
  message: `${name} is the last admin. Make another admin before deleting it.`,
});

const schemaIssues = SchemaIssue.makeFormatterStandardSchemaV1();

const invalidRequest = (error: Schema.SchemaError): Refusal => ({
  status: 400,
  code: "invalid_request",
  message: "The request doesn't match the protocol.",
  details: schemaIssues(error.issue).issues.map(({ message, path = [] }) => ({ path: path.map(String), message })),
});

const requestBody = <S extends Schema.Decoder<unknown>>(schema: S) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const json = yield* request.json;
    return yield* Schema.decodeUnknownEffect(schema)(json).pipe(Effect.mapError(invalidRequest));
  });

const nameParam = (params: Readonly<Record<string, string>>): Effect.Effect<IdentityName, Refusal> => {
  const name = params["name"] ?? "";
  return isIdentityName(name) ? Effect.succeed(name) : Effect.fail(identityNotFound(name));
};

const withToken = HttpServerResponse.schemaJson(IdentityWithTokenResponseSchema);

const createRoute: Route<Caller | Storage | Secrets> = {
  method: "POST",
  path: identitiesPath,
  handle: () =>
    Effect.gen(function* () {
      yield* requireAdmin;
      const body = yield* requestBody(CreateIdentityRequestSchema);
      const identity: Identity = { ...body, admin: false, createdAt: DateTime.formatIso(yield* DateTime.now) };
      const { token, hash } = yield* issueToken;
      const result = yield* (yield* Storage).createIdentity(identity, hash);
      if (result === "name_taken") return yield* Effect.fail(identityExists(identity.name));
      return yield* withToken({ identity, token }, { status: 201 });
    }),
};

const listRoute: Route<Storage> = {
  method: "GET",
  path: identitiesPath,
  handle: () =>
    Effect.gen(function* () {
      const identities = yield* (yield* Storage).listIdentities();
      return yield* HttpServerResponse.schemaJson(ListIdentitiesResponseSchema)({ identities });
    }),
};

const rotateRoute: Route<Caller | Storage | Secrets> = {
  method: "POST",
  path: identityTokenPathPattern,
  handle: (params) =>
    Effect.gen(function* () {
      yield* requireAdmin;
      const name = yield* nameParam(params);
      const { token, hash } = yield* issueToken;
      const result = yield* (yield* Storage).replaceToken(name, hash);
      if (result.status === "not_found") return yield* Effect.fail(identityNotFound(name));
      return yield* withToken({ identity: result.identity, token });
    }),
};

const deleteRoute: Route<Caller | Storage> = {
  method: "DELETE",
  path: identityPathPattern,
  handle: (params) =>
    Effect.gen(function* () {
      yield* requireAdmin;
      const name = yield* nameParam(params);
      const result = yield* (yield* Storage).deleteIdentity(name);
      if (result.status === "not_found") return yield* Effect.fail(identityNotFound(name));
      if (result.status === "last_admin") return yield* Effect.fail(lastAdmin(name));
      return yield* HttpServerResponse.schemaJson(IdentityResponseSchema)({ identity: result.identity });
    }),
};

export const identityAdminRoutes: ReadonlyArray<Route<Caller | Storage | Secrets>> = [
  createRoute,
  listRoute,
  rotateRoute,
  deleteRoute,
];
