import { Array as Arr, Effect, Option, Predicate } from "effect";
import type {
  InboxHistoryItem,
  InboxHistoryNudge,
  InboxHistoryResponse,
  InboxItem,
  InboxResponse,
  Nudge,
  NudgeResponse,
} from "../../index.ts";
import type { Storage, StorageUnavailable, StoredNudge } from "../../../storage/server.ts";
import { isNudgeId, nudgeTexts } from "../../index.ts";
import { itemsWithReactions, reactionItemFor, withReactionItems } from "./reaction-items.ts";
import type { Channel } from "../../../channels/index.ts";
import type { Identity } from "../../../identities/index.ts";
import type { MessageId } from "../../../messages/index.ts";
import type { Refusal } from "../../../http/index.ts";
import { echoed } from "../../../http/index.ts";
import { pageSize } from "../../../messages/index.ts";

type Fails<Value> = Effect.Effect<Value, Refusal | StorageUnavailable>;

type Store = Storage["Service"];

type StoredItem = Omit<InboxItem, "channel">;

type StoredHistoryItem = Omit<InboxHistoryItem, "channel">;

interface HistoryQuery {
  readonly before?: MessageId;
  readonly limit?: number;
}

interface HistoryPage {
  readonly before?: MessageId;
  readonly limit: number;
}

interface Asking {
  readonly storage: Store;
  readonly caller: Identity;
}

interface ListingCalls {
  readonly inbox: (caller: Identity) => Fails<InboxResponse>;
  readonly history: (caller: Identity, query: HistoryQuery) => Fails<InboxHistoryResponse>;
  readonly itemFor: (caller: Identity, id: MessageId) => Fails<readonly InboxItem[]>;
  readonly itemsAfter: (caller: Identity, id: MessageId) => Fails<readonly InboxItem[]>;
  readonly reactionItemFor: (caller: Identity, id: MessageId) => Fails<readonly InboxItem[]>;
  readonly markNudgeRead: (caller: Identity, asked: string) => Fails<NudgeResponse>;
}

const NOT_FOUND = 404;

function nudgeNotFound(asked: string): Refusal {
  return { code: "nudge_not_found", message: `You have no nudge ${echoed(asked)}.`, status: NOT_FOUND };
}

function withChannel<Item extends StoredItem>(
  channels: readonly Channel[],
  item: Item,
): readonly (Item & { readonly channel: Channel })[] {
  const channel = Arr.findFirst(channels, (listed) => listed.name === item.message.channel);
  return Option.toArray(Option.map(channel, (listed) => ({ ...item, channel: listed })));
}

function withChannels<Item extends StoredItem>(
  storage: Store,
  items: readonly Item[],
): Fails<readonly (Item & { readonly channel: Channel })[]> {
  return Effect.zipWith(itemsWithReactions({ items, storage }), storage.listChannels(), (counted, channels) =>
    Arr.flatMap(counted, (item) => withChannel(channels, item)),
  );
}

function historyNudgeIn(channels: readonly Channel[]): (stored: StoredNudge) => readonly InboxHistoryNudge[] {
  return ({ id, kind, parent, raisedAt, read }) =>
    Option.toArray(
      Option.map(
        Arr.findFirst(channels, (channel) => channel.name === parent.channel),
        (channel) => ({ channel, id, kind, parent, raisedAt, read, text: nudgeTexts[kind] }),
      ),
    );
}

function unread({ read: _read, ...nudge }: InboxHistoryNudge): Nudge {
  return nudge;
}

interface Showing {
  readonly storage: Store;
  readonly stored: readonly StoredNudge[];
}

function shownNudges({ storage, stored }: Showing): Effect.Effect<readonly InboxHistoryNudge[], StorageUnavailable> {
  if (!Arr.isReadonlyArrayNonEmpty(stored)) {
    return Effect.succeed([]);
  }
  return Effect.map(storage.listChannels(), (channels) => Arr.flatMap(stored, historyNudgeIn(channels)));
}

function historyPage({ before, limit = pageSize.default }: HistoryQuery): HistoryPage {
  if (Predicate.isUndefined(before)) {
    return { limit };
  }
  return { before, limit };
}

function nudgesOnPage({ caller, storage }: Asking, query: HistoryQuery): Fails<readonly InboxHistoryNudge[]> {
  if (Predicate.isNotUndefined(query.before)) {
    return Effect.succeed([]);
  }
  return Effect.flatMap(storage.listNudges(caller.name, "all"), (stored) =>
    shownNudges({ storage, stored: Arr.reverse(stored) }),
  );
}

function historyOf(asking: Asking, query: HistoryQuery): Fails<InboxHistoryResponse> {
  const { caller, storage } = asking;
  return Effect.gen(function* inboxHistory() {
    const { hasMore, items } = yield* storage.listInboxHistory(caller.name, historyPage(query));
    const listed = yield* withChannels<StoredHistoryItem>(storage, items);
    const nudges = yield* nudgesOnPage(asking, query);
    return { hasMore, items: listed, nudges };
  });
}

function unreadNudges({ caller, storage }: Asking): Fails<readonly Nudge[]> {
  return Effect.flatMap(storage.listNudges(caller.name, "unread"), (stored) =>
    Effect.map(shownNudges({ storage, stored }), Arr.map(unread)),
  );
}

function inboxOf(asking: Asking): Fails<InboxResponse> {
  const { caller, storage } = asking;
  const items = storage.listInbox(caller.name).pipe(
    Effect.flatMap((stored) => withReactionItems({ author: caller.name, items: stored, storage })),
    Effect.flatMap((stored) => withChannels(storage, stored)),
  );
  return Effect.zipWith(items, unreadNudges(asking), (listed, nudges) => ({ items: listed, nudges }));
}

function markedNudge({ caller, storage }: Asking, asked: string): Fails<StoredNudge | null> {
  const id = Number(asked);
  if (!isNudgeId(id)) {
    return Effect.succeed(null);
  }
  return storage.markNudgeRead(caller.name, id);
}

function markNudgeRead({ caller, storage }: Asking, asked: string): Fails<NudgeResponse> {
  return Effect.gen(function* markRead() {
    const marked = yield* markedNudge({ caller, storage }, asked);
    const [nudge] = yield* shownNudges({ storage, stored: Arr.fromNullishOr(marked) });
    if (Predicate.isUndefined(nudge)) {
      return yield* Effect.fail(nudgeNotFound(asked));
    }
    return { nudge };
  });
}

function listingOn(storage: Store): ListingCalls {
  return {
    history: (caller, query) => historyOf({ caller, storage }, query),
    inbox: (caller) => inboxOf({ caller, storage }),
    itemFor: (caller, id) =>
      Effect.flatMap(storage.findInboxItem(caller.name, id), (stored) =>
        withChannels(storage, Arr.fromNullishOr(stored)),
      ),
    itemsAfter: (caller, id) =>
      Effect.flatMap(storage.listInboxAfter(caller.name, id), (stored) => withChannels(storage, stored)),
    markNudgeRead: (caller, asked) => markNudgeRead({ caller, storage }, asked),
    reactionItemFor: (caller, id) =>
      Effect.flatMap(reactionItemFor({ author: caller.name, id, storage }), (stored) => withChannels(storage, stored)),
  };
}

export { listingOn, shownNudges };
