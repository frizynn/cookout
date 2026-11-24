import type { Applying, EarlierHeld, InboxEntries } from "./inbox-entries.ts";
import type {
  ChannelName,
  InboxHistoryItem,
  InboxItem,
  MovedBackReadPosition,
  ReadPosition,
  TopLevelMessage,
} from "../../sdk/index.ts";
import { isReadAt, placeKey, placeOfMessage } from "./read-positions-slice.ts";
import { same, withoutWhere } from "./inbox-entries.ts";
import type { ReadPositions } from "./read-positions-slice.ts";

const NONE = 0;
const NOTHING_READ = 0;

function isReaction(item: InboxItem): boolean {
  return item.reasons.includes("reaction");
}

function ackedAt(position: ReadPosition, item: InboxItem): boolean {
  return placeKey(placeOfMessage(item.message)) === placeKey(position) && item.message.id <= position.messageId;
}

interface Reading {
  readonly entries: InboxEntries;
  readonly positions: ReadPositions;
  readonly acked: readonly ReadPosition[];
}

function isReadIn({ acked, positions }: Omit<Reading, "entries">, item: InboxItem): boolean {
  if (isReaction(item)) {
    return acked.some((position) => ackedAt(position, item));
  }
  return isReadAt({ message: item.message, positions });
}

function withRead(reading: Reading): InboxEntries {
  const { entries } = reading;
  const read = [...entries.items.values()].filter((item) => isReadIn(reading, item));
  if (read.length === NONE) {
    return entries;
  }
  const items = new Map(entries.items);
  const earlier = new Map(entries.earlier.read);
  for (const item of read) {
    items.delete(item.message.id);
    earlier.set(item.message.id, item);
  }
  return { ...entries, earlier: { ...entries.earlier, read: earlier }, items };
}

interface Adding {
  readonly entries: InboxEntries;
  readonly positions: ReadPositions;
  readonly items: readonly InboxItem[];
}

function withItems({ entries, items, positions }: Adding): InboxEntries {
  const fresh = items.filter(
    (item) =>
      (isReaction(item) || !isReadAt({ message: item.message, positions })) &&
      !same({ one: entries.items.get(item.message.id), other: item }),
  );
  if (fresh.length === NONE) {
    return entries;
  }
  const next = new Map(entries.items);
  for (const item of fresh) {
    next.set(item.message.id, item);
  }
  return { ...entries, items: next };
}

function isAfter(position: MovedBackReadPosition, item: InboxItem): boolean {
  return (
    placeKey(placeOfMessage(item.message)) === placeKey(position) &&
    item.message.id > (position.messageId ?? NOTHING_READ)
  );
}

function withEarlier(entries: InboxEntries, earlier: EarlierHeld): InboxEntries {
  if (earlier === entries.earlier) {
    return entries;
  }
  return { ...entries, earlier };
}

function earlierWithout(earlier: EarlierHeld, gone: (item: InboxItem) => boolean): EarlierHeld {
  const read = withoutWhere({ gone, held: earlier.read });
  if (read === earlier.read) {
    return earlier;
  }
  return { ...earlier, read };
}

function withoutChannel(entries: InboxEntries, channel: ChannelName): InboxEntries {
  function inChannel(item: InboxItem): boolean {
    return item.message.channel === channel;
  }
  const items = withoutWhere({ gone: inChannel, held: entries.items });
  const earlier = earlierWithout(entries.earlier, inChannel);
  if (items === entries.items && earlier === entries.earlier) {
    return entries;
  }
  return { ...entries, earlier, items };
}

interface Paging {
  readonly entries: InboxEntries;
  readonly page: readonly InboxHistoryItem[];
}

function isReadInHistory(entries: InboxEntries, item: InboxHistoryItem): boolean {
  return item.read && !entries.items.has(item.message.id);
}

function earlierWithPage(paging: Paging): EarlierHeld {
  const { earlier } = paging.entries;
  const read = new Map(earlier.read);
  for (const item of paging.page) {
    if (isReadInHistory(paging.entries, item)) {
      read.set(item.message.id, item);
    }
  }
  return { ...earlier, read };
}

function earlierApplied({ change, entries }: Applying): InboxEntries {
  if (change.type === "earlier-more") {
    return withEarlier(entries, { ...entries.earlier, more: change.more });
  }
  if (change.type === "earlier-page") {
    const { hasMore, oldest } = change;
    return withEarlier(entries, { ...earlierWithPage({ entries, page: change.items }), hasMore, oldest });
  }
  if (change.type === "read-position-moved-back") {
    const { readPosition } = change;
    return withEarlier(
      entries,
      earlierWithout(entries.earlier, (item) => isAfter(readPosition, item)),
    );
  }
  return entries;
}

function readApplied({ change, entries, positions }: Applying): InboxEntries {
  if (change.type === "read-position") {
    return withRead({ acked: [change.readPosition], entries, positions });
  }
  if (change.type === "positions-read" || change.type === "inbox-acked-all") {
    return withRead({ acked: [], entries, positions });
  }
  return entries;
}

function reparented(entries: InboxEntries, parent: TopLevelMessage): InboxEntries {
  const under = [...entries.items.values()].filter(
    (item) => item.parent.id === parent.id && !same({ one: item.parent, other: parent }),
  );
  if (under.length === NONE) {
    return entries;
  }
  const items = new Map(entries.items);
  for (const item of under) {
    items.set(item.message.id, { ...item, parent });
  }
  return { ...entries, items };
}

function itemsApplied(applying: Applying): InboxEntries {
  const { change, entries, positions } = applying;
  if (change.type === "inbox-item") {
    return withItems({ entries, items: [change.item], positions });
  }
  if (change.type === "inbox-read-again") {
    return withItems({ entries, items: change.items, positions });
  }
  if (change.type === "channel-deleted") {
    return withoutChannel(entries, change.channel.name);
  }
  if (change.type === "thread") {
    return reparented(entries, change.parent);
  }
  return readApplied(applying);
}

export { earlierApplied, earlierWithPage, isReaction, itemsApplied, withItems, withRead };
