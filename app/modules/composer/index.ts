/**
 * The `composer` store: what is written in each thread's reply box, and the
 * identities it suggests for an `@` mention. It loads every identity, human
 * and agent, once, when the first reader of any draft subscribes.
 * `draft(thread)` is one reply box's draft, an external store read with
 * `useSyncExternalStore`, the same store each time for one thread, so a draft
 * is still there on coming back to its thread. `edit` takes the box's text
 * and caret: when the caret sits just after `@` and the start of a name, as
 * `mentionPattern` reads a mention, the suggestions are the identities whose
 * names start with it. `choose` swaps that `@` and prefix for the whole
 * mention and a space, and puts the caret after it; `clear` empties the box.
 * Until the identities load, or if the server refuses them, nobody is
 * suggested.
 */
import type { CookoutClient, Identity } from "../sdk/index.ts";

const MOST_SUGGESTIONS = 8;
const NOTHING = 0;
const AT_SIGN = 1;

const typedMention = /(?<![\w.@-])@[a-z0-9-]*$/u;

interface Typed {
  readonly at: number;
  readonly prefix: string;
}

function typedAt(text: string, caret: number): Typed | null {
  const found = typedMention.exec(text.slice(NOTHING, caret));
  if (found === null) {
    return null;
  }
  const [mention] = found;
  return { at: found.index, prefix: mention.slice(AT_SIGN) };
}

function suggestionsFor(identities: readonly Identity[], text: string, caret: number): readonly Identity[] {
  const typed = typedAt(text, caret);
  if (typed === null) {
    return [];
  }
  return identities.filter((identity) => identity.name.startsWith(typed.prefix)).slice(NOTHING, MOST_SUGGESTIONS);
}

interface Listeners {
  readonly add: (listener: () => void) => () => void;
  readonly notify: () => void;
}

function listenersOf(onFirst: () => void): Listeners {
  const listeners = new Set<() => void>();
  return {
    add: (listener) => {
      listeners.add(listener);
      onFirst();
      return () => {
        listeners.delete(listener);
      };
    },
    notify: () => {
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

interface Directory {
  readonly identities: () => readonly Identity[];
  readonly load: () => void;
  readonly onLoad: (refresh: () => void) => void;
}

function withMention(snapshot: DraftSnapshot, name: string): Pick<DraftSnapshot, "caret" | "text"> | null {
  const typed = typedAt(snapshot.text, snapshot.caret);
  if (typed === null) {
    return null;
  }
  const mention = `@${name} `;
  return {
    caret: typed.at + mention.length,
    text: snapshot.text.slice(NOTHING, typed.at) + mention + snapshot.text.slice(snapshot.caret),
  };
}

function createDraft(directory: Directory): Draft {
  const listeners = listenersOf(directory.load);
  let current: DraftSnapshot = { caret: NOTHING, suggestions: [], text: "" };

  function publish(text: string, caret: number): void {
    current = { caret, suggestions: suggestionsFor(directory.identities(), text, caret), text };
    listeners.notify();
  }

  directory.onLoad(() => {
    publish(current.text, current.caret);
  });
  return {
    choose: (name) => {
      const written = withMention(current, name);
      if (written !== null) {
        publish(written.text, written.caret);
      }
    },
    clear: () => {
      publish("", NOTHING);
    },
    edit: publish,
    snapshot: () => current,
    subscribe: listeners.add,
  };
}

/** What one reply box shows: its text, where the caret is, and who the mention being typed could be. */
export interface DraftSnapshot {
  readonly text: string;
  readonly caret: number;
  readonly suggestions: readonly Identity[];
}

/** One reply box's draft. `subscribe` and `snapshot` are the two halves `useSyncExternalStore` takes. */
export interface Draft {
  /** Calls `listener` after every change, until the returned function is called. */
  readonly subscribe: (listener: () => void) => () => void;
  /** The current snapshot: a new object whenever it changes, the same one until then. */
  readonly snapshot: () => DraftSnapshot;
  /** Takes the box's text and caret as the person typed them. */
  readonly edit: (text: string, caret: number) => void;
  /** Puts `@name ` in place of the mention being typed. */
  readonly choose: (name: string) => void;
  /** Empties the box, as after sending a reply. */
  readonly clear: () => void;
}

/** The composer store: a draft for each thread. */
export interface Composer {
  /** The draft for the thread with this key: the same store each time for one key. */
  readonly draft: (thread: string) => Draft;
}

/** What the composer store needs of the SDK. */
export interface ComposerOptions {
  readonly client: Pick<CookoutClient, "listIdentities">;
}

/**
 * Makes a composer store that loads identities through `options.client`.
 * @param options The client.
 * @returns The store.
 */
export function createComposer(options: ComposerOptions): Composer {
  const drafts = new Map<string, Draft>();
  const refreshes = new Set<() => void>();
  let identities: readonly Identity[] = [];
  let loading: Promise<void> | null = null;

  async function loadIdentities(): Promise<void> {
    try {
      ({ identities } = await options.client.listIdentities());
      for (const refresh of refreshes) {
        refresh();
      }
    } catch {
      identities = [];
    }
  }

  const directory: Directory = {
    identities: () => identities,
    load: () => {
      loading ??= loadIdentities();
    },
    onLoad: (refresh) => {
      refreshes.add(refresh);
    },
  };
  return {
    draft: (thread) => {
      const draft = drafts.get(thread) ?? createDraft(directory);
      drafts.set(thread, draft);
      return draft;
    },
  };
}
