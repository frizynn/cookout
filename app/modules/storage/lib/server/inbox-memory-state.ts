import { Array as Arr, Effect, Option, String as Str } from "effect";
import type { Message, MessageId, Reaction, ReadReceipt } from "../../../messages/index.ts";
import type { NewReaction, ReactionKey, ReactionsSection } from "./reactions.ts";
import type { ChannelName } from "../../../channels/index.ts";
import type { IdentityName } from "../../../identities/index.ts";
import type { StorageUnavailable } from "./errors.ts";
import { sortedReactions } from "./reactions.ts";

interface MemoryInbox {
  readonly mentions: ReadonlySet<string>;
  readonly follows: ReadonlySet<string>;
  readonly subscriptions: ReadonlySet<string>;
  readonly positions: ReadonlyMap<string, MessageId>;
  readonly receipts: readonly ReadReceipt[];
  readonly reactions: readonly StoredReaction[];
}

interface StoredReaction extends Reaction {
  readonly seen: boolean;
}

const EMPTY_INBOX: MemoryInbox = {
  follows: new Set(),
  mentions: new Set(),
  positions: new Map(),
  reactions: [],
  receipts: [],
  subscriptions: new Set(),
};

interface ForgettingChannel {
  readonly inbox: MemoryInbox;
  readonly channel: ChannelName;
  readonly ids: ReadonlySet<MessageId>;
}

function withoutChannel({ channel, ids, inbox }: ForgettingChannel): MemoryInbox {
  const gone = [` channel ${channel}`, ...Arr.flatMap([...ids], (id) => [` thread ${id}`, ` message ${id}`])];
  function kept(key: string): boolean {
    return !Arr.some(gone, (scope) => Str.endsWith(scope)(key));
  }
  return {
    follows: new Set(Arr.filter([...inbox.follows], kept)),
    mentions: new Set(Arr.filter([...inbox.mentions], kept)),
    positions: new Map(Arr.filter([...inbox.positions], ([key]: readonly [string, MessageId]) => kept(key))),
    reactions: Arr.filter(inbox.reactions, (reaction) => !ids.has(reaction.messageId)),
    receipts: Arr.filter(inbox.receipts, (receipt) => !ids.has(receipt.messageId)),
    subscriptions: new Set(Arr.filter([...inbox.subscriptions], kept)),
  };
}

interface ForgettingIdentity {
  readonly inbox: MemoryInbox;
  readonly identity: string;
}

function withoutIdentity({ identity, inbox }: ForgettingIdentity): MemoryInbox {
  function kept(key: string): boolean {
    return !Str.startsWith(`${identity} `)(key);
  }
  return {
    follows: new Set(Arr.filter([...inbox.follows], kept)),
    mentions: new Set(Arr.filter([...inbox.mentions], kept)),
    positions: new Map(Arr.filter([...inbox.positions], ([key]: readonly [string, MessageId]) => kept(key))),
    reactions: Arr.filter(inbox.reactions, (reaction) => reaction.identity !== identity),
    receipts: Arr.filter(inbox.receipts, (receipt) => receipt.identity !== identity),
    subscriptions: new Set(Arr.filter([...inbox.subscriptions], kept)),
  };
}

type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

interface MemoryBoard {
  readonly messages: readonly Message[];
  readonly inbox: MemoryInbox;
}

interface MemoryReactionsAccess {
  readonly read: <Value>(work: (board: MemoryBoard) => Value) => Fails<Value>;
  readonly changeInbox: <Value>(work: (board: MemoryBoard) => readonly [Value, MemoryInbox]) => Fails<Value>;
}

type Changed = readonly [Option.Option<boolean>, MemoryInbox];

function sameKey(key: ReactionKey): (stored: StoredReaction) => boolean {
  return ({ identity, messageId, reaction }) =>
    identity === key.identity && messageId === key.messageId && reaction === key.reaction;
}

function hasMessage(board: MemoryBoard, id: MessageId): boolean {
  return Arr.some(board.messages, (message) => message.id === id);
}

function asReaction({ identity, messageId, reactedAt, reaction }: StoredReaction): Reaction {
  return { identity, messageId, reactedAt, reaction };
}

function listed(reactions: readonly StoredReaction[]): readonly Reaction[] {
  return sortedReactions(Arr.map(reactions, asReaction));
}

function add(board: MemoryBoard, adding: NewReaction): Changed {
  const { inbox } = board;
  if (!hasMessage(board, adding.messageId)) {
    return [Option.none(), inbox];
  }
  if (Arr.some(inbox.reactions, sameKey(adding))) {
    return [Option.some(false), inbox];
  }
  const { notifiesAuthor, ...reaction } = adding;
  return [Option.some(true), { ...inbox, reactions: [...inbox.reactions, { ...reaction, seen: !notifiesAuthor }] }];
}

function remove(board: MemoryBoard, key: ReactionKey): Changed {
  const { inbox } = board;
  if (!hasMessage(board, key.messageId)) {
    return [Option.none(), inbox];
  }
  const kept = Arr.filter(inbox.reactions, (stored) => !sameKey(key)(stored));
  return [Option.some(kept.length < inbox.reactions.length), { ...inbox, reactions: kept }];
}

function authoredBy(board: MemoryBoard, author: IdentityName): ReadonlySet<MessageId> {
  const own = Arr.filter(board.messages, (message) => message.author.name === author);
  return new Set(Arr.map(own, (message) => message.id));
}

function unseenFor(board: MemoryBoard, author: IdentityName): readonly StoredReaction[] {
  const own = authoredBy(board, author);
  return Arr.filter(board.inbox.reactions, (stored) => !stored.seen && own.has(stored.messageId));
}

function markSeen(board: MemoryBoard, author: IdentityName, ids: readonly MessageId[]): MemoryInbox {
  const own = authoredBy(board, author);
  const marked = new Set(Arr.filter(ids, (id) => own.has(id)));
  const reactions = Arr.map(board.inbox.reactions, (stored) => {
    if (marked.has(stored.messageId)) {
      return { ...stored, seen: true };
    }
    return stored;
  });
  return { ...board.inbox, reactions };
}

function memoryReactions({ changeInbox, read }: MemoryReactionsAccess): ReactionsSection {
  function changing(work: (board: MemoryBoard) => Changed): Fails<boolean | undefined> {
    return Effect.map(changeInbox(work), Option.getOrUndefined);
  }
  return {
    addReaction: (adding) => changing((board) => add(board, adding)),
    listReactions: (ids) =>
      read(({ inbox }) => listed(Arr.filter(inbox.reactions, (stored) => ids.includes(stored.messageId)))),
    listUnseenReactions: (author) => read((board) => listed(unseenFor(board, author))),
    markReactionsSeen: (author, ids) =>
      Effect.asVoid(changeInbox((board) => [true, markSeen(board, author, ids)] as const)),
    removeReaction: (key) => changing((board) => remove(board, key)),
  };
}

export { EMPTY_INBOX, type MemoryInbox, memoryReactions, withoutChannel, withoutIdentity };
