import { Effect, type Scope } from "effect";
import { memoryChannels } from "./channels.ts";
import { memoryHealth } from "./health.ts";
import { memoryIdentities } from "./identities.ts";
import { memoryLeases } from "./leases-memory.ts";
import { memoryMessages } from "./messages-memory.ts";
import { openMemoryState } from "./memory-state.ts";
import type { StorageService } from "./service.ts";

export const openMemoryStorage: Effect.Effect<StorageService, never, Scope.Scope> = Effect.map(
  openMemoryState,
  (state) => {
    const channels = memoryChannels(state);
    const identities = memoryIdentities(state);
    const { dropLease, ...leases } = memoryLeases(state);
    return {
      ...memoryHealth(state),
      ...identities,
      ...channels,
      ...memoryMessages({ channels, state }),
      ...leases,
      deleteIdentity: (name) =>
        Effect.tap(identities.deleteIdentity(name), (result) =>
          Effect.when(dropLease(name), Effect.succeed(result.status === "deleted")),
        ),
    };
  },
);
