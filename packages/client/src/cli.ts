import { parseArgs } from "node:util";
import type { ListMessagesQuery, PostMessageRequest } from "@ai-hero/cookout-protocol";
import type { CookoutClient } from "./sdk.ts";
import { CookoutError, createCookoutClient } from "./sdk.ts";
import type { LeaseStateFile } from "./lease-state.ts";
import { leaseStateFile, stateDirectory } from "./lease-state.ts";

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
  cookout channel create <name> [--description <text>]
  cookout channel list
  cookout channel get <name>
  cookout message post <channel> <text> [--data <json>] [--reply-to <message-id>]
  cookout message list <channel> [--before <message-id>] [--limit <n>]
  cookout thread get <message-id>
  cookout join --as <name> [--force]
  cookout leave

Reads COOKOUT_URL and COOKOUT_TOKEN. Prints JSON on stdout; errors are JSON on stderr.
\`join\` keeps the lease ID in COOKOUT_STATE_DIR (default ~/.local/state/cookout) and
every later call sends it, which keeps the lease alive. Two sessions on one machine with
the same token share a lease unless their COOKOUT_STATE_DIR differs.`;

class UsageError extends Error {}

const options = {
  owner: { type: "string" },
  description: { type: "string" },
  data: { type: "string" },
  "reply-to": { type: "string" },
  before: { type: "string" },
  limit: { type: "string" },
  as: { type: "string" },
  force: { type: "boolean" },
  help: { type: "boolean", short: "h" },
} as const;

const optionNames = ["owner", "description", "data", "reply-to", "before", "limit", "as", "force"] as const;
type OptionName = (typeof optionNames)[number];
type Values = Partial<Record<Exclude<OptionName, "force">, string>> & { force?: boolean };

/** What a verb knows about the session beyond its client. */
type Session = {
  /** The lease state file for this server and token, or `undefined` without a token. */
  leaseState: LeaseStateFile | undefined;
  url: string;
};

/** One verb: how many positionals it takes, which options it allows, and what it does. */
type Verb = {
  words: readonly string[];
  args: number;
  options: readonly OptionName[];
  run(client: CookoutClient, args: string[], values: Values, session: Session): Promise<unknown>;
};

/** A whole number from an option or argument, or a usage error. */
function wholeNumber(name: string, text: string): number {
  if (!/^\d+$/.test(text)) throw new UsageError(`${name} must be a whole number, not ${JSON.stringify(text)}.`);
  return Number(text);
}

/** Parsed JSON for `--data`. The server checks the value itself, like every other body. */
function jsonValue(text: string): PostMessageRequest["data"] {
  try {
    const value: PostMessageRequest["data"] = JSON.parse(text);
    return value;
  } catch {
    throw new UsageError(`--data must be JSON, not ${JSON.stringify(text)}.`);
  }
}

const verbs: readonly Verb[] = [
  { words: ["whoami"], args: 0, options: [], run: (client) => client.whoami() },
  { words: ["identity", "list"], args: 0, options: [], run: (client) => client.listIdentities() },
  {
    words: ["identity", "create"],
    args: 1,
    options: ["owner"],
    run: (client, [name = ""], { owner }) => client.createIdentity(owner === undefined ? { name } : { name, owner }),
  },
  { words: ["identity", "rotate"], args: 1, options: [], run: (client, [name = ""]) => client.rotateToken(name) },
  { words: ["identity", "delete"], args: 1, options: [], run: (client, [name = ""]) => client.deleteIdentity(name) },
  {
    words: ["channel", "create"],
    args: 1,
    options: ["description"],
    run: (client, [name = ""], { description }) =>
      client.createChannel(description === undefined ? { name } : { name, description }),
  },
  { words: ["channel", "list"], args: 0, options: [], run: (client) => client.listChannels() },
  { words: ["channel", "get"], args: 1, options: [], run: (client, [name = ""]) => client.getChannel(name) },
  {
    words: ["message", "post"],
    args: 2,
    options: ["data", "reply-to"],
    run: (client, [channel = "", text = ""], values) => {
      const body: PostMessageRequest = { channel, text };
      if (values.data !== undefined) body.data = jsonValue(values.data);
      if (values["reply-to"] !== undefined) body.replyTo = wholeNumber("--reply-to", values["reply-to"]);
      return client.postMessage(body);
    },
  },
  {
    words: ["message", "list"],
    args: 1,
    options: ["before", "limit"],
    run: (client, [channel = ""], values) => {
      const query: ListMessagesQuery = {};
      if (values.before !== undefined) query.before = wholeNumber("--before", values.before);
      if (values.limit !== undefined) query.limit = wholeNumber("--limit", values.limit);
      return client.listMessages(channel, query);
    },
  },
  {
    words: ["thread", "get"],
    args: 1,
    options: [],
    run: (client, [id = ""]) => client.getThread(wholeNumber("<message-id>", id)),
  },
  {
    words: ["join"],
    args: 0,
    options: ["as", "force"],
    run: async (client, _args, values, session) => {
      if (values.as === undefined) throw new UsageError("`cookout join` needs --as <name>, the token's own identity.");
      const lease = await client.join(values.force === true ? { as: values.as, force: true } : { as: values.as });
      session.leaseState?.write({ identity: values.as, url: session.url, ...lease });
      return lease;
    },
  },
  {
    words: ["leave"],
    args: 0,
    options: [],
    run: async (client, _args, _values, session) => {
      const left = await client.leave();
      session.leaseState?.remove();
      return left;
    },
  },
];

/**
 * Runs one `cookout` CLI verb (everything except `serve`, which the published
 * package handles). Prints the JSON answer on stdout and returns the exit code.
 */
export async function runCli(args: readonly string[], io: CliIo): Promise<number> {
  const printError = (code: string, message: string, status?: number, details?: unknown): void => {
    const error: Record<string, unknown> = { code, message };
    if (status !== undefined) error["status"] = status;
    if (details !== undefined) error["details"] = details;
    io.stderr(`${JSON.stringify({ error })}\n`);
  };

  try {
    const { values, positionals } = parseArgs({ args: [...args], allowPositionals: true, strict: true, options });
    if (values.help === true || positionals.length === 0) {
      io.stdout(`${usage}\n`);
      return values.help === true ? 0 : 1;
    }
    const result = await run(positionals, values, io);
    io.stdout(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  } catch (error) {
    if (error instanceof CookoutError) {
      printError(error.code, error.message, error.status === 0 ? undefined : error.status, error.details);
    } else if (error instanceof UsageError || (error instanceof TypeError && "code" in error)) {
      // parseArgs throws TypeErrors with a `code` for unknown or bad options.
      printError("usage", `${error.message}\n\n${usage}`);
    } else {
      printError("cli_error", error instanceof Error ? error.message : String(error));
    }
    return 1;
  }
}

async function run(positionals: string[], values: Values, io: CliIo): Promise<unknown> {
  const verb = verbs.find(
    (candidate) =>
      candidate.words.every((word, i) => positionals[i] === word) &&
      positionals.length === candidate.words.length + candidate.args,
  );
  if (verb === undefined) throw new UsageError(`Unknown command: cookout ${positionals.join(" ")}`);
  for (const name of optionNames) {
    if (values[name] !== undefined && !verb.options.includes(name)) {
      throw new UsageError(`--${name} is not an option of \`cookout ${verb.words.join(" ")}\`.`);
    }
  }
  const url = (io.env["COOKOUT_URL"] ?? "").replace(/\/+$/, "");
  const token = io.env["COOKOUT_TOKEN"];
  const leaseState =
    url === "" || token === undefined || token === "" ? undefined : leaseStateFile(stateDirectory(io.env), url, token);
  // A saved lease ID goes on every call, which renews it while it is live.
  // A lost one only matters to actions that need the lease (409 `lease_lost`).
  const leaseId = leaseState?.read()?.leaseId;
  const client = createCookoutClient({
    env: io.env,
    ...(io.fetch === undefined ? {} : { fetch: io.fetch }),
    ...(leaseId === undefined ? {} : { leaseId }),
  });
  try {
    return await verb.run(client, positionals.slice(verb.words.length), values, { leaseState, url });
  } catch (error) {
    // The lease is gone: forget it, and say how to take the identity again.
    if (error instanceof CookoutError && error.code === "lease_lost") {
      const identity = leaseState?.read()?.identity ?? "<name>";
      leaseState?.remove();
      throw new CookoutError({
        status: error.status,
        code: error.code,
        message: `${error.message} The stored lease was deleted; run \`cookout join --as ${identity}\` to take it again.`,
        details: error.details,
      });
    }
    throw error;
  }
}
