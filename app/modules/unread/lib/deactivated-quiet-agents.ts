import type { CookoutClient, CookoutEvent, DeactivatedQuietAgent, DeactivatedQuietAgentId } from "../../sdk/index.ts";
import type { Notifier } from "./notifier.ts";
import { createNotifier } from "./notifier.ts";

type DeactivatedQuietAgentsState =
  | { readonly status: "loading" }
  | { readonly status: "loaded"; readonly deactivatedQuietAgents: readonly DeactivatedQuietAgent[] }
  | { readonly status: "failed" };

interface DeactivatedQuietAgents {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => DeactivatedQuietAgentsState;
  readonly markRead: (id: DeactivatedQuietAgentId) => void;
}

interface LiveDeactivatedQuietAgents extends DeactivatedQuietAgents {
  readonly readUpTo: (id: DeactivatedQuietAgentId) => void;
  readonly unreadAre: (entries: readonly DeactivatedQuietAgent[]) => void;
  readonly receive: (event: CookoutEvent) => boolean;
  readonly unread: () => readonly DeactivatedQuietAgent[];
  readonly newestUnread: () => DeactivatedQuietAgentId | null;
}

interface DeactivatedQuietAgentsOptions {
  readonly client: Pick<CookoutClient, "inboxHistory" | "markDeactivatedQuietAgentRead">;
  readonly onChange: (unread: readonly DeactivatedQuietAgent[]) => void;
}

interface Known {
  readonly addAll: (entries: readonly DeactivatedQuietAgent[]) => void;
  readonly unread: () => readonly DeactivatedQuietAgent[];
  readonly historyRead: () => void;
}

const FIRST_PAGE = { limit: 1 } as const;

function newestFirst(entries: Iterable<DeactivatedQuietAgent>): readonly DeactivatedQuietAgent[] {
  return [...entries].toSorted((first, second) => second.id - first.id);
}

function newestIdOf(entries: readonly DeactivatedQuietAgent[]): DeactivatedQuietAgentId | null {
  const [newest = null] = entries;
  if (newest === null) {
    return null;
  }
  return newest.id;
}

function readOf(entry: DeactivatedQuietAgent): DeactivatedQuietAgent {
  return { ...entry, read: true };
}

function knownEntries(
  shown: Notifier<DeactivatedQuietAgentsState>,
  onChange: DeactivatedQuietAgentsOptions["onChange"],
): Known {
  const known = new Map<DeactivatedQuietAgentId, DeactivatedQuietAgent>();
  let loaded = false;
  function unread(): readonly DeactivatedQuietAgent[] {
    return newestFirst(known.values()).filter(({ read }) => !read);
  }
  return {
    addAll: (entries) => {
      for (const entry of entries) {
        known.set(entry.id, entry);
      }
      if (loaded) {
        shown.publish({ deactivatedQuietAgents: newestFirst(known.values()), status: "loaded" });
      }
      onChange(unread());
    },
    historyRead: () => {
      loaded = true;
    },
    unread,
  };
}

function reading(client: DeactivatedQuietAgentsOptions["client"], known: Known): DeactivatedQuietAgents["markRead"] {
  let queue: Promise<void> = Promise.resolve();
  async function readAfter(previous: Promise<void>, id: DeactivatedQuietAgentId): Promise<void> {
    await previous;
    try {
      const { deactivatedQuietAgent } = await client.markDeactivatedQuietAgentRead(id);
      known.addAll([deactivatedQuietAgent]);
    } catch {
      known.addAll([]);
    }
  }
  return (id) => {
    queue = readAfter(queue, id);
  };
}

function receiveIn(known: Known, event: CookoutEvent): boolean {
  if (event.type !== "deactivated-quiet-agent") {
    return false;
  }
  known.addAll([event.deactivatedQuietAgent]);
  return true;
}

function unreadOnly(known: Known, entries: readonly DeactivatedQuietAgent[]): void {
  const listed = new Set(entries.map(({ id }) => id));
  const gone = known.unread().filter(({ id }) => !listed.has(id));
  known.addAll([...gone.map((entry) => readOf(entry)), ...entries]);
}

function createDeactivatedQuietAgents({ client, onChange }: DeactivatedQuietAgentsOptions): LiveDeactivatedQuietAgents {
  const shown = createNotifier<DeactivatedQuietAgentsState>({ status: "loading" });
  const known = knownEntries(shown, onChange);
  let loading: Promise<void> | null = null;

  async function readHistory(): Promise<void> {
    try {
      const { deactivatedQuietAgents } = await client.inboxHistory(FIRST_PAGE);
      known.historyRead();
      known.addAll(deactivatedQuietAgents);
    } catch {
      shown.publish({ status: "failed" });
    }
  }

  return {
    markRead: reading(client, known),
    newestUnread: () => newestIdOf(known.unread()),
    readUpTo: (id) => {
      known.addAll(
        known
          .unread()
          .filter((entry) => entry.id <= id)
          .map((entry) => readOf(entry)),
      );
    },
    receive: (event) => receiveIn(known, event),
    snapshot: shown.current,
    subscribe: (listener) => {
      loading ??= readHistory();
      return shown.subscribe(listener);
    },
    unread: known.unread,
    unreadAre: (entries) => {
      unreadOnly(known, entries);
    },
  };
}

export {
  type DeactivatedQuietAgents,
  type DeactivatedQuietAgentsState,
  type LiveDeactivatedQuietAgents,
  createDeactivatedQuietAgents,
};
