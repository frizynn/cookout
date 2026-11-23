/**
 * The plain-TS reader of `COOKOUT_URL` and `COOKOUT_TOKEN`, for the SDK's
 * defaults, and the shape of a connection to a cookout server, which the SDK
 * and the CLI share. In a browser there is no environment, so it reads nothing.
 */

type Environment = Readonly<Record<string, string | undefined>>;

const NOTHING = {};

function processEnvironment(): Environment {
  if (typeof process === "undefined") {
    return NOTHING;
  }
  return process.env;
}

function urlIn(env: Environment): { readonly url?: string } {
  const url = env["COOKOUT_URL"] ?? "";
  if (url === "") {
    return NOTHING;
  }
  return { url };
}

function tokenIn(env: Environment): { readonly token?: string } {
  const token = env["COOKOUT_TOKEN"] ?? "";
  if (token === "") {
    return NOTHING;
  }
  return { token };
}

/** Where a client connects: the server's base URL, and the bearer token if there is one. */
export interface CookoutConnection {
  readonly url: string;
  readonly token?: string;
}

/**
 * `COOKOUT_URL` and `COOKOUT_TOKEN` from `env` (by default the process's), as
 * much of a connection as they give. An empty variable counts as unset.
 * @param env Where the variables are read from.
 * @returns The URL and the token, each only if set.
 */
export function readCookoutConnection(env: Environment = processEnvironment()): Partial<CookoutConnection> {
  return { ...urlIn(env), ...tokenIn(env) };
}
