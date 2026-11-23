import { Effect, Predicate } from "effect";
import type { Scope } from "effect";
import type { StorageService } from "./service.ts";
import { memoryAgentSessionSections } from "./agent-join-requests-memory.ts";
import { memoryChannels } from "./channels.ts";
import { memoryCommandCalls } from "./command-calls.ts";
import { memoryCommands } from "./commands.ts";
import { memoryHealth } from "./health.ts";
import { memoryIdentitySections } from "./identity-sections.ts";
import { memoryMessages } from "./messages-memory.ts";
import { openMemoryState } from "./memory-state.ts";

function subscribingCreator(
  create: StorageService["createChannel"],
  subscribe: StorageService["subscribeChannel"],
): StorageService["createChannel"] {
  return (channel, creator) =>
    Effect.tap(create(channel), (outcome) => {
      if (outcome === "name_taken" || Predicate.isUndefined(creator)) {
        return Effect.void;
      }
      return subscribe(creator, channel.name);
    });
}

export const openMemoryStorage: Effect.Effect<StorageService, never, Scope.Scope> = Effect.map(
  openMemoryState,
  (state) => {
    const { forgetChannel: dropChannel, ...channels } = memoryChannels(state);
    const { findIdentity, placeHandler, ...identities } = memoryIdentitySections(state);
    const { revokeAgentSessionsOf, ...agentSessions } = memoryAgentSessionSections({ findIdentity, state });
    const { forgetChannel, ...messages } = memoryMessages({ channels, identities, state });
    const { dropCommandTokens, dropCommandTokensOf, dropDeliveries, ...commands } = memoryCommands({
      findIdentity,
      placeHandler,
      state,
    });
    return {
      ...memoryHealth(state),
      ...identities,
      ...channels,
      ...messages,
      ...agentSessions,
      ...commands,
      ...memoryCommandCalls({ ...commands, ...messages }),
      createChannel: subscribingCreator(channels.createChannel, messages.subscribeChannel),
      deactivateIdentity: (name) =>
        Effect.tap(identities.deactivateIdentity(name), (result) => {
          if (result.status !== "deactivated") {
            return Effect.void;
          }
          return Effect.forEach(
            [name, ...result.agents],
            (each) =>
              Effect.andThen(
                revokeAgentSessionsOf(each),
                Effect.sync(() => {
                  dropCommandTokensOf(each);
                }),
              ),
            { concurrency: 1, discard: true },
          );
        }),
      deleteChannel: (name) =>
        Effect.gen(function* deleteChannel() {
          const found = yield* channels.findChannel(name);
          if (Predicate.isUndefined(found)) {
            return found;
          }
          dropChannel(name);
          const threadIds = yield* forgetChannel(name);
          dropCommandTokens(threadIds);
          dropDeliveries(name);
          return found;
        }),
    };
  },
);
