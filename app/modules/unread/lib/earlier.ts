import type {
  CookoutClient,
  InboxHistoryItem,
  InboxHistoryQuery,
  InboxItem,
  Message,
  MessageId,
  Refusal,
} from "../../sdk/index.ts";
import { refusalOf } from "../../sdk/index.ts";

type MoreState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | (Refusal & { readonly status: "failed" });

type EarlierState =
  | { readonly status: "loading" }
  | {
      readonly status: "loaded";
      readonly items: readonly InboxItem[];
      readonly hasMore: boolean;
      readonly pageSize: number;
      readonly more: MoreState;
    }
  | (Refusal & { readonly status: "failed" });

interface Earlier {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => EarlierState;
  readonly loadMore: () => void;
}

interface LiveEarlier extends Earlier {
  readonly add: (item: InboxItem) => void;
  readonly drop: (isUnreadAgain: (message: Message) => boolean) => void;
}

interface UnreadItems {
  readonly has: (id: MessageId) => boolean;
  readonly isRead: (message: Message) => boolean;
}

interface EarlierOptions {
  readonly client: Pick<CookoutClient, "inboxHistory">;
  readonly pageSize?: number;
  readonly unread: UnreadItems;
}

interface Progress {
  readonly read: ReadonlyMap<MessageId, InboxItem>;
  readonly hasMore: boolean;
  readonly oldest: MessageId | null;
}

interface Pages extends EarlierOptions {
  readonly pageSize: number;
  readonly progress: () => Progress;
  readonly save: (progress: Progress) => void;
  readonly state: () => EarlierState;
  readonly publish: (state: EarlierState) => void;
}

const PAGE_SIZE = 50;
const IDLE: MoreState = { status: "idle" };
const LOADING: MoreState = { status: "loading" };

function newestFirst(items: Iterable<InboxItem>): readonly InboxItem[] {
  return [...items].toSorted((first, second) => second.message.id - first.message.id);
}

function loaded(pages: Pages, more: MoreState): EarlierState {
  const { hasMore, read } = pages.progress();
  return { hasMore, items: newestFirst(read.values()), more, pageSize: pages.pageSize, status: "loaded" };
}

function isRead(unread: UnreadItems, item: InboxHistoryItem): boolean {
  return !unread.has(item.message.id) && (unread.isRead(item.message) || item.read);
}

function queryOf(progress: Progress, limit: number): InboxHistoryQuery {
  if (progress.oldest === null) {
    return { limit };
  }
  return { before: progress.oldest, limit };
}

async function nextPage(pages: Pages): Promise<boolean> {
  const before = pages.progress();
  const answer = await pages.client.inboxHistory(queryOf(before, pages.pageSize));
  const read = new Map(before.read);
  let { oldest } = before;
  for (const item of answer.items) {
    if (isRead(pages.unread, item)) {
      read.set(item.message.id, item);
    }
    oldest = item.message.id;
  }
  pages.save({ hasMore: answer.hasMore, oldest, read });
  return read.size > before.read.size;
}

async function readPages(pages: Pages): Promise<void> {
  const grew = await nextPage(pages);
  if (!grew && pages.progress().hasMore) {
    await readPages(pages);
  }
}

async function loadFirst(pages: Pages): Promise<void> {
  try {
    await readPages(pages);
    pages.publish(loaded(pages, IDLE));
  } catch (error: unknown) {
    pages.publish({ ...refusalOf(error), status: "failed" });
  }
}

function canLoadMore(pages: Pages): boolean {
  const shown = pages.state();
  return shown.status === "loaded" && shown.hasMore && shown.more.status !== "loading";
}

async function loadOlder(pages: Pages): Promise<void> {
  if (!canLoadMore(pages)) {
    return;
  }
  pages.publish(loaded(pages, LOADING));
  try {
    await readPages(pages);
    pages.publish(loaded(pages, IDLE));
  } catch (error: unknown) {
    pages.publish(loaded(pages, { ...refusalOf(error), status: "failed" }));
  }
}

async function loadOlderAfter(previous: Promise<void> | null, pages: Pages): Promise<void> {
  await previous;
  await loadOlder(pages);
}

function addRead(pages: Pages, item: InboxItem): void {
  const progress = pages.progress();
  pages.save({ ...progress, read: new Map(progress.read).set(item.message.id, item) });
  const shown = pages.state();
  if (shown.status === "loaded") {
    pages.publish(loaded(pages, shown.more));
  }
}

function dropRead(pages: Pages, isUnreadAgain: (message: Message) => boolean): void {
  const progress = pages.progress();
  const read = new Map(progress.read);
  for (const item of progress.read.values()) {
    if (isUnreadAgain(item.message)) {
      read.delete(item.message.id);
    }
  }
  pages.save({ ...progress, read });
  const shown = pages.state();
  if (shown.status === "loaded") {
    pages.publish(loaded(pages, shown.more));
  }
}

function createEarlier(options: EarlierOptions): LiveEarlier {
  const listeners = new Set<() => void>();
  let queue: Promise<void> | null = null;
  let progress: Progress = { hasMore: true, oldest: null, read: new Map() };
  let state: EarlierState = { status: "loading" };
  const pages: Pages = {
    client: options.client,
    pageSize: options.pageSize ?? PAGE_SIZE,
    progress: () => progress,
    publish: (next) => {
      state = next;
      for (const listener of listeners) {
        listener();
      }
    },
    save: (next) => {
      progress = next;
    },
    state: () => state,
    unread: options.unread,
  };
  return {
    add: (item) => {
      addRead(pages, item);
    },
    drop: (isUnreadAgain) => {
      dropRead(pages, isUnreadAgain);
    },
    loadMore: () => {
      queue = loadOlderAfter(queue, pages);
    },
    snapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      queue ??= loadFirst(pages);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export { type Earlier, type EarlierState, createEarlier };
