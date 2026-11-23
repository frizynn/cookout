import { Array as Arr, Effect, Redacted } from "effect";
import { e2eAdminToken, e2eUrl } from "../../../config/server.ts";
import { createCookoutClient } from "@ai-hero/cookout/sdk";

const exampleCommand = "example";

function noExampleCommand(url: string): string {
  return (
    `${url} has no command ${exampleCommand}, so the example handler isn't reachable from it. ` +
    "Run pnpm e2e:docker, or scripts/handler-provision.sh on the deployed cookout."
  );
}

const requireExampleCommand: Effect.Effect<void> = Effect.gen(function* listTheCommands() {
  const url = yield* e2eUrl;
  const adminToken = yield* e2eAdminToken;
  const admin = createCookoutClient({ token: Redacted.value(adminToken), url });
  const { commands } = yield* Effect.promise(() => admin.listCommands());
  const missing = !Arr.some(commands, ({ name }) => name === exampleCommand);
  const failure = new Error(noExampleCommand(url));
  yield* Effect.when(Effect.die(failure), Effect.succeed(missing));
}).pipe(Effect.orDie);

export { exampleCommand, requireExampleCommand };
