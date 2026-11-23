/**
 * The `composer` store: what is written in each message box (a thread's
 * reply box or a channel's message box), and the identities it suggests for
 * an `@` mention. It loads every identity, human and agent, once, when the
 * first reader of any draft subscribes. `draft(key)` is one box's draft, an
 * external store read with `useSyncExternalStore`, the same store each time
 * for one key, so a draft is still there on coming back to its box. `edit` takes the box's text
 * and caret: when the caret sits just after `@` and the start of a name, as
 * `mentionPattern` reads a mention, the suggestions are the identities whose
 * names start with it. `choose` swaps that `@` and prefix for the whole
 * mention and a space (or puts it at the caret if no mention is being typed),
 * and puts the caret after it; `clear` empties the box.
 * Until the identities load, or if the server refuses them, nobody is
 * suggested.
 */
import type { CookoutClient, Identity } from "../sdk/index.ts";

const MOST_SUGGESTIONS = 8;
const NOTHING = 0;
const AT_SIGN = 1;

const typedMention = /(?<![\w.@-])@[a-z0-9-]*$/u;

function suggestionsFor(identities: readonly Identity[], text: string, caret: number): readonly Identity[] {
  const found = typedMention.exec(text.slice(NOTHING, caret));
  if (found === null) {
    return [];
  }
  const [mention] = found;
  const prefix = mention.slice(AT_SIGN);
  return identities.filter((identity) => identity.name.startsWith(prefix)).slice(NOTHING, MOST_SUGGESTIONS);
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

interface DraftSnapshot {
  readonly text: string;
  readonly caret: number;
  readonly suggestions: readonly Identity[];
}

interface Directory {
  readonly identities: () => readonly Identity[];
  readonly load: () => void;
  readonly onLoad: (refresh: () => void) => void;
}

function withMention(snapshot: DraftSnapshot, name: string): Pick<DraftSnapshot, "caret" | "text"> {
  const before = snapshot.text.slice(NOTHING, snapshot.caret).replace(typedMention, "");
  const mention = `@${name} `;
  return { caret: before.length + mention.length, text: before + mention + snapshot.text.slice(snapshot.caret) };
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
      publish(written.text, written.caret);
    },
    clear: () => {
      publish("", NOTHING);
    },
    edit: publish,
    snapshot: () => current,
    subscribe: listeners.add,
  };
}

/** One message box's draft. `subscribe` and `snapshot` are the two halves `useSyncExternalStore` takes. */
export interface Draft {
  /** Calls `listener` after every change, until the returned function is called. */
  readonly subscribe: (listener: () => void) => () => void;
  /** The current snapshot: a new object whenever it changes, the same one until then. */
  readonly snapshot: () => DraftSnapshot;
  /** Takes the box's text and caret as the person typed them. */
  readonly edit: (text: string, caret: number) => void;
  /** Puts `@name ` in place of the mention being typed. */
  readonly choose: (name: string) => void;
  /** Empties the box, as after sending its message. */
  readonly clear: () => void;
}

/** The composer store: a draft for each message box. */
export interface Composer {
  /** The draft for the box with this key (a channel's name, or `channel/id` for a thread): the same store each time for one key. */
  readonly draft: (key: string) => Draft;
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
    draft: (key) => {
      const draft = drafts.get(key) ?? createDraft(directory);
      drafts.set(key, draft);
      return draft;
    },
  };
}
