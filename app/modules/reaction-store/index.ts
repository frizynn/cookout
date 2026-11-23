/**
 * The `reaction-store` module: the reactions on messages as the web shows them, an external store read with
 * `useSyncExternalStore`. A message arrives with its reactions; the store keeps only those that changed since,
 * and `reactionsOf` reads a message's reactions as they now are. `toggle` leaves the reader's reaction on a message,
 * or removes it if the reader has already left it (the API's add and remove only set the state; toggling is the
 * web's, Matt, 2026-11-23, mattpocock/cookout#199), one at a time in the order asked, keeping the server's answer, or
 * its `refusal` if it refuses, until the next toggle. With `live`, once its first reader subscribes, each `reaction`
 * event changes the message it names, so a reaction left elsewhere shows at once; reaction events can't be replayed,
 * so when the live link comes back after being down it forgets what changed, leaving the messages reloaded since.
 */
import type {
  CookoutClient,
  CookoutEvent,
  Message,
  MessageId,
  ReactionCount,
  ReactionName,
  ReactionsResponse,
  Refusal,
} from "../sdk/index.ts";
import type { Live } from "../live/index.ts";
import { refusalOf } from "../sdk/index.ts";

interface ReactionsState {
  readonly changed: ReadonlyMap<MessageId, readonly ReactionCount[]>;
  readonly refusal: Refusal | null;
}

interface Toggle {
  readonly message: Message;
  readonly reaction: ReactionName;
  readonly me: string;
}

interface ReactionStore {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => ReactionsState;
  readonly toggle: (toggle: Toggle) => void;
}

interface ReactionStoreOptions {
  readonly client: Pick<CookoutClient, "react" | "unreact">;
  readonly live: Live | null;
}

interface Shown {
  readonly state: ReactionsState;
  readonly message: Message;
}

interface Held {
  readonly current: () => ReactionsState;
  readonly publish: (next: ReactionsState) => void;
}

const NO_REACTIONS: readonly ReactionCount[] = [];

function reactionsOf(shown: Shown): readonly ReactionCount[] {
  return shown.state.changed.get(shown.message.id) ?? shown.message.reactions ?? NO_REACTIONS;
}

function reactedBy(reactions: readonly ReactionCount[], { me, reaction }: Toggle): boolean {
  return reactions.some((count) => count.reaction === reaction && count.by.some((name) => name === me));
}

async function after(previous: Promise<void> | null, step: () => Promise<void>): Promise<void> {
  await previous;
  await step();
}

function received(held: Held, response: ReactionsResponse): void {
  const state = held.current();
  held.publish({ ...state, changed: new Map(state.changed).set(response.messageId, response.reactions) });
}

async function toggled(held: Held, client: ReactionStoreOptions["client"], toggle: Toggle): Promise<void> {
  const { message, reaction } = toggle;
  try {
    if (reactedBy(reactionsOf({ message, state: held.current() }), toggle)) {
      received(held, await client.unreact(message.id, reaction));
      return;
    }
    received(held, await client.react(message.id, reaction));
  } catch (error: unknown) {
    held.publish({ ...held.current(), refusal: refusalOf(error) });
  }
}

function follow(held: Held, live: Live): void {
  live.subscribe((event: CookoutEvent) => {
    if (event.type === "reaction") {
      received(held, event);
    }
  });
  live.onBack(() => {
    held.publish({ ...held.current(), changed: new Map() });
  });
}

function createReactionStore(options: ReactionStoreOptions): ReactionStore {
  const { client, live } = options;
  const listeners = new Set<() => void>();
  let state: ReactionsState = { changed: new Map(), refusal: null };
  let queue: Promise<void> | null = null;
  let following = false;
  const held: Held = {
    current: () => state,
    publish: (next) => {
      state = next;
      for (const listener of listeners) {
        listener();
      }
    },
  };
  return {
    snapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      if (!following && live !== null) {
        following = true;
        follow(held, live);
      }
      return () => {
        listeners.delete(listener);
      };
    },
    toggle: (toggle) => {
      held.publish({ ...state, refusal: null });
      queue = after(queue, async () => {
        await toggled(held, client, toggle);
      });
    },
  };
}

export { type ReactionStore, type ReactionStoreOptions, type ReactionsState, createReactionStore, reactionsOf };
