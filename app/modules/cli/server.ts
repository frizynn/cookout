/**
 * The `cookout` command tree. `serve` starts the server; every other verb
 * calls the server through the SDK. Answers are JSON on stdout; refusals are
 * `{ error: { code, message } }` on stderr with exit code 1.
 */
import { Effect } from "effect";
import { CliError, Command } from "effect/cli";
import { jsonPresenter, usageFailed } from "./lib/server/output.ts";
import { cookoutServer, type ServeLayers, serveCommand } from "./lib/server/serve.ts";
import { identityCommand, whoamiCommand } from "./lib/server/verbs.ts";

export { cookoutServer, type ServeLayers };

/** Runs one `cookout` command line (without the `node` and script words). */
export const runCookout = (args: ReadonlyArray<string>, layers: ServeLayers) =>
  Command.make("cookout").pipe(
    Command.withDescription("A self-hosted, Slack-style board for people and agents."),
    Command.withSubcommands([serveCommand(layers), whoamiCommand, identityCommand]),
    (command) => Command.runWith(command, { version: "0.0.0" })(args),
    Effect.catchIf(CliError.isCliError, () => usageFailed),
    Effect.provide(jsonPresenter),
  );
