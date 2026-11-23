/**
 * The plain-TS reader of `COOKOUT_URL`, `COOKOUT_TOKEN` and `COOKOUT_SESSION`, for the SDK's
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
  readonly sessionVariables: readonly string[];
}

declare const brand: unique symbol;

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
  {
    isRunning: (env) => env["CLAUDECODE"] === "1",
    sessionVariables: ["CLAUDE_CODE_SESSION_ID"],
    tool: "claude-code",
  },
  {
    isRunning: (env) => isSet(env["CODEX_THREAD_ID"]) || env["CODEX_CI"] === "1",
    sessionVariables: [],
    tool: "codex",
  },
  { isRunning: (env) => isSet(env["CURSOR_AGENT"]), sessionVariables: [], tool: "cursor" },
  { isRunning: (env) => env["GEMINI_CLI"] === "1", sessionVariables: [], tool: "gemini-cli" },
  { isRunning: (env) => env["CLINE_ACTIVE"] === "true", sessionVariables: [], tool: "cline" },
  { isRunning: (env) => env["OPENCODE"] === "1", sessionVariables: [], tool: "opencode" },
];

const knownAiAgentTool = /^(?<tool>claude-code|opencode)(?:_.*)?$/u;
const disallowedInToolName = /[^a-z0-9-]+/gu;
const longerThanToolName = /^(?<kept>[a-z0-9-]{40}).+$/u;
const UNKNOWN_TOOL = "unknown";

function toolNamedBy(value: string): string {
  const sanitised = value
    .replace(knownAiAgentTool, "$<tool>")
    .replaceAll(disallowedInToolName, "-")
    .replace(/^-+/u, "")
    .replace(longerThanToolName, "$<kept>")
    .replace(/-+$/u, "");
  if (sanitised === "") {
    return UNKNOWN_TOOL;
  }
  return sanitised;
}

function aiAgentToolIn(env: Environment): { readonly agentTool?: string } {
  const value = (env["AI_AGENT"] ?? "").toLowerCase();
  if (value === "") {
    return NOTHING;
  }
  return { agentTool: toolNamedBy(value) };
}

function urlIn(env: Environment): { readonly url?: string } {
  const url = env["COOKOUT_URL"] ?? "";
  if (url === "") {
    return NOTHING;
  }
  return { url };
}

function isAgentToolSessionId(value: string): value is AgentToolSessionId {
  return value !== "";
}

function sessionIdOf(tool: string, env: Environment): { readonly sessionId?: AgentToolSessionId } {
  const values = agentTools
    .filter((markers) => markers.tool === tool)
    .flatMap((markers) => markers.sessionVariables)
    .map((variable) => env[variable] ?? "");
  for (const value of values) {
    if (isAgentToolSessionId(value)) {
      return { sessionId: value };
    }
  }
  return NOTHING;
}

function tokenIn(env: Environment): string {
  const token = env["COOKOUT_TOKEN"] ?? "";
  if (token !== "") {
    return token;
  }
  return env["COOKOUT_SESSION"] ?? "";
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
  "CLAUDE_CODE_SESSION_ID",
  ALLOW_HUMAN,
];

/**
 * The agent tool `env` shows runs the process, such as `claude-code` (Claude Code sets `CLAUDECODE=1` and
 * `AI_AGENT`), `codex`, `cursor`, `gemini-cli`, `cline` or `opencode`, or, with only `AI_AGENT` set, the tool its value
 * names: `claude-code` for `claude-code_<version>_agent`, `opencode`, or else the value lowercased, with each run of
 * other characters made `-` and cut to 40 characters (`unknown` if nothing is left), unless `COOKOUT_ALLOW_HUMAN=1` says a human's token is meant to be used from it. A guard against
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
  return aiAgentToolIn(env);
}

/** The ID an agent tool gives its session, shared by the session's subagents, such as `CLAUDE_CODE_SESSION_ID`. */
export type AgentToolSessionId = string & { readonly [brand]: "AgentToolSessionId" };

/** An agent tool session: the tool that runs the process, and its session ID if the tool gives one. */
export interface AgentToolSession {
  readonly agentTool?: string;
  readonly sessionId?: AgentToolSessionId;
}

/**
 * The agent tool session `env` shows runs the process, whatever `COOKOUT_ALLOW_HUMAN` says: the tool `agentToolIn`
 * names, and the session ID from the tool's own variable (`CLAUDE_CODE_SESSION_ID` for Claude Code, whose subagents
 * share their parent's), which `cookout join` keys its agent session by (mattpocock/cookout#116).
 * @param env Where the markers are read from.
 * @returns The tool and its session ID, or nothing outside an agent tool.
 */
export function agentToolSessionIn(env: Environment): AgentToolSession {
  const { agentTool = "" } = agentToolIn({ ...env, [ALLOW_HUMAN]: "" });
  if (agentTool === "") {
    return NOTHING;
  }
  return { agentTool, ...sessionIdOf(agentTool, env) };
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
 * `COOKOUT_URL` and the token from `env` (by default the process's), as much of a connection as they give: the token
 * is `COOKOUT_TOKEN`, else the agent session token in `COOKOUT_SESSION`. With a token read from `env`, it adds the
 * agent tool `env` shows runs the process. An empty variable counts as unset.
 * @param env Where the variables are read from.
 * @returns The URL, the token and the agent tool, each only if set.
 */
export function readCookoutConnection(env: Environment = processEnvironment()): Partial<CookoutConnection> {
  const token = tokenIn(env);
  if (token === "") {
    return urlIn(env);
  }
  return { ...urlIn(env), token, ...agentToolIn(env) };
}
