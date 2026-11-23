/**
 * The `composer` store: what is written in each message box (a thread's
 * reply box or a channel's message box) and in each display name field of
 * the Settings panel, and the identities it suggests for an `@` mention. It
 * loads every identity, human and agent, once, when the first reader of any
 * draft subscribes. `draft(key)` is one box's draft, an
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
 * when its first reader subscribes, so a view can tell a human from an agent
 * and show each display name. With `live`, an identity that changes (its
 * display name set or cleared anywhere) takes its place in the list at once.
 * `displayName(name)` is that identity's display name as it is edited: its
 * text is `null` until edited, so the field shows the saved one; `save` sends
 * the field's text trimmed (empty clears it), puts the answer in the identity list at once
 * and forgets the text, or, if the server refuses, keeps the text and the
 * refusal. Until the identities load, or if the server refuses them, nobody
 * is suggested.
 */
import type { CookoutClient, Identity, IdentityName } from "../sdk/index.ts";
import type { DisplayNameDraft } from "./lib/display-name.ts";
import type { IdentityList } from "./lib/identity-list.ts";
import type { Live } from "../live/index.ts";
import { createDisplayName } from "./lib/display-name.ts";
import { createIdentityList } from "./lib/identity-list.ts";
import { listenersOf } from "./lib/listeners.ts";

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

interface DraftSnapshot {
  readonly text: string;
  readonly caret: number;
  readonly suggestions: readonly Identity[];
  readonly highlighted: number;
}

function withMention(snapshot: DraftSnapshot, name: string): Pick<DraftSnapshot, "caret" | "text"> {
  const before = snapshot.text.slice(NOTHING, snapshot.caret).replace(typedMention, "");
  const mention = `@${name} `;
  return { caret: before.length + mention.length, text: before + mention + snapshot.text.slice(snapshot.caret) };
}

function createDraft(directory: IdentityList): Draft {
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

  directory.onChange(() => {
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

function storeIn<Store>(stores: Map<string, Store>, key: string, make: () => Store): Store {
  const store = stores.get(key) ?? make();
  stores.set(key, store);
  return store;
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
export interface Identities {
  /** Calls `listener` once the list loads and whenever an identity in it changes, until the returned function is called. */
  readonly subscribe: (listener: () => void) => () => void;
  /** Every identity, sorted by name: empty until it loads, or if the server refuses it. */
  readonly snapshot: () => readonly Identity[];
}

/** The composer store: a draft for each message box, and for each display name being edited. */
export interface Composer {
  /** The draft for the box with this key (a channel's name, or `channel/id` for a thread): the same store each time for one key. */
  readonly draft: (key: string) => Draft;
  /** The display name being edited for this identity: the same store each time for one name. */
  readonly displayName: (name: IdentityName) => DisplayNameDraft;
  /** The identity list the suggestions come from. */
  readonly identities: Identities;
}

/** What the composer store needs of the SDK, and the live stream that keeps the identity list up to date, if any. */
export interface ComposerOptions {
  readonly client: Pick<CookoutClient, "listIdentities" | "setDisplayName">;
  readonly live?: Live;
}

/**
 * Makes a composer store that loads identities through `options.client`.
 * @param options The client and the live stream.
 * @returns The store.
 */
export function createComposer(options: ComposerOptions): Composer {
  const { client } = options;
  const drafts = new Map<string, Draft>();
  const displayNames = new Map<string, DisplayNameDraft>();
  const list = createIdentityList({ client, live: options.live ?? null });
  const readers = listenersOf(list.load);
  list.onChange(readers.notify);
  return {
    displayName: (name) => storeIn(displayNames, name, () => createDisplayName({ client, list, name })),
    draft: (key) => storeIn(drafts, key, () => createDraft(list)),
    identities: { snapshot: list.identities, subscribe: readers.add },
  };
}

export type { DisplayNameDraft, DisplayNameSnapshot, SaveState } from "./lib/display-name.ts";
