/**
 * The `composer` store: what is written in each message box (a thread's
 * reply box or a channel's message box) and in each display name field of
 * the settings page, and the identities it suggests for an `@` mention. It
 * loads every identity, human and agent, once, when the first reader of any
 * draft subscribes. `draft(key)` is one box's draft, an
 * external store read with `useSyncExternalStore`, the same store each time
 * for one key, so a draft is still there on coming back to its box. `edit` takes the box's text
 * and caret: when the caret sits just after `@` and the start of a name, as
 * `mentionPattern` reads a mention, the suggestions are the identities whose
 * names start with it, a thread's members first (those `draft` is given,
 * most recent poster first), then the rest by name. `choose` swaps that `@` and prefix for the whole
 * mention and a space (or puts it at the caret if no mention is being typed),
 * and puts the caret after it; `clear` empties the box. While there are
 * suggestions, one is `highlighted` (the first, after each edit): `highlight`
 * moves it down or up, wrapping round, and `chooseHighlighted` chooses it.
 * `replyTo(name)` puts `@name ` at the start of the box (Reply on a thread's
 * message), unless the text already mentions them or they are deactivated,
 * and asks the box to take focus with the caret at the end.
 * `identities` is the identity list itself, an external store too, loaded
 * when its first reader subscribes, so a view can tell a human from an agent
 * and show each display name. With `live`, an identity that changes (its
 * display name set or cleared anywhere) takes its place in the list at once,
 * and the whole list loads again when the stream's link comes back after being
 * down, since identity events can't be replayed. An identity deleted elsewhere
 * leaves the list, and a profile open on it closes, with `identities.deletion`
 * naming it for a notice until dismissed.
 * Until the identities load, or if the server refuses them, nobody is
 * suggested. `setAdmin` makes an identity an admin or removes admin from it,
 * putting the identity the server answers in the list, and `adminChange` is
 * that change's state: being sent, or why the server refused it.
 * `displayName(name)` is that identity's display name as it is edited: its
 * text is `null` until edited, so the field shows the saved one; `save` sends
 * the field's text trimmed (empty clears it), puts the answer in the identity
 * list at once and forgets the text, or, if the server refuses, keeps the
 * text and the refusal. `description(name)` is an agent's description as it
 * is edited, and saves the same way.
 * `identities.actions(name)` is what an agent's owner or an admin does to
 * that identity: rotate its token, list and revoke its agent session (listed again, with `live`, whenever it joins, leaves, is revoked or deactivated elsewhere, and once it expires),
 * deactivate it (after `askToDeactivate`), reactivate it and transfer it;
 * each answer goes in the identity list at once, a fresh token is in its
 * snapshot until `forgetToken` (`copyToken` puts it on the clipboard), and a
 * refusal is kept as `action`.
 * `identities.creation` creates an agent the caller owns, whose token then
 * shows in that agent's `actions`.
 * `channelDraft(channel)`, a channel's box, also suggests the registered
 * commands (from the `commands` store given, read once the identities load)
 * whose names start with what follows `/` when that is the whole text;
 * choosing one makes it the draft's `command`, whose data the box prompts
 * for, until `clear`, or `unpick`, which brings back the text as it was; `dismiss` hides any suggestions until the next edit. A
 * thread's reply box suggests no commands, since a call is a top-level message.
 */
import type { ActionsClient, IdentityActions } from "./lib/identity-actions.ts";
import type { AdminChanges, AdminClient } from "./lib/admin-change.ts";
import type { Command, CookoutClient, Identity, IdentityName, Token } from "../sdk/index.ts";
import type { DraftSnapshot, Sources } from "./lib/snapshot.ts";
import { EMPTY, changesFor } from "./lib/snapshot.ts";
import type { AgentCreation } from "./lib/agent-creation.ts";
import type { DisplayNameDraft } from "./lib/display-name.ts";
import type { IdentityDeletion } from "./lib/identity-deletion.ts";
import type { IdentityList } from "./lib/identity-list.ts";
import type { Live } from "../live/index.ts";
import { createAdminChanges } from "./lib/admin-change.ts";
import { createAgentCreation } from "./lib/agent-creation.ts";
import { createDisplayName } from "./lib/display-name.ts";
import { createIdentityActions } from "./lib/identity-actions.ts";
import { createIdentityDeletion } from "./lib/identity-deletion.ts";
import { createIdentityList } from "./lib/identity-list.ts";
import { listenersOf } from "./lib/listeners.ts";

const NO_COMMANDS: readonly Command[] = [];
const NO_MEMBERS: readonly IdentityName[] = [];

function noMembers(): readonly IdentityName[] {
  return NO_MEMBERS;
}

function createDraft(list: IdentityList, sources: Sources, load: () => void): Draft {
  const listeners = listenersOf(load);
  const changes = changesFor(sources);
  let current: DraftSnapshot = EMPTY;

  function change(update: (snapshot: DraftSnapshot) => DraftSnapshot): void {
    current = update(current);
    listeners.notify();
  }

  list.onChange(() => {
    change((snapshot) => changes.written(snapshot, snapshot));
  });
  return {
    choose: (name) => {
      change((snapshot) => changes.mentioned(snapshot, name));
    },
    chooseHighlighted: () => {
      change((snapshot) => changes.chosen(snapshot));
    },
    clear: () => {
      change(() => changes.written(EMPTY, EMPTY));
    },
    dismiss: () => {
      change(changes.dismissed);
    },
    edit: (text, caret) => {
      change((snapshot) => changes.written(snapshot, { caret, text }));
    },
    highlight: (direction) => {
      change((snapshot) => changes.highlightMoved(snapshot, direction));
    },
    pick: (name) => {
      change((snapshot) =>
        changes.picked(
          snapshot,
          snapshot.commands.filter((command) => command.name === name),
        ),
      );
    },
    replyTo: (name) => {
      change((snapshot) => changes.repliedTo(snapshot, name));
    },
    snapshot: () => current,
    subscribe: listeners.add,
    unpick: () => {
      change(changes.unpicked);
    },
  };
}

function storeIn<Store>(stores: Map<string, Store>, key: string, make: () => Store): Store {
  const store = stores.get(key) ?? make();
  stores.set(key, store);
  return store;
}

function loaderOf(list: IdentityList, commands: CommandList): () => void {
  let watching = false;
  return () => {
    list.load();
    if (!watching) {
      watching = true;
      commands.subscribe(() => {
        list.publish(list.identities());
      });
    }
  };
}

interface CommandList {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => { readonly status: string; readonly commands?: readonly Command[] };
}

function ownerPowersOf(
  { client, live }: ComposerOptions,
  list: IdentityList,
): Pick<Identities, "actions" | "creation"> {
  const stores = new Map<string, IdentityActions>();
  function actions(name: IdentityName): IdentityActions {
    return storeIn(stores, name, () => createIdentityActions({ client, list, live: live ?? null, name }));
  }
  function created(name: IdentityName, token: Token): void {
    actions(name).showToken(token);
  }
  return { actions, creation: createAgentCreation({ client, created, list }) };
}

function identityListOf(options: ComposerOptions): {
  readonly deletion: IdentityDeletion;
  readonly list: IdentityList;
} {
  const deletion = createIdentityDeletion();
  const list = createIdentityList({
    client: options.client,
    deleted: deletion.closeIfOpen,
    live: options.live ?? null,
  });
  return { deletion, list };
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
  /** Puts `@name ` at the start of the box, unless the text already mentions them or they are deactivated, and has the box take focus with the caret at the end; with `null` (replying to yourself) it only takes focus. */
  readonly replyTo: (name: string | null) => void;
  /** Picks the named command, if the box suggests it, keeping the text for `unpick`. */
  readonly pick: (name: string) => void;
  /** Drops the picked command and keeps the text, so the box comes back as it was, its suggestions hidden and `returned` true until the next edit. */
  readonly unpick: () => void;
  /** Hides the suggestions until the next edit. */
  readonly dismiss: () => void;
  /** Moves the highlight one suggestion down or up, wrapping round. */
  readonly highlight: (direction: "down" | "up") => void;
  /** Empties the box and drops the picked command, as after sending its message or call. */
  readonly clear: () => void;
}

/** The identity list. `subscribe` and `snapshot` are the two halves `useSyncExternalStore` takes. */
export interface Identities extends AdminChanges {
  /** Calls `listener` once the list loads and whenever an identity in it changes, until the returned function is called. */
  readonly subscribe: (listener: () => void) => () => void;
  /** Every identity, sorted by name: empty until it loads, or if the server refuses it. */
  readonly snapshot: () => readonly Identity[];
  /** What its owner or an admin does to this identity: the same store each time for one name. */
  readonly actions: (name: IdentityName) => IdentityActions;
  /** Creating an agent the caller owns. */
  readonly creation: AgentCreation;
  /**
   * The identity just deleted elsewhere whose open profile closed, for a notice, until `dismiss`: `null` if none.
   * With `live`, an identity deleted elsewhere leaves the list at once, and a profile open on it closes.
   */
  readonly deletion: Pick<IdentityDeletion, "dismiss" | "snapshot" | "subscribe">;
}

/** The composer store: a draft for each message box, and for each display name being edited. */
export interface Composer {
  /**
   * The draft for the box with this key (`channel/id` for a thread's reply box): the same store each time for one key. It suggests no commands.
   * `members`, read at each edit, names the identities to suggest ahead of the other matches, in its order (a thread's members, most recent poster first); the first call for a key sets it.
   */
  readonly draft: (key: string, members?: () => readonly IdentityName[]) => Draft;
  /** The draft for a channel's message box, which also suggests commands: the same store each time for one channel. */
  readonly channelDraft: (channel: string) => Draft;
  /** The display name being edited for this identity: the same store each time for one name. */
  readonly displayName: (name: IdentityName) => DisplayNameDraft;
  /** The description being edited for this agent: the same store each time for one name. */
  readonly description: (name: IdentityName) => DisplayNameDraft;
  /** The identity list the suggestions come from. */
  readonly identities: Identities;
}

/** What the composer store needs: the SDK, the commands a channel's box suggests, and the live stream that keeps the identity list up to date, if any. */
export interface ComposerOptions {
  readonly client: ActionsClient &
    AdminClient &
    Pick<CookoutClient, "createIdentity" | "listIdentities" | "setDescription" | "setDisplayName">;
  readonly commands: CommandList;
  readonly live?: Live;
}

/**
 * Makes a composer store that loads identities through `options.client`.
 * @param options The client, the commands and the live stream.
 * @returns The store.
 */
export function createComposer(options: ComposerOptions): Composer {
  const { client } = options;
  const drafts = new Map<string, Draft>();
  const displayNames = new Map<string, DisplayNameDraft>();
  const descriptions = new Map<string, DisplayNameDraft>();
  const { deletion, list } = identityListOf(options);
  const load = loaderOf(list, options.commands);
  const readers = listenersOf(load);
  function registered(): readonly Command[] {
    return options.commands.snapshot().commands ?? NO_COMMANDS;
  }
  list.onChange(readers.notify);
  return {
    channelDraft: (channel) =>
      storeIn(drafts, channel, () =>
        createDraft(list, { commands: registered, identities: list.identities, members: noMembers }, load),
      ),
    description: (name) =>
      storeIn(descriptions, name, () => createDisplayName({ list, name, set: client.setDescription })),
    displayName: (name) =>
      storeIn(displayNames, name, () => createDisplayName({ list, name, set: client.setDisplayName })),
    draft: (key, members = noMembers) =>
      storeIn(drafts, key, () =>
        createDraft(list, { commands: () => NO_COMMANDS, identities: list.identities, members }, load),
      ),
    identities: {
      ...createAdminChanges({ client, identities: list.identities, publish: list.publish }),
      ...ownerPowersOf(options, list),
      deletion,
      snapshot: list.identities,
      subscribe: readers.add,
    },
  };
}

export type { DisplayNameDraft } from "./lib/display-name.ts";
export type { AgentCreation } from "./lib/agent-creation.ts";
export type { IdentityActions } from "./lib/identity-actions.ts";
