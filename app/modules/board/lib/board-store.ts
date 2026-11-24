import type { AgentSessions, Sessions, SessionsClient, SessionsPart } from "./agent-sessions-part.ts";
import type { Identities, IdentitiesClient } from "./identities-slice.ts";
import type { IdentityCalls, IdentityCallsClient } from "./identity-calls.ts";
import type { PresenceClient, Presences } from "./presence-slice.ts";
import type { IdentityName } from "../../sdk/index.ts";
import type { Live } from "../../live/index.ts";
import type { Part } from "./slice.ts";
import { createIdentityCalls } from "./identity-calls.ts";
import { createPart } from "./slice.ts";
import { createSessionsPart } from "./agent-sessions-part.ts";
import { identitiesSlice } from "./identities-slice.ts";
import { presenceSlice } from "./presence-slice.ts";

interface BoardState {
  readonly presence: Presences;
  readonly identities: Identities;
  readonly agentSessions: AgentSessions;
}

type Shown = Exclude<keyof BoardState, "agentSessions">;

type Subscribe = (listener: () => void) => () => void;

interface BoardStore {
  readonly subscribe: Subscribe;
  readonly snapshot: () => BoardState;
  readonly subscribeShowing: (shown: Shown) => Subscribe;
  readonly subscribeShowingSessions: (agent: IdentityName) => Subscribe;
  readonly identityCalls: IdentityCalls;
}

type BoardStoreClient = IdentitiesClient & IdentityCallsClient & PresenceClient & SessionsClient;

interface BoardStoreOptions {
  readonly client: BoardStoreClient;
  readonly live: Live | null;
}

interface Listeners {
  readonly subscribe: Subscribe;
  readonly notify: () => void;
}

interface Showing {
  readonly part: Pick<Part<unknown>, "hide" | "show">;
  readonly follow: () => void;
  readonly subscribe: Subscribe;
}

function createListeners(): Listeners {
  const listeners = new Set<() => void>();
  return {
    notify: () => {
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

type Followed = Pick<Part<unknown>, "apply" | "back">;

function follower(live: Live | null, parts: readonly Followed[]): () => void {
  let following = false;
  return () => {
    if (following || live === null) {
      return;
    }
    following = true;
    live.subscribe((event) => {
      for (const part of parts) {
        part.apply(event);
      }
    });
    live.onBack(() => {
      for (const part of parts) {
        part.back();
      }
    });
  };
}

function showing({ follow, part, subscribe }: Showing): Subscribe {
  return (listener) => {
    follow();
    const unsubscribe = subscribe(listener);
    part.show();
    return () => {
      unsubscribe();
      part.hide();
    };
  };
}

function sessionsShowing(
  follow: () => void,
  part: SessionsPart,
  subscribe: Subscribe,
): (agent: IdentityName) => Subscribe {
  const subscribers = new Map<IdentityName, Subscribe>();
  return (agent) => {
    const found =
      subscribers.get(agent) ??
      showing({
        follow,
        part: {
          hide: () => {
            part.hide(agent);
          },
          show: () => {
            part.show(agent);
          },
        },
        subscribe,
      });
    subscribers.set(agent, found);
    return found;
  };
}

function createBoardStore(options: BoardStoreOptions): BoardStore {
  const { notify, subscribe } = createListeners();
  let snapshot: BoardState | null = null;
  function changed(): void {
    snapshot = null;
    notify();
  }
  const { client } = options;
  const presence = createPart({ changed, client, slice: presenceSlice });
  const identities = createPart({ changed, client, slice: identitiesSlice });
  const sessions = createSessionsPart({ changed, client });
  const follow = follower(options.live, [presence, identities, sessions]);
  const subscribers = {
    identities: showing({ follow, part: identities, subscribe }),
    presence: showing({ follow, part: presence, subscribe }),
  };
  return {
    identityCalls: createIdentityCalls({ client, identities, sessions }),
    snapshot: () => {
      snapshot ??= { agentSessions: sessions.state(), identities: identities.state(), presence: presence.state() };
      return snapshot;
    },
    subscribe,
    subscribeShowing: (shown) => subscribers[shown],
    subscribeShowingSessions: sessionsShowing(follow, sessions, subscribe),
  };
}

function presences(state: BoardState): Presences {
  return state.presence;
}

const NO_SESSIONS = null;

function identityList(state: BoardState): Identities["listed"] {
  return state.identities.listed;
}

function deletedIdentities(state: BoardState): Identities["deleted"] {
  return state.identities.deleted;
}

function agentSessions(agent: IdentityName): (state: BoardState) => Sessions {
  function sessionsIn(state: BoardState): Sessions {
    return state.agentSessions.get(agent) ?? NO_SESSIONS;
  }
  return sessionsIn;
}

export { type BoardStore, agentSessions, createBoardStore, deletedIdentities, identityList, presences };
export type { IdentityCalls } from "./identity-calls.ts";
export type { Presences } from "./presence-slice.ts";
