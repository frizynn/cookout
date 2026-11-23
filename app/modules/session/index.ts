/**
 * The `session` store: whether the person at the browser is logged in, and as
 * whom. An external store, read by components with `useSyncExternalStore`.
 * When its first reader subscribes it asks the server who the page's client
 * is (`whoami`, which a browser answers with the session cookie); no cookie is
 * simply logged out. `logIn` swaps a human identity's token for the session
 * cookie (`POST /v1/session`); a refused login (an agent's token, a bad token)
 * keeps the server's error code to show.
 */
import type { CookoutClient, Identity } from "../sdk/index.ts";
import { CookoutError } from "../sdk/index.ts";

const NOT_LOGGED_IN = "token_missing";

function shownRefusal(refusal: Refusal): Refusal | null {
  if (refusal.code === NOT_LOGGED_IN) {
    return null;
  }
  return refusal;
}

function refusalOf(error: unknown): Refusal {
  if (error instanceof CookoutError) {
    return { code: error.code, message: error.message };
  }
  return { code: "unreachable", message: String(error) };
}

/** Why something was refused: the server's error code, or `unreachable` when it couldn't be reached. */
export interface Refusal {
  readonly code: string;
  readonly message: string;
}

/** The login state. `refusal` is why the last attempt failed, or `null`. */
export type SessionState =
  | { readonly status: "checking" }
  | { readonly status: "logged-out"; readonly refusal: Refusal | null }
  | { readonly status: "logging-in" }
  | { readonly status: "logged-in"; readonly identity: Identity };

/** The session store. `subscribe` and `snapshot` are the two halves `useSyncExternalStore` takes. */
export interface Session {
  /** Calls `listener` after every change, until the returned function is called. */
  readonly subscribe: (listener: () => void) => () => void;
  /** The current state: a new object whenever it changes, the same one until then. */
  readonly snapshot: () => SessionState;
  /** Logs in with a human identity's token; the state moves to `logging-in`, then `logged-in` or `logged-out`. */
  readonly logIn: (token: string) => void;
}

/** What the session store needs of the SDK. */
export interface SessionClients {
  /** The page's own client, which asks who is logged in. */
  readonly client: Pick<CookoutClient, "whoami">;
  /** A client sending `token`, to log in with it. */
  readonly clientWithToken: (token: string) => Pick<CookoutClient, "login">;
}

/**
 * Makes a session store.
 * @param clients The page's client and a way to make one with a token.
 * @returns The store.
 */
export function createSession(clients: SessionClients): Session {
  const listeners = new Set<() => void>();
  let current: SessionState = { status: "checking" };
  let queue: Promise<void> | null = null;

  function publish(state: SessionState): void {
    current = state;
    for (const listener of listeners) {
      listener();
    }
  }

  async function check(): Promise<void> {
    try {
      const { identity } = await clients.client.whoami();
      publish({ identity, status: "logged-in" });
    } catch (error: unknown) {
      publish({ refusal: shownRefusal(refusalOf(error)), status: "logged-out" });
    }
  }

  async function logIn(token: string): Promise<void> {
    publish({ status: "logging-in" });
    try {
      const { identity } = await clients.clientWithToken(token).login();
      publish({ identity, status: "logged-in" });
    } catch (error: unknown) {
      publish({ refusal: refusalOf(error), status: "logged-out" });
    }
  }

  async function logInAfter(previous: Promise<void>, token: string): Promise<void> {
    await previous;
    await logIn(token);
  }

  return {
    logIn: (token) => {
      queue = logInAfter(queue ?? check(), token);
    },
    snapshot: () => current,
    subscribe: (listener) => {
      listeners.add(listener);
      queue ??= check();
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
