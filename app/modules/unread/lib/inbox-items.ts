import type {
  ChannelName,
  CookoutClient,
  CookoutEvent,
  InboxItem,
  Message,
  MessageId,
  MovedBackReadPosition,
  OfflineAlert,
  ReadPosition,
} from "../../sdk/index.ts";
import { openOnly, reparent } from "./closed-threads.ts";

interface InboxItems {
  readonly addAll: (all: readonly InboxItem[]) => void;
  readonly readAll: (all: readonly ReadPosition[], onRead: (item: InboxItem) => void) => void;
  readonly moveBack: (position: MovedBackReadPosition) => void;
  readonly movesBack: (channel: ChannelName, thread: MessageId | null) => number;
  readonly readPosition: (channel: ChannelName, thread: MessageId | null) => MessageId | null;
  readonly receive: (event: CookoutEvent, onRead: (item: InboxItem) => void) => boolean;
  readonly list: () => readonly InboxItem[];
  readonly inbox: () => readonly InboxItem[];
  readonly has: (id: MessageId) => boolean;
  readonly isRead: (message: Message) => boolean;
}

function scopeOf(channel: string, thread: MessageId | null): string {
  if (thread === null) {
    return channel;
  }
  return `${channel}/${String(thread)}`;
}

function scopeOfMessage(message: Message): string {
  if (message.kind === "reply") {
    return scopeOf(message.channel, message.replyTo);
  }
  return scopeOf(message.channel, null);
}

function oldestFirst(items: Iterable<InboxItem>): readonly InboxItem[] {
  return [...items].toSorted((first, second) => first.message.id - second.message.id);
}

type Positions = Map<string, MessageId>;

const NO_MOVES = 0;
const ONE_MORE = 1;

function isReadAt(positions: Positions, message: Message): boolean {
  const position = positions.get(scopeOfMessage(message)) ?? null;
  return position !== null && message.id <= position;
}

function isReaction(item: InboxItem): boolean {
  return item.reasons.includes("reaction");
}

function ackedAt(position: ReadPosition, item: InboxItem): boolean {
  const { message } = item;
  return scopeOfMessage(message) === scopeOf(position.channel, position.thread) && message.id <= position.messageId;
}

function isReadIn({ acked, positions }: Pick<ReadingIn, "acked" | "positions">, item: InboxItem): boolean {
  if (isReaction(item)) {
    return acked.some((position) => ackedAt(position, item));
  }
  return isReadAt(positions, item.message);
}

function moveTo(positions: Positions, position: ReadPosition): void {
  const scope = scopeOf(position.channel, position.thread);
  const before = positions.get(scope) ?? position.messageId;
  if (before <= position.messageId) {
    positions.set(scope, position.messageId);
  }
}

interface Moved {
  readonly positions: Positions;
  readonly moves: Map<string, number>;
}

function moveBackIn({ moves, positions }: Moved, { channel, messageId, thread }: MovedBackReadPosition): void {
  const scope = scopeOf(channel, thread);
  positions.delete(scope);
  if (messageId !== null) {
    positions.set(scope, messageId);
  }
  moves.set(scope, (moves.get(scope) ?? NO_MOVES) + ONE_MORE);
}

interface ReadingIn {
  readonly all: readonly ReadPosition[];
  readonly acked: readonly ReadPosition[];
  readonly items: Map<MessageId, InboxItem>;
  readonly positions: Positions;
  readonly onRead: (item: InboxItem) => void;
}

function readIn({ acked, all, items, onRead, positions }: ReadingIn): void {
  for (const position of all) {
    moveTo(positions, position);
  }
  for (const [id, item] of items) {
    if (isReadIn({ acked, positions }, item)) {
      items.delete(id);
      onRead(item);
    }
  }
}

interface Receiving extends Pick<ReadingIn, "items" | "onRead" | "positions"> {
  readonly addAll: (all: readonly InboxItem[]) => void;
}

function receiveIn({ addAll, items, onRead, positions }: Receiving, event: CookoutEvent): boolean {
  if (event.type === "inbox-item") {
    addAll([event.item]);
    return true;
  }
  if (event.type === "read-position") {
    readIn({ acked: [event.readPosition], all: [event.readPosition], items, onRead, positions });
    return true;
  }
  if (event.type === "thread") {
    return reparent({ items, parent: event.parent });
  }
  return false;
}

function createInboxItems(): InboxItems {
  const items = new Map<MessageId, InboxItem>();
  const positions: Positions = new Map();
  const moved: Moved = { moves: new Map(), positions };

  function isRead(message: Message): boolean {
    return isReadAt(positions, message);
  }

  function addAll(all: readonly InboxItem[]): void {
    for (const item of all) {
      if (isReaction(item) || !isRead(item.message)) {
        items.set(item.message.id, item);
      }
    }
  }

  function read(all: readonly ReadPosition[], onRead: (item: InboxItem) => void): void {
    readIn({ acked: [], all, items, onRead, positions });
  }

  return {
    addAll,
    has: (id) => items.has(id),
    inbox: () => openOnly(oldestFirst(items.values())),
    isRead,
    list: () => oldestFirst(items.values()),
    moveBack: (position) => {
      moveBackIn(moved, position);
    },
    movesBack: (channel, thread) => moved.moves.get(scopeOf(channel, thread)) ?? NO_MOVES,
    readAll: read,
    readPosition: (channel, thread) => positions.get(scopeOf(channel, thread)) ?? null,
    receive: (event, onRead) => receiveIn({ addAll, items, onRead, positions }, event),
  };
}

interface Reading {
  readonly client: Pick<CookoutClient, "inbox" | "readPositions">;
  readonly items: InboxItems;
  readonly onRead: (item: InboxItem) => void;
  readonly onAlerts: (alerts: readonly OfflineAlert[]) => void;
}

async function readInto({ client, items, onAlerts, onRead }: Reading): Promise<void> {
  const [inbox, { readPositions }] = await Promise.all([client.inbox(), client.readPositions()]);
  items.readAll(readPositions, onRead);
  items.addAll(inbox.items);
  onAlerts(inbox.alerts);
}

export { type InboxItems, createInboxItems, readInto };
