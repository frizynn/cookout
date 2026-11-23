import { Array as Arr, Effect, Redacted } from "effect";
import { e2eAdminToken, e2eUrl } from "../../../config/server.ts";
import { createCookoutClient } from "@ai-hero/cookout/sdk";

const exampleCommand = "example";

function noExampleCommand(url: string): string {
  return (
    `Skipped: ${url} has no command ${exampleCommand}, so the example handler isn't reachable from it. ` +
    "Run pnpm e2e:docker, or scripts/handler-provision.sh on the deployed cookout."
  );
}

const exampleCommandRegistered: Effect.Effect<boolean> = Effect.gen(function* listTheCommands() {
  const url = yield* e2eUrl;
  const adminToken = yield* e2eAdminToken;
  const admin = createCookoutClient({ token: Redacted.value(adminToken), url });
  const { commands } = yield* Effect.promise(() => admin.listCommands());
  const registered = Arr.some(commands, ({ name }) => name === exampleCommand);
  if (!registered) {
    yield* Effect.logWarning(noExampleCommand(url));
  }
  return registered;
}).pipe(Effect.orDie);

export { exampleCommand, exampleCommandRegistered };
