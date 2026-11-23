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
    name: string,
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

function ownsAgent(caller: Identity, target: Identity): boolean {
  if (caller.kind !== "human" || target.kind !== "agent") {
    return false;
  }
  const owner: string = target.owner ?? "";
  return owner === caller.name;
}

function maySet(caller: Identity, target: Identity): boolean {
  return caller.admin || caller.name === target.name || ownsAgent(caller, target);
}

function settable(
  storage: Storage["Service"],
  caller: Identity,
  sent: string,
): Effect.Effect<IdentityName, Refusal | StorageUnavailable> {
  return Effect.gen(function* findSettable() {
    const name = yield* nameParam({ name: sent });
    const target = yield* storage.findIdentityByName(name);
    if (Predicate.isUndefined(target)) {
      return yield* Effect.fail(identityNotFound(name));
    }
    if (!maySet(caller, target)) {
      return yield* Effect.fail(notOwner(name));
    }
    return name;
  });
}

const displayNamesLayer: Layer.Layer<DisplayNames, never, Storage> = Layer.effect(
  DisplayNames,
  Effect.gen(function* displayNamesOnStorage() {
    const storage = yield* Storage;
    const hub = yield* PubSub.unbounded<Identity>();
    return {
      changed: PubSub.subscribe(hub),
      set: (caller, sent, displayName) =>
        Effect.gen(function* setDisplayName() {
          const name = yield* settable(storage, caller, sent);
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
      const identity = yield* displayNames.set(caller, params["name"] ?? "", displayName);
      return yield* HttpServerResponse.schemaJson(IdentityResponseSchema)({ identity });
    }),
  method: "PUT",
  path: identityDisplayNamePath,
};

const displayNameRoutes: readonly Route<Caller | DisplayNames>[] = [setDisplayNameRoute];

export { DisplayNames, displayNameRoutes, displayNamesLayer };
