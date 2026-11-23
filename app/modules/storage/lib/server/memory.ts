import { Effect } from "effect";
import type { Scope } from "effect";
import type { StorageService } from "./service.ts";
import { memoryChannels } from "./channels.ts";
import { memoryCommandCalls } from "./command-calls.ts";
import { memoryCommands } from "./commands.ts";
import { memoryHealth } from "./health.ts";
import { memoryIdentities } from "./identities.ts";
import { memoryLeases } from "./leases-memory.ts";
import { memoryMessages } from "./messages-memory.ts";
import { openMemoryState } from "./memory-state.ts";

export const openMemoryStorage: Effect.Effect<StorageService, never, Scope.Scope> = Effect.map(
  openMemoryState,
  (state) => {
    const channels = memoryChannels(state);
    const { findIdentity, placeHandler, ...identities } = memoryIdentities(state);
    const { dropLease, ...leases } = memoryLeases(state);
    const { forgetIdentity, ...messages } = memoryMessages({ channels, identities, state });
    const commands = memoryCommands({ findIdentity, placeHandler, state });
    return {
      ...memoryHealth(state),
      ...identities,
      ...channels,
      ...messages,
      ...leases,
      ...commands,
      ...memoryCommandCalls({ ...commands, ...messages }),
      deleteIdentity: (name) =>
        Effect.tap(identities.deleteIdentity(name), (result) =>
          Effect.when(
            Effect.andThen(dropLease(name), forgetIdentity(name)),
            Effect.succeed(result.status === "deleted"),
          ),
        ),
    };
  },
);
