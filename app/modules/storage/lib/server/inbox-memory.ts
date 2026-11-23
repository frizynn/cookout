import { Array as Arr, Effect, Option, Predicate, pipe } from "effect";
import type { Channel, ChannelName } from "../../../channels/index.ts";
import type {
  HistoryPageRequest,
  InboxSection,
  Scope,
  StoredHistoryItem,
  StoredHistoryPage,
  StoredInboxItem,
} from "./inbox.ts";
import type { InboxReason, MovedBackReadPosition, ReadPosition } from "../../../inbox/index.ts";
import type { Message, MessageId, Reply, TopLevelMessage } from "../../../messages/index.ts";
import { counted, threadIdOf } from "./messages.ts";
import { followersOf, movedTo, newestPerScope, scopeOf } from "./inbox.ts";
import { moveBackIn, readPositionsIn } from "./read-positions-memory.ts";
import type { IdentityName } from "../../../identities/index.ts";
import type { MemoryInbox } from "./inbox-memory-state.ts";
import type { StorageUnavailable } from "./errors.ts";

type Fails<Value> = Effect.Effect<Value, StorageUnavailable>;

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

interface PositionMoving {
  readonly board: MemoryBoard;
  readonly key: string;
  readonly message: Message;
}

type PositionMove<Value> = (moving: PositionMoving) => readonly [Value, ReadonlyMap<string, MessageId>];

function moving<Value>(move: PositionMove<Value>) {
  return ({ board, id, identity }: Asking): Changed<Value> =>
    Option.match(findIn(board, id), {
      onNone: () => [Option.none(), board.inbox],
      onSome: (message) => {
        const [value, positions] = move({ board, key: keyOf(identity, scopeOf(message)), message });
        return [Option.some(value), { ...board.inbox, positions }];
      },
    });
}

const ack = moving<ReadPosition>(({ board, key, message }) => {
  const position = movedTo({ current: board.inbox.positions.get(key), message });
  return [position, new Map([...board.inbox.positions, [key, position.messageId]])];
});

const moveBack = moving<MovedBackReadPosition>(({ board, key, message }) =>
  moveBackIn({ key, message, messages: board.messages, positions: board.inbox.positions }),
);

interface AckingInbox {
  readonly board: MemoryBoard;
  readonly identity: IdentityName;
  readonly upTo: MessageId;
}

function ackInbox({ board, identity, upTo }: AckingInbox): readonly [readonly ReadPosition[], MemoryInbox] {
  const positions = new Map(board.inbox.positions);
  const moved = Arr.map(newestPerScope({ items: inboxOf({ board, identity }), upTo }), (message) => {
    const key = keyOf(identity, scopeOf(message));
    const position = movedTo({ current: positions.get(key), message });
    positions.set(key, position.messageId);
    return position;
  });
  return [moved, { ...board.inbox, positions }];
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

type MemoryInboxSection = InboxSection;

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
    ackInbox: (identity, upTo) => changeInbox((board) => ackInbox({ board, identity, upTo })),
    ackMessage: (identity, id) => changeFound((board) => ack({ board, id, identity })),
    findInboxItem: (identity, id) => read((board) => inboxItemOf({ board, identity }, id)),
    followThread: (identity, id) => changeFound((board) => follow(withKey)({ board, id, identity })),
    listInbox: (identity) => read((board) => inboxOf({ board, identity })),
    listInboxAfter: (identity, after) =>
      read((board) => Arr.filter(inboxOf({ board, identity }), (item) => item.message.id > after)),
    listInboxHistory: (identity, page) => read((board) => historyPageOf({ board, identity }, page)),
    listReadPositions: (identity) =>
      read(({ inbox, messages }) =>
        readPositionsIn({ messages, positionOf: (scope) => inbox.positions.get(keyOf(identity, scope)) }),
      ),
    listSubscribedChannels: (identity) =>
      Effect.flatMap(listChannels(), (channels) =>
        read((board) =>
          Arr.filter(channels, (channel) =>
            board.inbox.subscriptions.has(keyOf(identity, { channel: channel.name, thread: null })),
          ),
        ),
      ),
    moveReadPositionBack: (identity, id) => changeFound((board) => moveBack({ board, id, identity })),
    subscribeChannel: subscription(withKey),
    unfollowThread: (identity, id) => changeFound((board) => follow(withoutKey)({ board, id, identity })),
    unsubscribeChannel: subscription(withoutKey),
  };
}

export { type MemoryInboxSection, afterAppend, memoryInbox };
