import { Array as Arr, Effect } from "effect";
import { CreateIdentityRequestSchema, createIdentity, humanCaller } from "./create.ts";
import type { DeleteIdentityResult, SetAdminResult } from "../../../storage/server.ts";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import type { Identity, IdentityName } from "../../index.ts";
import { IdentityResponseSchema, IdentityWithTokenResponseSchema, ListIdentitiesResponseSchema } from "./wire.ts";
import { identitiesPath, identityAdminPath, identityPath, identityTokenPath, isIdentityName } from "../../index.ts";
import { issueToken, requireAdmin, requireOwnerOrAdmin } from "./auth.ts";
import type { Caller } from "./auth.ts";
import type { Refusal } from "../../../http/index.ts";
import type { Route } from "../../../http/server.ts";
import type { Secrets } from "../../../secrets/server.ts";
import { Storage } from "../../../storage/server.ts";
import { echoed } from "../../../http/index.ts";

const CONFLICT = 409;
const CREATED = 201;
const FORBIDDEN = 403;
const NOT_FOUND = 404;

function identityNotFound(name: string): Refusal {
  return { code: "identity_not_found", message: `There is no identity named ${echoed(name)}.`, status: NOT_FOUND };
}

function ownsAgents(name: IdentityName, agents: readonly IdentityName[]): Refusal {
  return {
    code: "owns_agents",
    details: { agents },
    message: `${name} still owns ${Arr.join(agents, ", ")}. Delete those agents first.`,
    status: CONFLICT,
  };
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

function flaggedIfHandler(identity: Identity, handlers: ReadonlySet<IdentityName>): Identity {
  if (identity.kind === "agent" && handlers.has(identity.name)) {
    return { ...identity, handler: true };
  }
  return identity;
}

function deletedIdentity(name: IdentityName, result: DeleteIdentityResult): Effect.Effect<Identity, Refusal> {
  if (result.status === "deleted") {
    return Effect.succeed(result.identity);
  }
  if (result.status === "last_admin") {
    return Effect.fail(lastAdmin(name));
  }
  if (result.status === "owns_agents") {
    return Effect.fail(ownsAgents(name, result.agents));
  }
  return Effect.fail(identityNotFound(name));
}

const withToken = HttpServerResponse.schemaJson(IdentityWithTokenResponseSchema);

const createRoute: Route<Caller | Storage | Secrets> = {
  handle: () =>
    Effect.gen(function* createIdentityRoute() {
      const caller = yield* humanCaller;
      const body = yield* HttpServerRequest.schemaBodyJson(CreateIdentityRequestSchema);
      const created = yield* createIdentity({ body, caller });
      return yield* withToken(created, { status: CREATED });
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
      const name = yield* nameParam(params);
      yield* requireOwnerOrAdmin(name);
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
      const identity = yield* Effect.flatMap(storage.deleteIdentity(name), (result) => deletedIdentity(name, result));
      return yield* HttpServerResponse.schemaJson(IdentityResponseSchema)({ identity });
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
export { humanAdmin } from "./create.ts";
