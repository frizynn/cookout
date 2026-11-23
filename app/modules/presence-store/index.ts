/**
 * The `presence-store` module: every identity's presence as the web shows it, an external store read with
 * `useSyncExternalStore`. When its first reader subscribes it loads every identity's presence (`GET /v1/presence`),
 * and, with `live`, follows each `presence` event from then on, so an identity going online or offline shows at once.
 * Presence events can't be replayed, so it loads them all again each time the live link comes back after being down.
 * A change that arrives while a load is on its way is kept over the loaded one. Until it loads, or if the server
 * refuses, nobody's presence is known, and `snapshot` has nobody in it.
 */
import type { CookoutClient, CookoutEvent, IdentityName, Presence } from "../sdk/index.ts";
import type { Live } from "../live/index.ts";

const NOBODY: Presences = new Map();

function withEach(presences: Presences, changed: readonly Presence[]): Presences {
  const next = new Map(presences);
  for (const presence of changed) {
    next.set(presence.identity, presence);
  }
  return next;
}

function follow(live: Live | null, receive: (event: CookoutEvent) => void, reload: () => void): void {
  if (live !== null) {
    live.subscribe(receive);
    live.onBack(reload);
  }
}

/** The presence store: `subscribe` loads it for the first reader, and `snapshot` is every presence known, by name. */
export interface PresenceStore {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => Presences;
}

/** What the presence store reads from: the client that loads every presence, and the live stream, if any. */
export interface PresenceStoreOptions {
  readonly client: Pick<CookoutClient, "presence">;
  readonly live: Live | null;
}

/** Every identity's presence the store knows, by name, the same object until one changes. */
export type Presences = ReadonlyMap<IdentityName, Presence>;

/**
 * Makes the presence store.
 * @param options The client it loads from and the live stream it follows.
 * @returns The presence store.
 */
export function createPresenceStore(options: PresenceStoreOptions): PresenceStore {
  const listeners = new Set<() => void>();
  let presences = NOBODY;
  let changedWhileLoading = new Map<IdentityName, Presence>();
  let loading: Promise<void> | null = null;

  function publish(next: Presences): void {
    presences = next;
    for (const listener of listeners) {
      listener();
    }
  }

  async function load(): Promise<void> {
    const changed = new Map<IdentityName, Presence>();
    changedWhileLoading = changed;
    const loaded = await options.client.presence().catch(() => null);
    if (loaded !== null) {
      publish(withEach(withEach(NOBODY, loaded.presence), [...changed.values()]));
    }
  }

  function receive(event: CookoutEvent): void {
    if (event.type === "presence") {
      changedWhileLoading.set(event.presence.identity, event.presence);
      publish(withEach(presences, [event.presence]));
    }
  }

  return {
    snapshot: () => presences,
    subscribe: (listener) => {
      listeners.add(listener);
      if (loading === null) {
        follow(options.live, receive, () => {
          loading = load();
        });
        loading = load();
      }
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
