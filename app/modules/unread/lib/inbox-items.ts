import type { CookoutEvent, InboxItem, Message, MessageId, ReadPosition } from "../../sdk/index.ts";

interface UnreadCounts {
  readonly mentions: number;
  readonly plain: number;
}

interface InboxItems {
  readonly add: (item: InboxItem) => void;
  readonly receive: (event: CookoutEvent) => boolean;
  readonly counts: () => ReadonlyMap<string, UnreadCounts>;
  readonly list: () => readonly InboxItem[];
}

const ONE_MORE = 1;
const NONE: UnreadCounts = { mentions: 0, plain: 0 };

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

function counted(counts: UnreadCounts, item: InboxItem): UnreadCounts {
  if (item.reasons.includes("mention")) {
    return { ...counts, mentions: counts.mentions + ONE_MORE };
  }
  return { ...counts, plain: counts.plain + ONE_MORE };
}

function countsOf(items: Iterable<InboxItem>): ReadonlyMap<string, UnreadCounts> {
  const counts = new Map<string, UnreadCounts>();
  for (const item of items) {
    counts.set(item.channel.name, counted(counts.get(item.channel.name) ?? NONE, item));
  }
  return counts;
}

function oldestFirst(items: Iterable<InboxItem>): readonly InboxItem[] {
  return [...items].toSorted((first, second) => first.message.id - second.message.id);
}

function createInboxItems(): InboxItems {
  const items = new Map<MessageId, InboxItem>();
  const positions = new Map<string, MessageId>();

  function isRead(message: Message): boolean {
    const position = positions.get(scopeOfMessage(message)) ?? null;
    return position !== null && message.id <= position;
  }

  function add(item: InboxItem): void {
    if (!isRead(item.message)) {
      items.set(item.message.id, item);
    }
  }

  function read(position: ReadPosition): void {
    const scope = scopeOf(position.channel, position.thread);
    const before = positions.get(scope) ?? position.messageId;
    if (before <= position.messageId) {
      positions.set(scope, position.messageId);
    }
    for (const [id, item] of items) {
      if (isRead(item.message)) {
        items.delete(id);
      }
    }
  }

  return {
    add,
    counts: () => countsOf(items.values()),
    list: () => oldestFirst(items.values()),
    receive: (event) => {
      if (event.type === "inbox-item") {
        add(event.item);
        return true;
      }
      if (event.type === "read-position") {
        read(event.readPosition);
        return true;
      }
      return false;
    },
  };
}

export { type UnreadCounts, createInboxItems };
