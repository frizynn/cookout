import { Context, Effect, Layer, PubSub } from "effect";
import type { RegisteredCommand } from "../../index.ts";
import type { Scope } from "effect";

interface CommandChangesService {
  readonly publish: (command: RegisteredCommand) => Effect.Effect<void>;
  readonly changed: Effect.Effect<PubSub.Subscription<RegisteredCommand>, never, Scope.Scope>;
}

class CommandChanges extends Context.Service<CommandChanges, CommandChangesService>()(
  "@ai-hero/cookout/webhook-commands/lib/server/changes/CommandChanges",
) {}

const commandChangesLayer: Layer.Layer<CommandChanges> = Layer.effect(
  CommandChanges,
  Effect.gen(function* commandChangesHub() {
    const hub = yield* PubSub.unbounded<RegisteredCommand>();
    return {
      changed: PubSub.subscribe(hub),
      publish: (command: RegisteredCommand) => Effect.asVoid(PubSub.publish(hub, command)),
    };
  }),
);

function announced<Answer extends { readonly command: RegisteredCommand }>(
  answer: Answer,
): Effect.Effect<Answer, never, CommandChanges> {
  return Effect.flatMap(CommandChanges, (changes) => Effect.as(changes.publish(answer.command), answer));
}

export { CommandChanges, announced, commandChangesLayer };
