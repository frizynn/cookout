import { Caller, announced, issueToken, requireAdmin } from "./auth.ts";
import type { DeactivateIdentityResponse, Identity, IdentityName, Owner } from "../../index.ts";
import { DeactivateIdentityResponseSchema, IdentityWithTokenResponseSchema } from "./wire.ts";
import type {
  DeactivateIdentityResult,
  ReactivateIdentityResult,
  StorageUnavailable,
} from "../../../storage/server.ts";
import { Effect, Predicate } from "effect";
import { identityDeactivatePath, identityReactivatePath } from "../../index.ts";
import { identityNotFound, nameParam } from "./routes.ts";
import { HttpServerResponse } from "effect/http";
import type { IdentityChanges } from "./auth.ts";
import type { Refusal } from "../../../http/index.ts";
import type { Route } from "../../../http/server.ts";
import type { Secrets } from "../../../secrets/server.ts";
import { Storage } from "../../../storage/server.ts";

const FORBIDDEN = 403;
const CONFLICT = 409;

function notOwner(name: IdentityName): Refusal {
  return {
    code: "not_owner",
    message: `Only an admin or the human who owns ${name} can do this.`,
    status: FORBIDDEN,
  };
}

function lastAdmin(name: IdentityName): Refusal {
  return {
    code: "last_admin",
    message: `${name} is the last admin. Make another admin before deactivating it.`,
    status: CONFLICT,
  };
}

function notDeactivated(name: IdentityName): Refusal {
  return { code: "not_deactivated", message: `${name} is not deactivated.`, status: CONFLICT };
}

function ownerDeactivated(name: IdentityName, owner: Owner): Refusal {
  return {
    code: "owner_deactivated",
    details: { owner },
    message: `${name}'s owner, ${owner}, is deactivated. Reactivate ${owner} first.`,
    status: CONFLICT,
  };
}

function ownsAgent(caller: Identity, target: Identity): boolean {
  return caller.kind === "human" && target.kind === "agent" && target.owner === caller.name;
}

function mayChange(caller: Identity, target: Identity | undefined): boolean {
  return caller.admin || (Predicate.isNotUndefined(target) && ownsAgent(caller, target));
}

function requireAdminOrOwner(name: IdentityName): Effect.Effect<void, Refusal | StorageUnavailable, Caller | Storage> {
  return Effect.gen(function* adminOrOwner() {
    const caller = yield* Caller;
    const storage = yield* Storage;
    const target = yield* storage.findIdentityByName(name);
    return yield* Effect.when(Effect.fail(notOwner(name)), Effect.succeed(!mayChange(caller, target)));
  }).pipe(Effect.asVoid);
}

function deactivatedOrRefused(
  name: IdentityName,
  result: DeactivateIdentityResult,
): Effect.Effect<DeactivateIdentityResponse, Refusal> {
  if (result.status === "deactivated") {
    return Effect.succeed({ agents: result.agents, identity: result.identity });
  }
  if (result.status === "last_admin") {
    return Effect.fail(lastAdmin(name));
  }
  return Effect.fail(identityNotFound(name));
}

function reactivatedOrRefused(name: IdentityName, result: ReactivateIdentityResult): Effect.Effect<Identity, Refusal> {
  if (result.status === "reactivated") {
    return Effect.succeed(result.identity);
  }
  if (result.status === "not_deactivated") {
    return Effect.fail(notDeactivated(name));
  }
  if (result.status === "owner_deactivated") {
    return Effect.fail(ownerDeactivated(name, result.owner));
  }
  return Effect.fail(identityNotFound(name));
}

function announceDeactivated(
  answer: DeactivateIdentityResponse,
): Effect.Effect<void, StorageUnavailable, Storage | IdentityChanges> {
  return Effect.gen(function* announceEach() {
    const storage = yield* Storage;
    yield* announced(answer.identity);
    for (const agent of answer.agents) {
      const found = yield* storage.findIdentityByName(agent);
      if (Predicate.isNotUndefined(found)) {
        yield* announced(found);
      }
    }
  });
}

const deactivateRoute: Route<Caller | Storage | IdentityChanges> = {
  handle: (params) =>
    Effect.gen(function* deactivateIdentityRoute() {
      const name = yield* nameParam(params);
      yield* requireAdminOrOwner(name);
      const storage = yield* Storage;
      const answer = yield* Effect.flatMap(storage.deactivateIdentity(name), (result) =>
        deactivatedOrRefused(name, result),
      );
      yield* announceDeactivated(answer);
      return yield* HttpServerResponse.schemaJson(DeactivateIdentityResponseSchema)(answer);
    }),
  method: "POST",
  path: identityDeactivatePath,
};

function requireMayReactivate(name: IdentityName): Effect.Effect<void, Refusal | StorageUnavailable, Caller | Storage> {
  return Effect.gen(function* mayReactivate() {
    const storage = yield* Storage;
    const target = yield* storage.findIdentityByName(name);
    if (Predicate.isNotUndefined(target) && target.kind === "human") {
      return yield* requireAdmin;
    }
    return yield* requireAdminOrOwner(name);
  });
}

const reactivateRoute: Route<Caller | Storage | Secrets | IdentityChanges> = {
  handle: (params) =>
    Effect.gen(function* reactivateIdentityRoute() {
      const name = yield* nameParam(params);
      yield* requireMayReactivate(name);
      const { hash, token } = yield* issueToken;
      const storage = yield* Storage;
      const identity = yield* Effect.flatMap(storage.reactivateIdentity(name, hash), (result) =>
        reactivatedOrRefused(name, result),
      ).pipe(Effect.flatMap(announced));
      return yield* HttpServerResponse.schemaJson(IdentityWithTokenResponseSchema)({ identity, token });
    }),
  method: "POST",
  path: identityReactivatePath,
};

export const deactivationRoutes: readonly Route<Caller | Storage | Secrets | IdentityChanges>[] = [
  deactivateRoute,
  reactivateRoute,
];
