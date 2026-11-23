import { Caller, announced, ownsAgent } from "./auth.ts";
import type { Description, Identity, IdentityName } from "../../index.ts";
import { Effect, Option, Predicate, Schema } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import { IdentityResponseSchema, SentDescriptionSchema } from "./wire.ts";
import { identityNotFound, nameParam } from "./routes.ts";
import type { IdentityChanges } from "./auth.ts";
import type { Refusal } from "../../../http/index.ts";
import type { Route } from "../../../http/server.ts";
import { Storage } from "../../../storage/server.ts";
import type { StorageUnavailable } from "../../../storage/server.ts";
import { identityPath } from "../../client.ts";

const FORBIDDEN = 403;

const UpdateIdentityRequestSchema = Schema.Struct({ description: Schema.NullOr(SentDescriptionSchema) });

const identityResponse = HttpServerResponse.schemaJson(IdentityResponseSchema);

function notOwner(name: IdentityName): Refusal {
  return {
    code: "not_owner",
    message: `Only ${name} itself, the human who owns it or an admin can set its description.`,
    status: FORBIDDEN,
  };
}

function humanHasNone(name: IdentityName): Refusal {
  return {
    code: "identity_kind",
    message: `${name} is a human identity; only an agent has a description.`,
    status: FORBIDDEN,
  };
}

function mayDescribe(caller: Identity, target: Identity): boolean {
  return caller.admin || caller.name === target.name || ownsAgent({ caller, target });
}

function refusalFor(caller: Identity, name: IdentityName, target: Identity | undefined): Option.Option<Refusal> {
  if (Predicate.isUndefined(target)) {
    return Option.some(identityNotFound(name));
  }
  if (target.kind === "human") {
    return Option.some(humanHasNone(name));
  }
  if (!mayDescribe(caller, target)) {
    return Option.some(notOwner(name));
  }
  return Option.none();
}

function describable(caller: Identity, name: IdentityName): Effect.Effect<void, Refusal | StorageUnavailable, Storage> {
  return Effect.flatMap(Storage, (storage) =>
    Effect.flatMap(storage.findIdentityByName(name), (target) =>
      Option.match(refusalFor(caller, name, target), { onNone: () => Effect.void, onSome: Effect.fail }),
    ),
  );
}

function described(
  name: IdentityName,
  description: Description | null,
): Effect.Effect<Identity, Refusal | StorageUnavailable, Storage> {
  return Effect.gen(function* setDescription() {
    const storage = yield* Storage;
    const result = yield* storage.setDescription(name, description);
    if (result.status === "not_found") {
      return yield* Effect.fail(identityNotFound(name));
    }
    return result.identity;
  });
}

const updateRoute: Route<Caller | Storage | IdentityChanges> = {
  handle: (params) =>
    Effect.gen(function* updateIdentityRoute() {
      const caller = yield* Caller;
      const { description } = yield* HttpServerRequest.schemaBodyJson(UpdateIdentityRequestSchema);
      const name = yield* nameParam(params);
      yield* describable(caller, name);
      const identity = yield* Effect.flatMap(described(name, description), announced);
      return yield* identityResponse({ identity });
    }),
  method: "PATCH",
  path: identityPath,
};

const descriptionRoutes: readonly Route<Caller | Storage | IdentityChanges>[] = [updateRoute];

export { descriptionRoutes };
