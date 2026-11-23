/**
 * The `board` store: what the web knows of the board, loaded through the SDK.
 * An external store, read by components with `useSyncExternalStore`; it loads
 * the channels once, when its first reader subscribes. A refusal keeps the
 * server's error code; a server that can't be reached is `unreachable`.
 */
import type { Channel, CookoutClient } from "../sdk/index.ts";
import { CookoutError } from "../sdk/index.ts";

interface Snapshot {
  readonly channels: ChannelsState;
}

function failure(error: unknown): ChannelsState {
  if (error instanceof CookoutError) {
    return { code: error.code, message: error.message, status: "failed" };
  }
  return { code: "unreachable", message: String(error), status: "failed" };
}

/** The channel list, as far as it has loaded. */
export type ChannelsState =
  | { readonly status: "loading" }
  | { readonly status: "loaded"; readonly channels: readonly Channel[] }
  | { readonly status: "failed"; readonly code: string; readonly message: string };

/** The board store. `subscribe` and `snapshot` are the two halves `useSyncExternalStore` takes. */
export interface Board {
  /** Calls `listener` after every change, until the returned function is called. */
  readonly subscribe: (listener: () => void) => () => void;
  /** The current snapshot: a new object whenever anything in it changes, the same one until then. */
  readonly snapshot: () => Snapshot;
}

/** What the board store needs of the SDK. */
export type BoardClient = Pick<CookoutClient, "listChannels">;

/**
 * Makes a board store that talks to the server through `client`.
 * @param client An SDK client, with the token of whoever is looking.
 * @returns The store.
 */
export function createBoard(client: BoardClient): Board {
  const listeners = new Set<() => void>();
  let current: Snapshot = { channels: { status: "loading" } };
  let loading: Promise<void> | null = null;

  function publish(channels: ChannelsState): void {
    current = { ...current, channels };
    for (const listener of listeners) {
      listener();
    }
  }

  async function loadChannels(): Promise<void> {
    try {
      const { channels } = await client.listChannels();
      publish({ channels, status: "loaded" });
    } catch (error: unknown) {
      publish(failure(error));
    }
  }

  return {
    snapshot: () => current,
    subscribe: (listener) => {
      listeners.add(listener);
      loading ??= loadChannels();
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
