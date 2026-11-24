import { Array as Arr, Context, Effect, Layer, Predicate, PubSub } from "effect";
import type { DeactivationOffer, DeactivationOfferId, DeactivationOfferResponse } from "../../index.ts";
import type { Identity, IdentityName } from "../../../identities/index.ts";
import type { OfferChanges, StorageUnavailable, StoredDeactivationOffer } from "../../../storage/server.ts";
import { deactivationOfferText, isDeactivationOfferId } from "../../index.ts";
import type { AutomaticDeactivationsService } from "./automatic-deactivations.ts";
import type { IdentityChanges } from "../../../identities/server.ts";
import type { Refusal } from "../../../http/index.ts";
import type { Scope } from "effect";
import { Storage } from "../../../storage/server.ts";
import { automaticDeactivationsOn } from "./automatic-deactivations.ts";
import { echoed } from "../../../http/index.ts";

type Fails<Value> = Effect.Effect<Value, Refusal | StorageUnavailable>;

interface OfferChanged {
  readonly recipient: IdentityName;
  readonly deactivationOffer: DeactivationOffer;
}

interface DeactivationOffersService extends AutomaticDeactivationsService {
  readonly list: (
    caller: Identity,
    which: "open" | "all",
  ) => Effect.Effect<readonly DeactivationOffer[], StorageUnavailable>;
  readonly keep: (caller: Identity, asked: string) => Fails<DeactivationOfferResponse>;
  readonly keepUpTo: (caller: Identity, upTo: DeactivationOfferId) => Effect.Effect<void, StorageUnavailable>;
  readonly publish: (changes: OfferChanges) => Effect.Effect<void, StorageUnavailable>;
  readonly changed: Effect.Effect<PubSub.Subscription<OfferChanged>, never, Scope.Scope>;
  readonly presenceChanged: Effect.Effect<void>;
  readonly presenceChanges: Effect.Effect<PubSub.Subscription<true>, never, Scope.Scope>;
}

class DeactivationOffers extends Context.Service<DeactivationOffers, DeactivationOffersService>()(
  "@ai-hero/cookout/inbox/lib/server/deactivation-offers/DeactivationOffers",
) {}

const NOT_FOUND = 404;
const ONE_AT_A_TIME = { concurrency: 1 } as const;
const ONE_WAKE_IS_ENOUGH = 1;

function offerNotFound(asked: string): Refusal {
  return {
    code: "deactivation_offer_not_found",
    message: `You have no deactivation offer ${echoed(asked)}.`,
    status: NOT_FOUND,
  };
}

function shownOffer(
  storage: Storage["Service"],
): (stored: StoredDeactivationOffer) => Effect.Effect<readonly DeactivationOffer[], StorageUnavailable> {
  return ({ cleared, id, identity: name, quietDays, raisedAt }) =>
    Effect.map(storage.findIdentityByName(name), (found) =>
      Arr.map(Arr.fromNullishOr(found), (identity) => ({
        cleared,
        id,
        identity,
        quietDays,
        raisedAt,
        text: deactivationOfferText({ identity: identity.name, kind: identity.kind, quietDays }),
      })),
    );
}

function shownOffers(
  storage: Storage["Service"],
  stored: readonly StoredDeactivationOffer[],
): Effect.Effect<readonly DeactivationOffer[], StorageUnavailable> {
  return Effect.map(Effect.forEach(stored, shownOffer(storage), ONE_AT_A_TIME), Arr.flatten);
}

function changesFor(
  storage: Storage["Service"],
  stored: StoredDeactivationOffer,
): Effect.Effect<readonly OfferChanged[], StorageUnavailable> {
  return Effect.map(shownOffer(storage)(stored), (shown) =>
    Arr.flatMap(shown, (deactivationOffer) =>
      Arr.map(stored.recipients, (recipient) => ({ deactivationOffer, recipient })),
    ),
  );
}

interface Publishing {
  readonly storage: Storage["Service"];
  readonly publishAll: (changed: readonly OfferChanged[]) => Effect.Effect<boolean>;
}

function publishOn({ publishAll, storage }: Publishing): DeactivationOffersService["publish"] {
  return ({ cleared, raised }) =>
    Effect.gen(function* publishChanges() {
      const changed = yield* Effect.forEach([...cleared, ...raised], (stored) => changesFor(storage, stored), {
        concurrency: 1,
      });
      yield* publishAll(Arr.flatten(changed));
    });
}

function keptOffer(
  storage: Storage["Service"],
  caller: Identity,
  asked: string,
): Fails<StoredDeactivationOffer | null> {
  const id = Number(asked);
  if (!isDeactivationOfferId(id)) {
    return Effect.succeed(null);
  }
  return storage.keepDeactivationOffer(caller.name, id);
}

const deactivationOffersLayer: Layer.Layer<DeactivationOffers, never, Storage | IdentityChanges> = Layer.effect(
  DeactivationOffers,
  Effect.gen(function* deactivationOffersOnStorage() {
    const storage = yield* Storage;
    const hub = yield* PubSub.unbounded<OfferChanged>();
    const publish = publishOn({ publishAll: (changed) => PubSub.publishAll(hub, changed), storage });
    const presence = yield* PubSub.sliding<true>(ONE_WAKE_IS_ENOUGH);
    const automatic = yield* automaticDeactivationsOn(storage);
    return {
      ...automatic,
      changed: PubSub.subscribe(hub),
      keep: (caller, asked) =>
        Effect.gen(function* keepOffer() {
          const kept = yield* keptOffer(storage, caller, asked);
          const [deactivationOffer] = yield* shownOffers(storage, Arr.fromNullishOr(kept));
          if (Predicate.isUndefined(deactivationOffer) || kept === null) {
            return yield* Effect.fail(offerNotFound(asked));
          }
          yield* publish({ cleared: [kept], raised: [] });
          return { deactivationOffer };
        }),
      keepUpTo: (caller, upTo) =>
        Effect.flatMap(storage.keepDeactivationOffersUpTo(caller.name, upTo), (cleared) =>
          publish({ cleared, raised: [] }),
        ),
      list: (caller, which) =>
        Effect.flatMap(storage.listDeactivationOffers(caller.name, which), (stored) => shownOffers(storage, stored)),
      presenceChanged: Effect.asVoid(PubSub.publish(presence, true)),
      presenceChanges: PubSub.subscribe(presence),
      publish,
    };
  }),
);

export { DeactivationOffers, deactivationOffersLayer };
