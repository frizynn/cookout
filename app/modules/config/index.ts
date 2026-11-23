/**
 * The plain-TS reader of `COOKOUT_URL` and `COOKOUT_TOKEN`, for the SDK's
 * defaults, the one place that tells from the environment which agent tool runs
 * the process, and the shape of a connection to a cookout server, which the SDK
 * and the CLI share. In a browser there is no environment, so it reads nothing.
 * Recognise another agent tool by adding its entry to `agentTools`, and its
 * variables to `agentToolVariables`.
 */

type Environment = Readonly<Record<string, string | undefined>>;

interface AgentToolMarkers {
  readonly tool: string;
  readonly isRunning: (env: Environment) => boolean;
}

const NOTHING = {};
const ALLOW_HUMAN = "COOKOUT_ALLOW_HUMAN";

function processEnvironment(): Environment {
  if (typeof process === "undefined") {
    return NOTHING;
  }
  return process.env;
}

function isSet(value: string | undefined): boolean {
  return (value ?? "") !== "";
}

const agentTools: readonly AgentToolMarkers[] = [
  { isRunning: (env) => env["CLAUDECODE"] === "1", tool: "claude-code" },
  { isRunning: (env) => isSet(env["CODEX_THREAD_ID"]) || env["CODEX_CI"] === "1", tool: "codex" },
  { isRunning: (env) => isSet(env["CURSOR_AGENT"]), tool: "cursor" },
  { isRunning: (env) => env["GEMINI_CLI"] === "1", tool: "gemini-cli" },
  { isRunning: (env) => env["CLINE_ACTIVE"] === "true", tool: "cline" },
  { isRunning: (env) => env["OPENCODE"] === "1", tool: "opencode" },
  { isRunning: (env) => isSet(env["AI_AGENT"]), tool: "claude-code" },
];

function urlIn(env: Environment): { readonly url?: string } {
  const url = env["COOKOUT_URL"] ?? "";
  if (url === "") {
    return NOTHING;
  }
  return { url };
}

/** Every variable `agentToolIn` reads, for a reader of the environment that must name what it reads (the CLI). */
export const agentToolVariables: readonly string[] = [
  "CLAUDECODE",
  "CODEX_THREAD_ID",
  "CODEX_CI",
  "CURSOR_AGENT",
  "GEMINI_CLI",
  "CLINE_ACTIVE",
  "OPENCODE",
  "AI_AGENT",
  ALLOW_HUMAN,
];

/**
 * The agent tool `env` shows runs the process, such as `claude-code` (Claude Code sets `CLAUDECODE=1` and
 * `AI_AGENT`), `codex`, `cursor`, `gemini-cli`, `cline` or `opencode`, unless `COOKOUT_ALLOW_HUMAN=1` says a human's token is meant to be used from it. A guard against
 * accidents, not a security boundary (ADR 0038).
 * @param env Where the markers are read from.
 * @returns The tool's name, if one is found and not overridden.
 */
export function agentToolIn(env: Environment): { readonly agentTool?: string } {
  if (env[ALLOW_HUMAN] === "1") {
    return NOTHING;
  }
  for (const { isRunning, tool } of agentTools) {
    if (isRunning(env)) {
      return { agentTool: tool };
    }
  }
  return NOTHING;
}

/**
 * Where a client connects: the server's base URL, the bearer token if there is one, and the agent tool running the
 * process if one was found, which the client names in `cookout-agent-tool` on every request.
 */
export interface CookoutConnection {
  readonly url: string;
  readonly token?: string;
  readonly agentTool?: string;
}

/**
 * `COOKOUT_URL` and `COOKOUT_TOKEN` from `env` (by default the process's), as
 * much of a connection as they give, and with a token read from `env` the agent
 * tool `env` shows runs the process. An empty variable counts as unset.
 * @param env Where the variables are read from.
 * @returns The URL, the token and the agent tool, each only if set.
 */
export function readCookoutConnection(env: Environment = processEnvironment()): Partial<CookoutConnection> {
  const token = env["COOKOUT_TOKEN"] ?? "";
  if (token === "") {
    return urlIn(env);
  }
  return { ...urlIn(env), token, ...agentToolIn(env) };
}
