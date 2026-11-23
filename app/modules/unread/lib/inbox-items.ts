import type {
  ChannelName,
  CookoutClient,
  CookoutEvent,
  InboxItem,
  Message,
  MessageId,
  ReadPosition,
} from "../../sdk/index.ts";

interface InboxItems {
  readonly addAll: (all: readonly InboxItem[]) => void;
  readonly readAll: (all: readonly ReadPosition[], onRead: (item: InboxItem) => void) => void;
  readonly readPosition: (channel: ChannelName, thread: MessageId | null) => MessageId | null;
  readonly receive: (event: CookoutEvent, onRead: (item: InboxItem) => void) => boolean;
  readonly list: () => readonly InboxItem[];
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

function isReadAt(positions: Positions, message: Message): boolean {
  const position = positions.get(scopeOfMessage(message)) ?? null;
  return position !== null && message.id <= position;
}

function moveTo(positions: Positions, position: ReadPosition): void {
  const scope = scopeOf(position.channel, position.thread);
  const before = positions.get(scope) ?? position.messageId;
  if (before <= position.messageId) {
    positions.set(scope, position.messageId);
  }
}

function createInboxItems(): InboxItems {
  const items = new Map<MessageId, InboxItem>();
  const positions: Positions = new Map();

  function isRead(message: Message): boolean {
    return isReadAt(positions, message);
  }

  function addAll(all: readonly InboxItem[]): void {
    for (const item of all) {
      if (!isRead(item.message)) {
        items.set(item.message.id, item);
      }
    }
  }

  function read(all: readonly ReadPosition[], onRead: (item: InboxItem) => void): void {
    for (const position of all) {
      moveTo(positions, position);
    }
    for (const [id, item] of items) {
      if (isRead(item.message)) {
        items.delete(id);
        onRead(item);
      }
    }
  }

  return {
    addAll,
    has: (id) => items.has(id),
    isRead,
    list: () => oldestFirst(items.values()),
    readAll: read,
    readPosition: (channel, thread) => positions.get(scopeOf(channel, thread)) ?? null,
    receive: (event, onRead) => {
      if (event.type === "inbox-item") {
        addAll([event.item]);
        return true;
      }
      if (event.type === "read-position") {
        read([event.readPosition], onRead);
        return true;
      }
      return false;
    },
  };
}

interface Reading {
  readonly client: Pick<CookoutClient, "inbox" | "readPositions">;
  readonly items: InboxItems;
  readonly onRead: (item: InboxItem) => void;
}

async function readInto({ client, items, onRead }: Reading): Promise<void> {
  const [inbox, { readPositions }] = await Promise.all([client.inbox(), client.readPositions()]);
  items.readAll(readPositions, onRead);
  items.addAll(inbox.items);
}

export { type InboxItems, createInboxItems, readInto };
