import { Effect, type Scope } from "effect";
import { memoryChannels } from "./channels.ts";
import { memoryHealth } from "./health.ts";
import { memoryIdentities } from "./identities.ts";
import { memoryMessages } from "./messages-memory.ts";
import { openMemoryState } from "./memory-state.ts";
import type { StorageService } from "./service.ts";

export const openMemoryStorage: Effect.Effect<StorageService, never, Scope.Scope> = Effect.map(
  openMemoryState,
  (state) => {
    const channels = memoryChannels(state);
    return { ...memoryHealth(state), ...memoryIdentities(state), ...channels, ...memoryMessages({ channels, state }) };
  },
);
