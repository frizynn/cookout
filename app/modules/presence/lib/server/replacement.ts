import { Effect, Stream, SubscriptionRef } from "effect";
import type { Identity, IdentityName } from "../../../identities/index.ts";
import type { Refusal } from "../../../http/index.ts";
import type { Scope } from "effect";
import { watchReplaced } from "../../index.ts";

interface LiveConnection {
  readonly replaced: Effect.Effect<void>;
}

interface Replacements {
  readonly take: (identity: Identity) => Effect.Effect<LiveConnection, never, Scope.Scope>;
}

interface Places {
  readonly holders: ReadonlyMap<IdentityName, number>;
  readonly next: number;
}

const CONFLICT = 409;
const STEP = 1;
const FIRST = 1;
const NEVER_REPLACED: LiveConnection = { replaced: Effect.never };

const watchReplacedRefusal: Refusal = {
  code: watchReplaced,
  message: "replaced by another watch",
  status: CONFLICT,
};

function taken(identity: IdentityName): (places: Places) => readonly [number, Places] {
  return ({ holders, next }) => [next, { holders: new Map([...holders, [identity, next]]), next: next + STEP }];
}

function left(identity: IdentityName, mine: number): (places: Places) => Places {
  return (places) => {
    if (places.holders.get(identity) !== mine) {
      return places;
    }
    const holders = new Map(places.holders);
    holders.delete(identity);
    return { ...places, holders };
  };
}

const openReplacements: Effect.Effect<Replacements> = Effect.gen(function* openAgentsPlaces() {
  const places = yield* SubscriptionRef.make<Places>({ holders: new Map(), next: FIRST });
  const takePlace = Effect.fnUntraced(function* takeAgentsPlace(
    identity: IdentityName,
  ): Effect.fn.Return<LiveConnection, never, Scope.Scope> {
    const mine = yield* SubscriptionRef.modify(places, taken(identity));
    yield* Effect.addFinalizer(() => SubscriptionRef.update(places, left(identity, mine)));
    const replaced = SubscriptionRef.changes(places).pipe(
      Stream.filter(({ holders }) => holders.get(identity) !== mine),
      Stream.runHead,
    );
    return { replaced: Effect.asVoid(replaced) };
  });
  return {
    take: (identity) => {
      if (identity.kind === "human") {
        return Effect.succeed(NEVER_REPLACED);
      }
      return takePlace(identity.name);
    },
  };
});

export { type LiveConnection, openReplacements, watchReplacedRefusal };
