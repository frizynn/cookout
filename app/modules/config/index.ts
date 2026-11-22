/**
 * The plain-TS reader of `COOKOUT_URL` and `COOKOUT_TOKEN`, for the SDK's
 * defaults. In a browser there is no environment, so it reads nothing.
 */

/** Where a client connects: the server's base URL and the bearer token, if set. */
export type CookoutConnection = {
  readonly url?: string;
  readonly token?: string;
};

type Environment = Readonly<Record<string, string | undefined>>;

const processEnvironment = (): Environment => (typeof process === "undefined" ? {} : process.env);

const setOrUndefined = (value: string | undefined) => (value === "" ? undefined : value);

/** `COOKOUT_URL` and `COOKOUT_TOKEN` from `env` (by default the process's). An empty variable counts as unset. */
export function readCookoutConnection(env: Environment = processEnvironment()): CookoutConnection {
  const url = setOrUndefined(env["COOKOUT_URL"]);
  const token = setOrUndefined(env["COOKOUT_TOKEN"]);
  return { ...(url === undefined ? {} : { url }), ...(token === undefined ? {} : { token }) };
}
