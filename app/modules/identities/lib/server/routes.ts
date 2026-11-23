import { Array as Arr, DateTime, Effect, Predicate, Schema } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import type { Identity, IdentityKind, IdentityName, Owner } from "../../index.ts";
import {
  IdentityNameSchema,
  IdentityResponseSchema,
  IdentityWithTokenResponseSchema,
  ListIdentitiesResponseSchema,
  OwnerSchema,
  SentDisplayNameSchema,
} from "./wire.ts";
import {
  identitiesPath,
  identityAdminPath,
  identityKinds,
  identityPath,
  identityTokenPath,
  isIdentityName,
} from "../../index.ts";
import { issueToken, requireAdmin } from "./auth.ts";
import type { Caller } from "./auth.ts";
import type { Refusal } from "../../../http/index.ts";
import type { Route } from "../../../http/server.ts";
import type { Secrets } from "../../../secrets/server.ts";
import type { SetAdminResult } from "../../../storage/server.ts";
import { Storage } from "../../../storage/server.ts";
import { echoed } from "../../../http/index.ts";
import { isoTimeOf } from "../../../time/server.ts";

const humanHasNoOwner = Schema.makeFilter(
  (body: { readonly kind: IdentityKind; readonly owner?: Owner }) =>
    body.kind === "agent" || Predicate.isUndefined(body.owner) || { issue: "A human has no owner.", path: ["owner"] },
);

const CreateIdentityRequestSchema = Schema.Struct({
  displayName: Schema.optionalKey(SentDisplayNameSchema),
  kind: Schema.Literals(identityKinds),
  name: IdentityNameSchema,
  owner: Schema.optionalKey(OwnerSchema),
}).check(humanHasNoOwner);

type CreateIdentityBody = typeof CreateIdentityRequestSchema.Type;

const CONFLICT = 409;
const CREATED = 201;
const FORBIDDEN = 403;
const NOT_FOUND = 404;

function identityNotFound(name: string): Refusal {
  return { code: "identity_not_found", message: `There is no identity named ${echoed(name)}.`, status: NOT_FOUND };
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
  const name = String(params["name"]);
  if (isIdentityName(name)) {
    return Effect.succeed(name);
  }
  return Effect.fail(identityNotFound(name));
}

function newIdentity({ kind, name, owner }: CreateIdentityBody, createdAt: Identity["createdAt"]): Identity {
  if (kind === "human") {
    return { admin: false, createdAt, kind, name };
  }
  if (typeof owner === "string") {
    return { admin: false, createdAt, kind, name, owner };
  }
  return { admin: false, createdAt, kind, name };
}

function withDisplayName(identity: Identity, { displayName }: CreateIdentityBody): Identity {
  if (Predicate.isUndefined(displayName)) {
    return identity;
  }
  return { ...identity, displayName };
}

function flaggedIfHandler(identity: Identity, handlers: ReadonlySet<IdentityName>): Identity {
  if (identity.kind === "agent" && handlers.has(identity.name)) {
    return { ...identity, handler: true };
  }
  return identity;
}

const withToken = HttpServerResponse.schemaJson(IdentityWithTokenResponseSchema);

const createRoute: Route<Caller | Storage | Secrets> = {
  handle: () =>
    Effect.gen(function* createIdentityRoute() {
      yield* requireAdmin;
      const body = yield* HttpServerRequest.schemaBodyJson(CreateIdentityRequestSchema);
      const now = yield* DateTime.now;
      const identity = withDisplayName(newIdentity(body, isoTimeOf(now)), body);
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
      const commands = yield* storage.listCommands;
      const stored = yield* storage.listIdentities();
      const handlers = new Set(Arr.map(commands, ({ handler }) => handler));
      const identities = Arr.map(stored, (identity) => flaggedIfHandler(identity, handlers));
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

function humanOnly({ kind }: Identity): Refusal {
  return { code: "human_only", details: { kind }, message: "Only a human can be an admin.", status: FORBIDDEN };
}

function lastAdminKept(name: IdentityName): Refusal {
  return {
    code: "last_admin",
    message: `${name} is the last admin. Make another admin before removing its admin.`,
    status: CONFLICT,
  };
}

function changedIdentity(name: IdentityName, result: SetAdminResult): Effect.Effect<Identity, Refusal> {
  if (result.status === "set") {
    return Effect.succeed(result.identity);
  }
  if (result.status === "agent") {
    return Effect.fail(humanOnly(result.identity));
  }
  if (result.status === "last_admin") {
    return Effect.fail(lastAdminKept(name));
  }
  return Effect.fail(identityNotFound(name));
}

function adminFlagRoute(method: "PUT" | "DELETE"): Route<Caller | Storage> {
  return {
    handle: (params) =>
      Effect.gen(function* setAdminRoute() {
        yield* requireAdmin;
        const name = yield* nameParam(params);
        const storage = yield* Storage;
        const result = yield* storage.setAdmin(name, method === "PUT");
        const identity = yield* changedIdentity(name, result);
        return yield* HttpServerResponse.schemaJson(IdentityResponseSchema)({ identity });
      }),
    method,
    path: identityAdminPath,
  };
}

export function humanAdmin(name: IdentityName): Effect.Effect<Identity> {
  return Effect.map(DateTime.now, (now) => ({
    admin: true,
    createdAt: isoTimeOf(now),
    kind: "human",
    name,
  }));
}

export const responseSchemas = {
  IdentityResponse: IdentityResponseSchema,
  IdentityWithTokenResponse: IdentityWithTokenResponseSchema,
  ListIdentitiesResponse: ListIdentitiesResponseSchema,
};

export const identityAdminRoutes: readonly Route<Caller | Storage | Secrets>[] = [
  createRoute,
  listRoute,
  rotateRoute,
  deleteRoute,
  adminFlagRoute("PUT"),
  adminFlagRoute("DELETE"),
];

export { identityNotFound, nameParam };
