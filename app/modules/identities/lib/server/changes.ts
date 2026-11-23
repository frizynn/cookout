import { Context, Effect, Layer, PubSub } from "effect";
import type { Identity } from "../../index.ts";
import type { Scope } from "effect";

interface IdentityChangesService {
  readonly publish: (identity: Identity) => Effect.Effect<void>;
  readonly changed: Effect.Effect<PubSub.Subscription<Identity>, never, Scope.Scope>;
}

class IdentityChanges extends Context.Service<IdentityChanges, IdentityChangesService>()(
  "@ai-hero/cookout/identities/lib/server/changes/IdentityChanges",
) {}

const identityChangesLayer: Layer.Layer<IdentityChanges> = Layer.effect(
  IdentityChanges,
  Effect.gen(function* identityChangesHub() {
    const hub = yield* PubSub.unbounded<Identity>();
    return {
      changed: PubSub.subscribe(hub),
      publish: (identity: Identity) => Effect.asVoid(PubSub.publish(hub, identity)),
    };
  }),
);

function announced(identity: Identity): Effect.Effect<Identity, never, IdentityChanges> {
  return Effect.flatMap(IdentityChanges, (changes) => Effect.as(changes.publish(identity), identity));
}

export { IdentityChanges, announced, identityChangesLayer };
