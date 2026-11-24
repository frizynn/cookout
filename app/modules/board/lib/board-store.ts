import type { Message, ReactionCount, Refusal } from "../../sdk/index.ts";
import type { PresenceClient, Presences } from "./presence-slice.ts";
import type { Reactions, ReactionsClient } from "./reactions-slice.ts";
import type { Toggle, ToggleClient } from "./reaction-toggle.ts";
import { reactionsIn, reactionsSlice } from "./reactions-slice.ts";
import type { Live } from "../../live/index.ts";
import type { Part } from "./slice.ts";
import { createPart } from "./slice.ts";
import { createReactionToggle } from "./reaction-toggle.ts";
import { presenceSlice } from "./presence-slice.ts";

interface BoardState {
  readonly presence: Presences;
  readonly reactions: Reactions;
  readonly reactionRefusal: Refusal | null;
}

type Shown = "presence" | "reactions";

type Subscribe = (listener: () => void) => () => void;

interface BoardStore {
  readonly subscribe: Subscribe;
  readonly snapshot: () => BoardState;
  readonly subscribeShowing: (shown: Shown) => Subscribe;
  readonly toggle: (toggle: Toggle) => void;
}

type BoardStoreClient = PresenceClient & ReactionsClient & ToggleClient;

interface BoardStoreOptions {
  readonly client: BoardStoreClient;
  readonly live: Live | null;
}

interface Listeners {
  readonly subscribe: Subscribe;
  readonly notify: () => void;
}

interface Showing {
  readonly part: Part<unknown>;
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

function follower(live: Live | null, parts: readonly Part<unknown>[]): () => void {
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

function createBoardStore(options: BoardStoreOptions): BoardStore {
  const { notify, subscribe } = createListeners();
  let snapshot: BoardState | null = null;
  function changed(): void {
    snapshot = null;
    notify();
  }
  const { client } = options;
  const presence = createPart({ changed, client, slice: presenceSlice });
  const reactions = createPart({ changed, client, slice: reactionsSlice });
  const reactionToggle = createReactionToggle({
    apply: reactions.apply,
    changed,
    client,
    reactionsOf: (message) => reactionsIn({ held: reactions.state(), message }),
  });
  const follow = follower(options.live, [presence, reactions]);
  const subscribers = {
    presence: showing({ follow, part: presence, subscribe }),
    reactions: showing({ follow, part: reactions, subscribe }),
  };
  return {
    snapshot: () => {
      snapshot ??= {
        presence: presence.state(),
        reactionRefusal: reactionToggle.refusal(),
        reactions: reactions.state(),
      };
      return snapshot;
    },
    subscribe,
    subscribeShowing: (shown) => subscribers[shown],
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
  return reactionsIn({ held: state.reactions, message });
}

function reactionRefusal(state: BoardState): Refusal | null {
  return state.reactionRefusal;
}

export { type BoardStore, type BoardStoreClient, createBoardStore, presences, reactionRefusal, reactionsOf };
export type { Presences } from "./presence-slice.ts";
export type { Toggle } from "./reaction-toggle.ts";
