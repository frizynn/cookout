import { Array as Arr, Effect, Predicate } from "effect";
import type { Identity, IdentityName } from "../../index.ts";
import { IdentityMessageCountResponseSchema, IdentityResponseSchema } from "./wire.ts";
import { identityMessageCountPath, identityPath } from "../../index.ts";
import { identityNotFound, nameParam } from "./routes.ts";
import type { Caller } from "./auth.ts";
import type { DeleteIdentityResult } from "../../../storage/server.ts";
import { HttpServerResponse } from "effect/http";
import type { Refusal } from "../../../http/index.ts";
import type { Route } from "../../../http/server.ts";
import { Storage } from "../../../storage/server.ts";
import { requireAdmin } from "./auth.ts";

const CONFLICT = 409;

function hasMessages(name: IdentityName): Refusal {
  return {
    code: "has_messages",
    message: `${name} has messages on the board, so it can't be deleted. Deactivate it instead.`,
    status: CONFLICT,
  };
}

function ownsAgents(name: IdentityName, agents: readonly IdentityName[]): Refusal {
  return {
    code: "owns_agents",
    details: { agents },
    message: `${name} still owns ${Arr.join(agents, ", ")}. Delete or transfer those agents first.`,
    status: CONFLICT,
  };
}

function lastAdmin(name: IdentityName): Refusal {
  return {
    code: "last_admin",
    message: `${name} is the last admin. Make another admin before deleting it.`,
    status: CONFLICT,
  };
}

function deletedOrRefused(name: IdentityName, result: DeleteIdentityResult): Effect.Effect<Identity, Refusal> {
  if (result.status === "deleted") {
    return Effect.succeed(result.identity);
  }
  if (result.status === "has_messages") {
    return Effect.fail(hasMessages(name));
  }
  if (result.status === "owns_agents") {
    return Effect.fail(ownsAgents(name, result.agents));
  }
  if (result.status === "last_admin") {
    return Effect.fail(lastAdmin(name));
  }
  return Effect.fail(identityNotFound(name));
}

const deleteRoute: Route<Caller | Storage> = {
  handle: (params) =>
    Effect.gen(function* deleteIdentityRoute() {
      yield* requireAdmin;
      const name = yield* nameParam(params);
      const storage = yield* Storage;
      const identity = yield* Effect.flatMap(storage.deleteIdentity(name), (result) => deletedOrRefused(name, result));
      return yield* HttpServerResponse.schemaJson(IdentityResponseSchema)({ identity });
    }),
  method: "DELETE",
  path: identityPath,
};

const messageCountRoute: Route<Caller | Storage> = {
  handle: (params) =>
    Effect.gen(function* identityMessageCountRoute() {
      const name = yield* nameParam(params);
      const storage = yield* Storage;
      const found = yield* storage.findIdentityByName(name);
      if (Predicate.isUndefined(found)) {
        return yield* Effect.fail(identityNotFound(name));
      }
      const messages = yield* storage.countMessagesBy(name);
      return yield* HttpServerResponse.schemaJson(IdentityMessageCountResponseSchema)({ messages });
    }),
  method: "GET",
  path: identityMessageCountPath,
};

export const deletionRoutes: readonly Route<Caller | Storage>[] = [deleteRoute, messageCountRoute];
