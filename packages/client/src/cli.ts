import { parseArgs } from "node:util";
import { CookoutError, createCookoutClient } from "./sdk.ts";

export type CliIo = {
  /** Where `COOKOUT_URL` and `COOKOUT_TOKEN` are read from. */
  env: Record<string, string | undefined>;
  stdout(text: string): void;
  stderr(text: string): void;
  /** Defaults to the global `fetch`. */
  fetch?: typeof fetch;
};

const usage = `Usage:
  cookout whoami
  cookout identity list
  cookout identity create <name> [--owner <person>]   (admin)
  cookout identity rotate <name>                       (admin)
  cookout identity delete <name>                       (admin)

Reads COOKOUT_URL and COOKOUT_TOKEN. Prints JSON on stdout; errors are JSON on stderr.`;

class UsageError extends Error {}

/**
 * Runs one `cookout` CLI verb (everything except `serve`, which the published
 * package handles). Prints the JSON answer on stdout and returns the exit code.
 */
export async function runCli(args: readonly string[], io: CliIo): Promise<number> {
  const printError = (code: string, message: string, status?: number): void => {
    io.stderr(`${JSON.stringify({ error: status === undefined ? { code, message } : { code, message, status } })}\n`);
  };

  try {
    const { values, positionals } = parseArgs({
      args: [...args],
      allowPositionals: true,
      strict: true,
      options: { owner: { type: "string" }, help: { type: "boolean", short: "h" } },
    });
    if (values.help === true || positionals.length === 0) {
      io.stdout(`${usage}\n`);
      return values.help === true ? 0 : 1;
    }
    const result = await run(positionals, values.owner, io);
    io.stdout(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  } catch (error) {
    if (error instanceof CookoutError) {
      printError(error.code, error.message, error.status === 0 ? undefined : error.status);
    } else if (error instanceof UsageError || (error instanceof TypeError && "code" in error)) {
      // parseArgs throws TypeErrors with a `code` for unknown or bad options.
      printError("usage", `${error.message}\n\n${usage}`);
    } else {
      printError("cli_error", error instanceof Error ? error.message : String(error));
    }
    return 1;
  }
}

async function run(positionals: string[], owner: string | undefined, io: CliIo): Promise<unknown> {
  const [verb, subverb, name, ...rest] = positionals;
  const client = () => createCookoutClient(io.fetch === undefined ? { env: io.env } : { env: io.env, fetch: io.fetch });
  const noOwner = (): void => {
    if (owner !== undefined) throw new UsageError("--owner is only for `identity create`.");
  };

  if (verb === "whoami" && subverb === undefined) {
    noOwner();
    return client().whoami();
  }
  if (verb === "identity") {
    if (subverb === "list" && name === undefined) {
      noOwner();
      return client().listIdentities();
    }
    if (name !== undefined && rest.length === 0) {
      if (subverb === "create") {
        return client().createIdentity(owner === undefined ? { name } : { name, owner });
      }
      noOwner();
      if (subverb === "rotate") return client().rotateToken(name);
      if (subverb === "delete") return client().deleteIdentity(name);
    }
  }
  throw new UsageError(`Unknown command: cookout ${positionals.join(" ")}`);
}
