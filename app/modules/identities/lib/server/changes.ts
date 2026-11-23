import { Array as Arr, Context, Effect, Layer, PubSub, Ref } from "effect";
import type { Identity, IdentityName, TokenHash } from "../../index.ts";
import type { Scope } from "effect";

type EndedTokens =
  | { readonly kind: "agent session"; readonly hash: TokenHash }
  | { readonly kind: "agent sessions" }
  | { readonly kind: "identity tokens" }
  | { readonly kind: "all" };

interface TokensEnded {
  readonly identity: IdentityName;
  readonly tokens: EndedTokens;
  readonly cause: "left" | "revoked" | "rotated" | "deactivated";
  readonly by: IdentityName;
}

type TokensEndedHandler = (ended: TokensEnded) => Effect.Effect<void>;

interface IdentityChangesService {
  readonly publish: (identity: Identity) => Effect.Effect<void>;
  readonly changed: Effect.Effect<PubSub.Subscription<Identity>, never, Scope.Scope>;
  readonly publishDeleted: (identity: Identity) => Effect.Effect<void>;
  readonly deleted: Effect.Effect<PubSub.Subscription<Identity>, never, Scope.Scope>;
  readonly endTokens: (ended: TokensEnded) => Effect.Effect<void>;
  readonly onTokensEnded: (handler: TokensEndedHandler) => Effect.Effect<void, never, Scope.Scope>;
}

class IdentityChanges extends Context.Service<IdentityChanges, IdentityChangesService>()(
  "@ai-hero/cookout/identities/lib/server/changes/IdentityChanges",
) {}

const EACH_IN_TURN = { concurrency: 1, discard: true } as const;

const identityChangesLayer: Layer.Layer<IdentityChanges> = Layer.effect(
  IdentityChanges,
  Effect.gen(function* identityChangesHub() {
    const changedHub = yield* PubSub.unbounded<Identity>();
    const deletedHub = yield* PubSub.unbounded<Identity>();
    const handlers = yield* Ref.make<ReadonlySet<TokensEndedHandler>>(new Set());
    return {
      changed: PubSub.subscribe(changedHub),
      deleted: PubSub.subscribe(deletedHub),
      endTokens: (ended) =>
        Effect.flatMap(Ref.get(handlers), (held) =>
          Effect.forEach([...held], (handler) => handler(ended), EACH_IN_TURN),
        ),
      onTokensEnded: (handler) =>
        Effect.acquireRelease(
          Ref.update(handlers, (held) => new Set([...held, handler])),
          () => Ref.update(handlers, (held) => new Set(Arr.filter([...held], (each) => each !== handler))),
        ),
      publish: (identity: Identity) => Effect.asVoid(PubSub.publish(changedHub, identity)),
      publishDeleted: (identity: Identity) => Effect.asVoid(PubSub.publish(deletedHub, identity)),
    };
  }),
);

function announced(identity: Identity): Effect.Effect<Identity, never, IdentityChanges> {
  return Effect.flatMap(IdentityChanges, (changes) => Effect.as(changes.publish(identity), identity));
}

function announcedDeleted(identity: Identity): Effect.Effect<Identity, never, IdentityChanges> {
  return Effect.flatMap(IdentityChanges, (changes) => Effect.as(changes.publishDeleted(identity), identity));
}

function tokensEnded(ended: TokensEnded): Effect.Effect<void, never, IdentityChanges> {
  return Effect.flatMap(IdentityChanges, (changes) => changes.endTokens(ended));
}

export {
  type EndedTokens,
  IdentityChanges,
  type TokensEnded,
  announced,
  announcedDeleted,
  identityChangesLayer,
  tokensEnded,
};
