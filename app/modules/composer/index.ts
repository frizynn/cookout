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
 * moves it down or up, wrapping round, and `chooseHighlighted` chooses it;
 * `dismiss` hides the suggestions until the next edit.
 * `identities` is the identity list itself, an external store too, loaded
 * when its first reader subscribes, so a view can tell a human from an agent.
 * Until the identities load, or if the server refuses them, nobody is
 * suggested. `channelDraft(channel)`, a channel's box, also suggests the
 * registered commands (from the `commands` store given) whose names start with
 * what follows `/` when that is the whole text; choosing one makes it the
 * draft's `command`, whose data the box prompts for, until `clear`. A thread's
 * reply box suggests no commands, since a call is always a top-level message.
 */
import type { Command, CookoutClient, Identity } from "../sdk/index.ts";

const MOST_SUGGESTIONS = 8;
const NOTHING = 0;
const AT_SIGN = 1;
const ONE = 1;
const STEPS = { down: ONE, up: -ONE } as const;
const NO_COMMANDS: readonly Command[] = [];

const typedMention = /(?<![\w.@-])@[a-z0-9-]*$/u;
const typedCommand = /^\/[a-z0-9-]*$/u;

function suggestionsFor(identities: readonly Identity[], text: string, caret: number): readonly Identity[] {
  const found = typedMention.exec(text.slice(NOTHING, caret));
  if (found === null) {
    return [];
  }
  const [mention] = found;
  const prefix = mention.slice(AT_SIGN);
  return identities.filter((identity) => identity.name.startsWith(prefix)).slice(NOTHING, MOST_SUGGESTIONS);
}

function commandsFor(commands: readonly Command[], text: string): readonly Command[] {
  if (!typedCommand.test(text)) {
    return [];
  }
  const prefix = text.slice(ONE);
  return commands.filter((command) => command.name.startsWith(prefix)).slice(NOTHING, MOST_SUGGESTIONS);
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
  readonly commands: readonly Command[];
  readonly command: Command | null;
  readonly highlighted: number;
}

interface Directory {
  readonly identities: () => readonly Identity[];
  readonly commands: () => readonly Command[];
  readonly load: () => void;
  readonly onLoad: (refresh: () => void) => void;
}

interface Sources {
  readonly identities: () => readonly Identity[];
  readonly commands: () => readonly Command[];
}

const EMPTY = { caret: NOTHING, command: null, commands: [], highlighted: NOTHING, suggestions: [], text: "" };

type Typed = Pick<DraftSnapshot, "caret" | "text">;

function written(sources: Sources, previous: DraftSnapshot, typed: Typed): DraftSnapshot {
  const { caret, text } = typed;
  const commands = commandsFor(sources.commands(), text);
  const suggestions = suggestionsFor(sources.identities(), text, caret);
  return { caret, command: previous.command, commands, highlighted: NOTHING, suggestions, text };
}

function mentioned(sources: Sources, snapshot: DraftSnapshot, name: string): DraftSnapshot {
  const before = snapshot.text.slice(NOTHING, snapshot.caret).replace(typedMention, "");
  const mention = `@${name} `;
  const text = before + mention + snapshot.text.slice(snapshot.caret);
  return written(sources, snapshot, { caret: before.length + mention.length, text });
}

function picked(snapshot: DraftSnapshot, commands: readonly Command[]): DraftSnapshot {
  let result = snapshot;
  for (const command of commands) {
    result = { ...EMPTY, command };
  }
  return result;
}

function chosen(sources: Sources, snapshot: DraftSnapshot): DraftSnapshot {
  const at = snapshot.highlighted;
  let result = picked(snapshot, snapshot.commands.slice(at, at + ONE));
  for (const identity of snapshot.suggestions.slice(at, at + ONE)) {
    result = mentioned(sources, snapshot, identity.name);
  }
  return result;
}

function highlightMoved(snapshot: DraftSnapshot, direction: "down" | "up"): DraftSnapshot {
  const count = Math.max(ONE, snapshot.suggestions.length + snapshot.commands.length);
  return { ...snapshot, highlighted: (snapshot.highlighted + STEPS[direction] + count) % count };
}

function dismissed(snapshot: DraftSnapshot): DraftSnapshot {
  return { ...snapshot, commands: [], highlighted: NOTHING, suggestions: [] };
}

function createDraft(directory: Directory, sources: Sources): Draft {
  const listeners = listenersOf(directory.load);
  let current: DraftSnapshot = EMPTY;

  function change(update: (snapshot: DraftSnapshot) => DraftSnapshot): void {
    current = update(current);
    listeners.notify();
  }

  directory.onLoad(() => {
    change((snapshot) => written(sources, snapshot, snapshot));
  });
  return {
    choose: (name) => {
      change((snapshot) => mentioned(sources, snapshot, name));
    },
    chooseHighlighted: () => {
      change((snapshot) => chosen(sources, snapshot));
    },
    clear: () => {
      change(() => written(sources, EMPTY, EMPTY));
    },
    dismiss: () => {
      change(dismissed);
    },
    edit: (text, caret) => {
      change((snapshot) => written(sources, snapshot, { caret, text }));
    },
    highlight: (direction) => {
      change((snapshot) => highlightMoved(snapshot, direction));
    },
    pick: (name) => {
      change((snapshot) =>
        picked(
          snapshot,
          snapshot.commands.filter((command) => command.name === name),
        ),
      );
    },
    snapshot: () => current,
    subscribe: listeners.add,
  };
}

function createDirectory(options: ComposerOptions): Directory {
  const refreshes = new Set<() => void>();
  let identities: readonly Identity[] = [];
  let loading: Promise<void> | null = null;

  function refreshAll(): void {
    for (const refresh of refreshes) {
      refresh();
    }
  }

  async function load(): Promise<void> {
    try {
      ({ identities } = await options.client.listIdentities());
    } catch {
      identities = [];
    }
    options.commands.subscribe(refreshAll);
    refreshAll();
  }

  return {
    commands: () => options.commands.snapshot().commands ?? NO_COMMANDS,
    identities: () => identities,
    load: () => {
      loading ??= load();
    },
    onLoad: (refresh) => {
      refreshes.add(refresh);
    },
  };
}

interface CommandList {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => { readonly status: string; readonly commands?: readonly Command[] };
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
  /** Chooses the highlighted suggestion, if there are any: a mention to put in, or a command to pick. */
  readonly chooseHighlighted: () => void;
  /** Picks the named command, if the box suggests it, emptying the text. */
  readonly pick: (name: string) => void;
  /** Hides the suggestions until the next edit. */
  readonly dismiss: () => void;
  /** Moves the highlight one suggestion down or up, wrapping round. */
  readonly highlight: (direction: "down" | "up") => void;
  /** Empties the box and drops the picked command, as after sending its message or call. */
  readonly clear: () => void;
}

/** The identity list. `subscribe` and `snapshot` are the two halves `useSyncExternalStore` takes. */
export interface Identities {
  /** Calls `listener` once the list loads, until the returned function is called. */
  readonly subscribe: (listener: () => void) => () => void;
  /** Every identity, sorted by name: empty until it loads, or if the server refuses it. */
  readonly snapshot: () => readonly Identity[];
}

/** The composer store: a draft for each message box. */
export interface Composer {
  /** The draft for the box with this key (`channel/id` for a thread's reply box): the same store each time for one key. It suggests no commands. */
  readonly draft: (key: string) => Draft;
  /** The draft for a channel's message box, which also suggests commands: the same store each time for one channel. */
  readonly channelDraft: (channel: string) => Draft;
  /** The identity list the suggestions come from. */
  readonly identities: Identities;
}

/** What the composer store needs: the SDK, for the identities, and the commands a channel's box suggests. */
export interface ComposerOptions {
  readonly client: Pick<CookoutClient, "listIdentities">;
  readonly commands: CommandList;
}

/**
 * Makes a composer store that loads identities through `options.client`.
 * @param options The client and the commands.
 * @returns The store.
 */
export function createComposer(options: ComposerOptions): Composer {
  const drafts = new Map<string, Draft>();
  const directory = createDirectory(options);
  const readers = listenersOf(directory.load);
  directory.onLoad(readers.notify);

  function draftFor(key: string, sources: Sources): Draft {
    const draft = drafts.get(key) ?? createDraft(directory, sources);
    drafts.set(key, draft);
    return draft;
  }

  return {
    channelDraft: (channel) => draftFor(channel, directory),
    draft: (key) => draftFor(key, { commands: () => NO_COMMANDS, identities: directory.identities }),
    identities: { snapshot: () => directory.identities(), subscribe: readers.add },
  };
}
