/**
 * The `session` store: whether the person at the browser is logged in, and as
 * whom. An external store, read by components with `useSyncExternalStore`.
 * When its first reader subscribes it asks the server who the page's client
 * is (`whoami`, which a browser answers with the session cookie); no cookie is
 * simply logged out. `logIn` swaps a human identity's token for the session
 * cookie (`POST /v1/session`); a refused login (an agent's token, a bad token)
 * keeps the server's error code to show.
 * `createLoginApprovals` makes the store the approval page reads: for a login
 * request's user code, the request (its host and when it expires) once the
 * page subscribes, or why it can't be shown, and `approve`, which approves it
 * as whoever is logged in so the terminal that started it finishes logging in.
 * `createAgentJoinApprovals` does the same for an agent join request: the agent
 * it would join or create for the person viewing it, an idle expiry they may
 * lower, and whether to replace the agent's live session.
 */
import type { CookoutClient, Identity, Refusal } from "../sdk/index.ts";
import { refusalOf } from "../sdk/index.ts";

type SessionState =
  | { readonly status: "checking" }
  | { readonly status: "logged-out"; readonly refusal: Refusal | null }
  | { readonly status: "logging-in" }
  | { readonly status: "logged-in"; readonly identity: Identity };

const NOT_LOGGED_IN = "token_missing";

function shownRefusal(refusal: Refusal): Refusal | null {
  if (refusal.code === NOT_LOGGED_IN) {
    return null;
  }
  return refusal;
}

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

export {
  type LoginApproval,
  type LoginApprovalState,
  type LoginApprovals,
  type LoginRequest,
  createLoginApprovals,
} from "./lib/login-approval.ts";

export {
  type AgentJoinApproval,
  type AgentJoinApprovalState,
  type AgentJoinApprovals,
  createAgentJoinApprovals,
} from "./lib/agent-join-approval.ts";
