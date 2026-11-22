/**
 * The `cookout` command tree. `serve` starts the server; every other verb
 * calls the server through the SDK. Answers are JSON on stdout; refusals are
 * `{ error: { code, message } }` on stderr with exit code 1. `Secrets` comes
 * from the caller: `serve` issues tokens and lease IDs with it, and `join`
 * names its lease-state file with it.
 *
 * `join` keeps its lease in a lease-state file for one server and token, so one
 * identity, under `COOKOUT_STATE_DIR` (default `$XDG_STATE_HOME/cookout`, then
 * `~/.local/state/cookout`). Every later command sends the lease ID from it. The
 * file's name is a hash, so the token is never written to disk. On `lease_lost`
 * the stored lease is deleted and the message says to run `cookout join` again.
 * The state folder and its `leases/` folder must be folders only the user
 * can open (mode 700, not symlinks), or the command fails with
 * `lease_state_unsafe`; `join` makes them so. A lease-state file that can't
 * be read as one is `lease_state_damaged`; any other failure of the CLI
 * itself, rather than a refusal, is `cli_error`.
 */
import { CliError, Command } from "effect/cli";
import { cookoutServer, serveCommand } from "./lib/server/serve.ts";
import { usageFailed, withJsonPresenter } from "./lib/server/output.ts";
import { Effect } from "effect";
import type { ServeLayers } from "./lib/server/serve.ts";
import { verbCommands } from "./lib/server/verbs.ts";

export { cookoutServer, type ServeLayers };

/** Runs one `cookout` command line (without the `node` and script words). */
export const runCookout = (args: readonly string[], layers: ServeLayers) =>
  Command.make("cookout").pipe(
    Command.withDescription("A self-hosted, Slack-style board for people and agents."),
    Command.withSubcommands([serveCommand(layers), ...verbCommands]),
    (command) => Command.runWith(command, { version: "0.0.0" })(args),
    Effect.catchIf(CliError.isCliError, () => usageFailed),
    withJsonPresenter,
  );
