import { Context, Effect, Layer, PubSub } from "effect";
import type { Command } from "../../index.ts";
import type { Scope } from "effect";

interface CommandChangesService {
  readonly publish: (command: Command) => Effect.Effect<void>;
  readonly changed: Effect.Effect<PubSub.Subscription<Command>, never, Scope.Scope>;
}

class CommandChanges extends Context.Service<CommandChanges, CommandChangesService>()(
  "@ai-hero/cookout/commands/lib/server/changes/CommandChanges",
) {}

const commandChangesLayer: Layer.Layer<CommandChanges> = Layer.effect(
  CommandChanges,
  Effect.gen(function* commandChangesHub() {
    const hub = yield* PubSub.unbounded<Command>();
    return {
      changed: PubSub.subscribe(hub),
      publish: (command: Command) => Effect.asVoid(PubSub.publish(hub, command)),
    };
  }),
);

function announced<Answer extends { readonly command: Command }>(
  answer: Answer,
): Effect.Effect<Answer, never, CommandChanges> {
  return Effect.flatMap(CommandChanges, (changes) => Effect.as(changes.publish(answer.command), answer));
}

export { CommandChanges, announced, commandChangesLayer };
