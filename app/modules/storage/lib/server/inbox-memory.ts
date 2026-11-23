import { Array as Arr, Effect, Option, Predicate, String as Str, pipe } from "effect";
import type { Channel, ChannelName } from "../../../channels/index.ts";
import type {
  HistoryPageRequest,
  InboxSection,
  Scope,
  StoredHistoryItem,
  StoredHistoryPage,
  StoredInboxItem,
} from "./inbox.ts";
import type { InboxReason, ReadPosition } from "../../../inbox/index.ts";
import type { Message, MessageId, Reply, TopLevelMessage } from "../../../messages/index.ts";
import { counted, threadIdOf } from "./messages.ts";
import { followersOf, movedTo, scopeOf } from "./inbox.ts";
import type { IdentityName } from "../../../identities/index.ts";
import type { StorageUnavailable } from "./errors.ts";

type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

interface MemoryInbox {
  readonly mentions: ReadonlySet<string>;
  readonly follows: ReadonlySet<string>;
  readonly subscriptions: ReadonlySet<string>;
  readonly positions: ReadonlyMap<string, MessageId>;
}

interface MemoryBoard {
  readonly messages: readonly Message[];
  readonly inbox: MemoryInbox;
}

interface BoardAccess {
  readonly read: <Value>(work: (board: MemoryBoard) => Value) => Fails<Value>;
  readonly changeInbox: <Value>(work: (board: MemoryBoard) => readonly [Value, MemoryInbox]) => Fails<Value>;
  readonly channelExists: (channel: ChannelName) => Fails<boolean>;
  readonly listChannels: () => Fails<readonly Channel[]>;
}

interface Asking {
  readonly board: MemoryBoard;
  readonly id: MessageId;
  readonly identity: IdentityName;
}

type Changed<Value> = readonly [Option.Option<Value>, MemoryInbox];

type KeysChange = (keys: ReadonlySet<string>, key: string) => ReadonlySet<string>;

interface Appended {
  readonly inbox: MemoryInbox;
  readonly message: Message;
}

interface Reading {
  readonly board: MemoryBoard;
  readonly identity: IdentityName;
}

const NOTHING_READ = 0;

const EMPTY_INBOX: MemoryInbox = {
  follows: new Set(),
  mentions: new Set(),
  positions: new Map(),
  subscriptions: new Set(),
};

function keyOf(identity: IdentityName, { channel, thread }: Scope): string {
  if (Predicate.isNull(thread)) {
    return `${identity} channel ${channel}`;
  }
  return `${identity} thread ${String(thread)}`;
}

function mentionKeyOf(identity: IdentityName, id: MessageId): string {
  return `${identity} message ${String(id)}`;
}

function threadScopeOf(message: Message): Scope {
  return { channel: message.channel, thread: threadIdOf(message) };
}

function withKey(keys: ReadonlySet<string>, key: string): ReadonlySet<string> {
  return new Set([...keys, key]);
}

function withoutKey(keys: ReadonlySet<string>, key: string): ReadonlySet<string> {
  return new Set(Arr.filter([...keys], (kept) => kept !== key));
}

function afterAppend({ inbox, message }: Appended): MemoryInbox {
  const followed = Arr.map(followersOf(message), (name) => keyOf(name, threadScopeOf(message)));
  const mentioned = Arr.map(message.mentions, (name) => mentionKeyOf(name, message.id));
  const read = keyOf(message.author.name, scopeOf(message));
  const position = movedTo({ current: inbox.positions.get(read), message });
  return {
    ...inbox,
    follows: new Set([...inbox.follows, ...followed]),
    mentions: new Set([...inbox.mentions, ...mentioned]),
    positions: new Map([...inbox.positions, [read, position.messageId]]),
  };
}

function isRead({ board, identity }: Reading, message: Message): boolean {
  const marker = board.inbox.positions.get(keyOf(identity, scopeOf(message))) ?? NOTHING_READ;
  return message.id <= marker;
}

function reasonsFor(reading: Reading, message: Message): readonly InboxReason[] {
  const { follows, mentions, subscriptions } = reading.board.inbox;
  const key = keyOf(reading.identity, scopeOf(message));
  const followed = message.kind === "reply" && follows.has(key);
  const mentioned = mentions.has(mentionKeyOf(reading.identity, message.id));
  const subscribed = message.kind === "top-level" && subscriptions.has(key);
  const reasons: readonly (readonly [InboxReason, boolean])[] = [
    ["followed-thread", followed],
    ["mention", mentioned],
    ["subscribed-channel", subscribed],
  ];
  return Arr.map(
    Arr.filter(reasons, ([, holds]) => holds),
    ([reason]) => reason,
  );
}

function currentParent(messages: readonly Message[], id: MessageId): TopLevelMessage | undefined {
  return pipe(
    Arr.findFirst(messages, (found): found is TopLevelMessage => found.kind === "top-level" && found.id === id),
    Option.map((parent) => {
      const replies = Arr.filter(messages, (reply): reply is Reply => reply.kind === "reply" && reply.replyTo === id);
      return counted({ parent, replies });
    }),
    Option.getOrUndefined,
  );
}

function historyItemFor(reading: Reading, message: Message): readonly StoredHistoryItem[] {
  const reasons = reasonsFor(reading, message);
  const parent = currentParent(reading.board.messages, threadIdOf(message));
  const isOwn = message.author.name === reading.identity;
  if (isOwn || !Arr.isReadonlyArrayNonEmpty(reasons) || Predicate.isUndefined(parent)) {
    return [];
  }
  const read = isRead(reading, message);
  if (message.kind === "top-level") {
    return [{ message: parent, parent, read, reasons }];
  }
  return [{ message, parent, read, reasons }];
}

function historyOf(reading: Reading): readonly StoredHistoryItem[] {
  return Arr.flatMap(reading.board.messages, (message) => historyItemFor(reading, message));
}

function inboxOf(reading: Reading): readonly StoredInboxItem[] {
  return Arr.flatMap(historyOf(reading), ({ message, parent, read, reasons }) => {
    if (read) {
      return [];
    }
    return [{ message, parent, reasons }];
  });
}

function historyPageOf(reading: Reading, page: HistoryPageRequest): StoredHistoryPage {
  const { before = Number.MAX_SAFE_INTEGER, limit } = page;
  const older = Arr.filter(historyOf(reading), (item) => item.message.id < before);
  const shown = Arr.reverse(Arr.takeRight(older, limit));
  return { hasMore: older.length > shown.length, items: shown };
}

function findIn(board: MemoryBoard, id: MessageId): Option.Option<Message> {
  return Arr.findFirst(board.messages, (message) => message.id === id);
}

function inboxItemOf(reading: Reading, id: MessageId): StoredInboxItem | undefined {
  return pipe(
    findIn(reading.board, id),
    Option.flatMap((message) => Arr.head(historyItemFor(reading, message))),
    Option.filter(({ read }) => !read),
    Option.map(({ message, parent, reasons }): StoredInboxItem => ({ message, parent, reasons })),
    Option.getOrUndefined,
  );
}

function ack({ board, id, identity }: Asking): Changed<ReadPosition> {
  const { inbox } = board;
  return Option.match(findIn(board, id), {
    onNone: () => [Option.none(), inbox],
    onSome: (message) => {
      const key = keyOf(identity, scopeOf(message));
      const position = movedTo({ current: inbox.positions.get(key), message });
      return [Option.some(position), { ...inbox, positions: new Map([...inbox.positions, [key, position.messageId]]) }];
    },
  });
}

function follow(change: KeysChange) {
  return ({ board, id, identity }: Asking): Changed<MessageId> => {
    const { inbox } = board;
    return Option.match(findIn(board, id), {
      onNone: () => [Option.none(), inbox],
      onSome: (message) => [
        Option.some(threadIdOf(message)),
        { ...inbox, follows: change(inbox.follows, keyOf(identity, threadScopeOf(message))) },
      ],
    });
  };
}

interface Forgetting {
  readonly inbox: MemoryInbox;
  readonly identity: IdentityName;
}

type MemoryInboxSection = InboxSection & {
  readonly forgetIdentity: (identity: IdentityName) => Fails<void>;
};

function withoutIdentity({ identity, inbox }: Forgetting): MemoryInbox {
  function kept(key: string): boolean {
    return !Str.startsWith(`${identity} `)(key);
  }
  return {
    follows: new Set(Arr.filter([...inbox.follows], kept)),
    mentions: new Set(Arr.filter([...inbox.mentions], kept)),
    positions: new Map(Arr.filter([...inbox.positions], ([key]: readonly [string, MessageId]) => kept(key))),
    subscriptions: new Set(Arr.filter([...inbox.subscriptions], kept)),
  };
}

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
    subscriptions: new Set(Arr.filter([...inbox.subscriptions], kept)),
  };
}

function memoryInbox({ changeInbox, channelExists, listChannels, read }: BoardAccess): MemoryInboxSection {
  function changeFound<Value>(work: (board: MemoryBoard) => Changed<Value>): Fails<Value | undefined> {
    return Effect.map(changeInbox(work), Option.getOrUndefined);
  }
  function subscription(change: KeysChange) {
    return (identity: IdentityName, channel: ChannelName): Fails<boolean> =>
      Effect.flatMap(channelExists(channel), (exists) => {
        if (!exists) {
          return Effect.succeed(false);
        }
        const key = keyOf(identity, { channel, thread: null });
        return changeInbox((board) => [
          true,
          { ...board.inbox, subscriptions: change(board.inbox.subscriptions, key) },
        ]);
      });
  }
  return {
    ackMessage: (identity, id) => changeFound((board) => ack({ board, id, identity })),
    findInboxItem: (identity, id) => read((board) => inboxItemOf({ board, identity }, id)),
    followThread: (identity, id) => changeFound((board) => follow(withKey)({ board, id, identity })),
    forgetIdentity: (identity) =>
      Effect.asVoid(changeInbox((board) => [true, withoutIdentity({ identity, inbox: board.inbox })])),
    listInbox: (identity) => read((board) => inboxOf({ board, identity })),
    listInboxAfter: (identity, after) =>
      read((board) => Arr.filter(inboxOf({ board, identity }), (item) => item.message.id > after)),
    listInboxHistory: (identity, page) => read((board) => historyPageOf({ board, identity }, page)),
    listSubscribedChannels: (identity) =>
      Effect.flatMap(listChannels(), (channels) =>
        read((board) =>
          Arr.filter(channels, (channel) =>
            board.inbox.subscriptions.has(keyOf(identity, { channel: channel.name, thread: null })),
          ),
        ),
      ),
    subscribeChannel: subscription(withKey),
    unfollowThread: (identity, id) => changeFound((board) => follow(withoutKey)({ board, id, identity })),
    unsubscribeChannel: subscription(withoutKey),
  };
}

export { EMPTY_INBOX, type MemoryInbox, type MemoryInboxSection, afterAppend, memoryInbox, withoutChannel };
