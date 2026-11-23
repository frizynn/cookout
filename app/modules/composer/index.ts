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
 * and puts the caret after it; `clear` empties the box. While there are
 * suggestions, one is `highlighted` (the first, after each edit): `highlight`
 * moves it down or up, wrapping round, and `chooseHighlighted` chooses it.
 * `identities` is the identity list itself, an external store too, loaded
 * when its first reader subscribes, so a view can tell a human from an agent.
 * Until the identities load, or if the server refuses them, nobody is
 * suggested. `setAdmin` makes an identity an admin or removes admin from it,
 * putting the identity the server answers in the list, and `adminChange` is
 * that change's state: being sent, or why the server refused it.
 */
import type { AdminChanges, AdminClient } from "./lib/admin-change.ts";
import type { CookoutClient, Identity } from "../sdk/index.ts";
import { createAdminChanges } from "./lib/admin-change.ts";

const MOST_SUGGESTIONS = 8;
const NOTHING = 0;
const AT_SIGN = 1;
const ONE = 1;
const STEPS = { down: ONE, up: -ONE } as const;

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
  readonly highlighted: number;
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
  let current: DraftSnapshot = { caret: NOTHING, highlighted: NOTHING, suggestions: [], text: "" };

  function publish(text: string, caret: number): void {
    const suggestions = suggestionsFor(directory.identities(), text, caret);
    current = { caret, highlighted: NOTHING, suggestions, text };
    listeners.notify();
  }

  function choose(name: string): void {
    const written = withMention(current, name);
    publish(written.text, written.caret);
  }

  directory.onLoad(() => {
    publish(current.text, current.caret);
  });
  return {
    choose,
    chooseHighlighted: () => {
      for (const identity of current.suggestions.slice(current.highlighted, current.highlighted + ONE)) {
        choose(identity.name);
      }
    },
    clear: () => {
      publish("", NOTHING);
    },
    edit: publish,
    highlight: (direction) => {
      const step = STEPS[direction];
      const count = current.suggestions.length;
      if (count > NOTHING) {
        current = { ...current, highlighted: (current.highlighted + step + count) % count };
        listeners.notify();
      }
    },
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
  /** Chooses the highlighted suggestion, if there are any. */
  readonly chooseHighlighted: () => void;
  /** Moves the highlight one suggestion down or up, wrapping round. */
  readonly highlight: (direction: "down" | "up") => void;
  /** Empties the box, as after sending its message. */
  readonly clear: () => void;
}

/** The identity list. `subscribe` and `snapshot` are the two halves `useSyncExternalStore` takes. */
export interface Identities extends AdminChanges {
  /** Calls `listener` once the list loads, until the returned function is called. */
  readonly subscribe: (listener: () => void) => () => void;
  /** Every identity, sorted by name: empty until it loads, or if the server refuses it. */
  readonly snapshot: () => readonly Identity[];
}

/** The composer store: a draft for each message box. */
export interface Composer {
  /** The draft for the box with this key (a channel's name, or `channel/id` for a thread): the same store each time for one key. */
  readonly draft: (key: string) => Draft;
  /** The identity list the suggestions come from. */
  readonly identities: Identities;
}

/** What the composer store needs of the SDK. */
export interface ComposerOptions {
  readonly client: AdminClient & Pick<CookoutClient, "listIdentities">;
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

  function publish(next: readonly Identity[]): void {
    identities = next;
    for (const refresh of refreshes) {
      refresh();
    }
  }

  async function loadIdentities(): Promise<void> {
    try {
      const listed = await options.client.listIdentities();
      publish(listed.identities);
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
  const readers = listenersOf(directory.load);
  refreshes.add(readers.notify);
  return {
    draft: (key) => {
      const draft = drafts.get(key) ?? createDraft(directory);
      drafts.set(key, draft);
      return draft;
    },
    identities: {
      ...createAdminChanges({ client: options.client, identities: () => identities, publish }),
      snapshot: () => identities,
      subscribe: readers.add,
    },
  };
}
