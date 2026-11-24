import type { DeactivationOffersSection } from "./deactivation-offers.ts";
import { Effect } from "effect";
import type { NudgesSection } from "./nudges.ts";
import type { Scope } from "effect";
import type { StorageService } from "./service.ts";
import { memoryDeactivationOffers } from "./deactivation-offers-memory.ts";
import { memoryNudges } from "./nudges-memory.ts";
import { openMemoryStorage } from "./memory.ts";
import { withActivity } from "./activity.ts";

type FullStorage = StorageService & NudgesSection & DeactivationOffersSection;

const openMemoryStore: Effect.Effect<FullStorage, never, Scope.Scope> = Effect.gen(function* openMemoryStore() {
  const storage = yield* openMemoryStorage;
  const nudges = yield* memoryNudges(storage);
  const offers = yield* memoryDeactivationOffers(storage);
  return withActivity({ record: offers.recordActivity, store: { ...storage, ...nudges, ...offers } });
});

export { type FullStorage, openMemoryStore };
