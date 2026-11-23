import { Array as Arr, Effect } from "effect";
import type { CookoutUnderTestService } from "./cookout-under-test.ts";

const exampleCommand = "example";

function noExampleCommand(url: string): string {
  return (
    `${url} has no command ${exampleCommand}, so the example handler isn't reachable from it. ` +
    "Run pnpm e2e:docker, or scripts/handler-provision.sh on the deployed cookout."
  );
}

function requireExampleCommand({ admin, url }: CookoutUnderTestService): Effect.Effect<void> {
  return Effect.gen(function* listTheCommands() {
    const { commands } = yield* Effect.promise(() => admin.listCommands());
    const missing = !Arr.some(commands, ({ name }) => name === exampleCommand);
    const failure = new Error(noExampleCommand(url));
    yield* Effect.when(Effect.die(failure), Effect.succeed(missing));
  });
}

export { exampleCommand, requireExampleCommand };
