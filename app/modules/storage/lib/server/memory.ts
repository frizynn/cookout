import { Effect, type Scope } from "effect";
import { memoryHealth } from "./health.ts";
import { openMemoryState } from "./memory-state.ts";
import type { StorageService } from "./service.ts";

export const openMemoryStorage: Effect.Effect<StorageService, never, Scope.Scope> = Effect.map(
  openMemoryState,
  (state) => ({ ...memoryHealth(state) }),
);
