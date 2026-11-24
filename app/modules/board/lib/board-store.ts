import type { AgentSessions, Sessions, SessionsClient, SessionsPart } from "./agent-sessions-part.ts";
import type { Identities, IdentitiesClient, IdentityChange } from "./identities-slice.ts";
import type { IdentityCalls, IdentityCallsClient } from "./identity-calls.ts";
import type { IdentityName, Message, ReactionCount, Refusal } from "../../sdk/index.ts";
import type { OwnClient, OwnShowing, OwnState } from "./own-showing.ts";
import type { PresenceClient, Presences } from "./presence-slice.ts";
import type { Reactions, ReactionsClient } from "./reactions-slice.ts";
import type { Toggle, ToggleClient } from "./reaction-toggle.ts";
import { reactionsIn, reactionsSlice } from "./reactions-slice.ts";
import type { Live } from "../../live/index.ts";
import type { Part } from "./slice.ts";
import { createIdentityCalls } from "./identity-calls.ts";
import { createOwn } from "./own-showing.ts";
import { createPart } from "./slice.ts";
import { createReactionToggle } from "./reaction-toggle.ts";
import { createSessionsPart } from "./agent-sessions-part.ts";
import { identitiesSlice } from "./identities-slice.ts";
import { presenceSlice } from "./presence-slice.ts";

interface BoardState extends OwnState {
  readonly presence: Presences;
  readonly reactions: Reactions;
  readonly reactionRefusal: Refusal | null;
  readonly identities: Identities;
  readonly agentSessions: AgentSessions;
}

type Shown = "channels" | "commands" | "identities" | "presence" | "reactions" | "subscriptions";

type Subscribe = (listener: () => void) => () => void;

interface BoardStore extends OwnShowing {
  readonly subscribe: Subscribe;
  readonly snapshot: () => BoardState;
  readonly subscribeShowing: (shown: Shown) => Subscribe;
  readonly toggle: (toggle: Toggle) => void;
  readonly subscribeShowingSessions: (agent: IdentityName) => Subscribe;
  readonly identityCalls: IdentityCalls;
}

type BoardStoreClient = OwnClient &
  IdentitiesClient &
  IdentityCallsClient &
  PresenceClient &
  ReactionsClient &
  SessionsClient &
  ToggleClient;

interface BoardStoreOptions {
  readonly client: BoardStoreClient;
  readonly live: Live | null;
  readonly pageSize?: number;
}

const PAGE_SIZE = 50;

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

interface ReactionParts {
  readonly reactions: Part<Reactions>;
  readonly reactionToggle: ReturnType<typeof createReactionToggle>;
}

function reactionPartsOf(changed: () => void, client: BoardStoreClient): ReactionParts {
  const reactions = createPart({ changed, client, slice: reactionsSlice });
  const reactionToggle = createReactionToggle({
    apply: reactions.apply,
    changed,
    client,
    reactionsOf: (message) => reactionsIn({ held: reactions.state(), message }),
  });
  return { reactionToggle, reactions };
}

interface IdentityParts {
  readonly identities: Part<Identities, IdentityChange>;
  readonly sessions: SessionsPart;
}

function identityPartsOf(changed: () => void, client: BoardStoreClient): IdentityParts {
  return {
    identities: createPart({ changed, client, slice: identitiesSlice }),
    sessions: createSessionsPart({ changed, client }),
  };
}

function createBoardStore({ client, live, pageSize = PAGE_SIZE }: BoardStoreOptions): BoardStore {
  const { notify, subscribe } = createListeners();
  let snapshot: BoardState | null = null;
  function changed(): void {
    snapshot = null;
    notify();
  }
  const presence = createPart({ changed, client, slice: presenceSlice });
  const { reactionToggle, reactions } = reactionPartsOf(changed, client);
  const { identities, sessions } = identityPartsOf(changed, client);
  const own = createOwn({ changed, client, pageSize });
  const follow = follower(live, [own.parts, presence, reactions, identities, sessions]);
  const subscribers = {
    ...own.subscribers({ follow, subscribe }),
    identities: showing({ follow, part: identities, subscribe }),
    presence: showing({ follow, part: presence, subscribe }),
    reactions: showing({ follow, part: reactions, subscribe }),
  };
  return {
    ...own.showing({ follow, subscribe }),
    identityCalls: createIdentityCalls({ client, identities, sessions }),
    snapshot: () => {
      snapshot ??= {
        ...own.state(),
        agentSessions: sessions.state(),
        identities: identities.state(),
        presence: presence.state(),
        reactionRefusal: reactionToggle.refusal(),
        reactions: reactions.state(),
      };
      return snapshot;
    },
    subscribe,
    subscribeShowing: (shown) => subscribers[shown],
    subscribeShowingSessions: sessionsShowing(follow, sessions, subscribe),
    toggle: reactionToggle.toggle,
  };
}

function presences(state: BoardState): Presences {
  return state.presence;
}

interface MessageShown {
  readonly state: BoardState;
  readonly message: Message;
}

function reactionsOf({ message, state }: MessageShown): readonly ReactionCount[] {
  return reactionsIn({ held: state.reactions, message: state.messages.table.get(message.id) ?? message });
}

function reactionRefusal(state: BoardState): Refusal | null {
  return state.reactionRefusal;
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

export type { IdentityCalls } from "./identity-calls.ts";
export {
  type BoardState,
  type BoardStore,
  agentSessions,
  createBoardStore,
  deletedIdentities,
  identityList,
  presences,
  reactionRefusal,
  reactionsOf,
};
export type { Presences } from "./presence-slice.ts";
export type { BoardStoreClient };
