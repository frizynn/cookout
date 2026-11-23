import { Context, Effect, Layer, Predicate, PubSub, Schema } from "effect";
import type { DisplayName, Identity, IdentityName } from "../../index.ts";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import { IdentityResponseSchema, SentDisplayNameSchema } from "./wire.ts";
import { identityNotFound, nameParam } from "./routes.ts";
import { Caller } from "./auth.ts";
import type { Refusal } from "../../../http/index.ts";
import type { Route } from "../../../http/server.ts";
import type { Scope } from "effect";
import { Storage } from "../../../storage/server.ts";
import type { StorageUnavailable } from "../../../storage/server.ts";
import { identityDisplayNamePath } from "../../index.ts";

const FORBIDDEN = 403;

const SetDisplayNameRequestSchema = Schema.Struct({ displayName: Schema.NullOr(SentDisplayNameSchema) });

interface DisplayNamesService {
  readonly set: (
    caller: Identity,
    name: IdentityName,
    displayName: DisplayName | null,
  ) => Effect.Effect<Identity, Refusal | StorageUnavailable>;
  readonly changed: Effect.Effect<PubSub.Subscription<Identity>, never, Scope.Scope>;
}

class DisplayNames extends Context.Service<DisplayNames, DisplayNamesService>()(
  "@ai-hero/cookout/identities/lib/server/display-names/DisplayNames",
) {}

function notOwner(name: string): Refusal {
  return {
    code: "not_owner",
    message: `Only ${name} itself, the human who owns it or an admin can set its display name.`,
    status: FORBIDDEN,
  };
}

function ownsAgent(caller: Identity, target: Identity | undefined): boolean {
  if (Predicate.isUndefined(target) || caller.kind !== "human" || target.kind !== "agent") {
    return false;
  }
  const owner: string = target.owner ?? "";
  return owner === caller.name;
}

function maySet(caller: Identity, name: IdentityName, target: Identity | undefined): boolean {
  return caller.admin || caller.name === name || ownsAgent(caller, target);
}

function requireMaySet(
  storage: Storage["Service"],
  caller: Identity,
  name: IdentityName,
): Effect.Effect<void, Refusal | StorageUnavailable> {
  return storage.findIdentityByName(name).pipe(
    Effect.filterOrFail(
      (target) => maySet(caller, name, target),
      () => notOwner(name),
    ),
    Effect.asVoid,
  );
}

const displayNamesLayer: Layer.Layer<DisplayNames, never, Storage> = Layer.effect(
  DisplayNames,
  Effect.gen(function* displayNamesOnStorage() {
    const storage = yield* Storage;
    const hub = yield* PubSub.unbounded<Identity>();
    return {
      changed: PubSub.subscribe(hub),
      set: (caller, name, displayName) =>
        Effect.gen(function* setDisplayName() {
          yield* requireMaySet(storage, caller, name);
          const result = yield* storage.setDisplayName(name, displayName);
          if (result.status === "not_found") {
            return yield* Effect.fail(identityNotFound(name));
          }
          yield* PubSub.publish(hub, result.identity);
          return result.identity;
        }),
    };
  }),
);

const setDisplayNameRoute: Route<Caller | DisplayNames> = {
  handle: (params) =>
    Effect.gen(function* setDisplayNameFromRequest() {
      const caller = yield* Caller;
      const { displayName } = yield* HttpServerRequest.schemaBodyJson(SetDisplayNameRequestSchema);
      const displayNames = yield* DisplayNames;
      const name = yield* nameParam(params);
      const identity = yield* displayNames.set(caller, name, displayName);
      return yield* HttpServerResponse.schemaJson(IdentityResponseSchema)({ identity });
    }),
  method: "PUT",
  path: identityDisplayNamePath,
};

const displayNameRoutes: readonly Route<Caller | DisplayNames>[] = [setDisplayNameRoute];

export { DisplayNames, displayNameRoutes, displayNamesLayer };
