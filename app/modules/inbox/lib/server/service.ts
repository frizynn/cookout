import type {
  AckAllRequest,
  AckAllResponse,
  AckResponse,
  FollowResponse,
  InboxHistoryItem,
  InboxHistoryResponse,
  InboxItem,
  InboxResponse,
  MarkUnreadResponse,
  MovedBackReadPosition,
  OfflineAlert,
  OfflineAlertResponse,
  ReadPositionsResponse,
  SubscriptionResponse,
} from "../../index.ts";
import type { Acked, Fails, Hub } from "./acks.ts";
import { Array as Arr, Context, Effect, Layer, Option, Predicate, PubSub } from "effect";
import type { Identity, IdentityName } from "../../../identities/index.ts";
import { OfflineAlerts, unread } from "./offline-alerts.ts";
import { ReadReceipts, messageNotFound } from "../../../messages/server.ts";
import { acksOn, orMessageNotFound } from "./acks.ts";
import { isMessageId, pageSize } from "../../../messages/index.ts";
import { itemsWithReactions, reactionItemFor, withReactionItems } from "./reaction-items.ts";
import type { MessageId } from "../../../messages/index.ts";
import type { Scope } from "effect";
import { Storage } from "../../../storage/server.ts";
import type { StorageUnavailable } from "../../../storage/server.ts";
import type { SubscriptionChanged } from "./subscriptions.ts";
import { subscription } from "./subscriptions.ts";

type Channel = InboxItem["channel"];

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

type FollowChange = (identity: IdentityName, id: MessageId) => Effect.Effect<MessageId | undefined, StorageUnavailable>;

interface MovedBack {
  readonly identity: IdentityName;
  readonly readPosition: MovedBackReadPosition;
}

interface Hubs {
  readonly acked: Hub<Acked>;
  readonly readReceipts: ReadReceipts["Service"];
  readonly movedBack: Hub<MovedBack>;
  readonly subscriptions: Hub<SubscriptionChanged>;
  readonly offlineAlerts: OfflineAlerts["Service"];
}

interface InboxService {
  readonly inbox: (caller: Identity) => Fails<InboxResponse>;
  readonly history: (caller: Identity, query: HistoryQuery) => Fails<InboxHistoryResponse>;
  readonly itemFor: (caller: Identity, id: MessageId) => Fails<readonly InboxItem[]>;
  readonly itemsAfter: (caller: Identity, id: MessageId) => Fails<readonly InboxItem[]>;
  readonly reactionItemFor: (caller: Identity, id: MessageId) => Fails<readonly InboxItem[]>;
  readonly ack: (caller: Identity, id: MessageId) => Fails<AckResponse>;
  readonly ackAll: (caller: Identity, request: AckAllRequest) => Fails<AckAllResponse>;
  readonly markAlertRead: (caller: Identity, asked: string) => Fails<OfflineAlertResponse>;
  readonly readPositions: (caller: Identity) => Fails<ReadPositionsResponse>;
  readonly acked: Effect.Effect<PubSub.Subscription<Acked>, never, Scope.Scope>;
  readonly markUnread: (caller: Identity, id: MessageId) => Fails<MarkUnreadResponse>;
  readonly movedBack: Effect.Effect<PubSub.Subscription<MovedBack>, never, Scope.Scope>;
  readonly subscriptionChanged: Effect.Effect<PubSub.Subscription<SubscriptionChanged>, never, Scope.Scope>;
  readonly follow: (caller: Identity, asked: string) => Fails<FollowResponse>;
  readonly unfollow: (caller: Identity, asked: string) => Fails<FollowResponse>;
  readonly subscribe: (caller: Identity, channel: string) => Fails<SubscriptionResponse>;
  readonly unsubscribe: (caller: Identity, channel: string) => Fails<SubscriptionResponse>;
}

class Inbox extends Context.Service<Inbox, InboxService>()("@ai-hero/cookout/inbox/lib/server/service/Inbox") {}

function withChannel<Item extends StoredItem>(
  channels: readonly Channel[],
  item: Item,
): readonly (Item & { readonly channel: Channel })[] {
  const channel = Arr.findFirst(channels, (listed) => listed.name === item.message.channel);
  return Option.toArray(Option.map(channel, (listed) => ({ ...item, channel: listed })));
}

function messageIdOf(asked: string): Fails<MessageId> {
  const id = Number(asked);
  if (isMessageId(id)) {
    return Effect.succeed(id);
  }
  return Effect.fail(messageNotFound(asked));
}

function following(change: FollowChange, isFollowing: boolean) {
  return (caller: Identity, asked: string): Fails<FollowResponse> =>
    Effect.gen(function* changeFollow() {
      const id = yield* messageIdOf(asked);
      const thread = yield* Effect.flatMap(change(caller.name, id), orMessageNotFound<MessageId>(asked));
      return { following: isFollowing, thread };
    });
}

function withChannels<Item extends StoredItem>(
  storage: Storage["Service"],
  items: readonly Item[],
): Fails<readonly (Item & { readonly channel: Channel })[]> {
  return Effect.zipWith(itemsWithReactions({ items, storage }), storage.listChannels(), (counted, channels) =>
    Arr.flatMap(counted, (item) => withChannel(channels, item)),
  );
}

function historyPage({ before, limit = pageSize.default }: HistoryQuery): HistoryPage {
  if (Predicate.isUndefined(before)) {
    return { limit };
  }
  return { before, limit };
}

interface InboxOn {
  readonly storage: Storage["Service"];
  readonly hubs: Hubs;
}

function alertsOnPage(hubs: Hubs, caller: Identity, query: HistoryQuery): Fails<readonly OfflineAlert[]> {
  if (Predicate.isNotUndefined(query.before)) {
    return Effect.succeed([]);
  }
  return Effect.map(hubs.offlineAlerts.list(caller), Arr.reverse);
}

function historyOf(on: InboxOn, caller: Identity, query: HistoryQuery): Fails<InboxHistoryResponse> {
  const { hubs, storage } = on;
  return Effect.gen(function* historyPageOf() {
    const { hasMore, items } = yield* storage.listInboxHistory(caller.name, historyPage(query));
    const listed = yield* withChannels<StoredHistoryItem>(storage, items);
    const alerts = yield* alertsOnPage(hubs, caller, query);
    return { alerts, hasMore, items: listed };
  });
}

function inboxOf({ hubs, storage }: InboxOn, caller: Identity): Fails<InboxResponse> {
  return Effect.gen(function* inboxWithAlerts() {
    const stored = yield* storage.listInbox(caller.name);
    const withReactions = yield* withReactionItems({ author: caller.name, items: stored, storage });
    const items = yield* withChannels(storage, withReactions);
    const alerts = yield* hubs.offlineAlerts.list(caller);
    return { alerts: unread(alerts), items };
  });
}

function inboxOn(on: InboxOn): InboxService {
  const { hubs, storage } = on;
  const { acked: hub, movedBack, offlineAlerts, subscriptions } = hubs;
  return {
    ...acksOn(on),
    acked: hub.subscribe,
    follow: following(storage.followThread, true),
    history: (caller, query) => historyOf(on, caller, query),
    inbox: (caller) => inboxOf(on, caller),
    itemFor: (caller, id) =>
      Effect.flatMap(storage.findInboxItem(caller.name, id), (stored) =>
        withChannels(storage, Arr.fromNullishOr(stored)),
      ),
    itemsAfter: (caller, id) =>
      Effect.flatMap(storage.listInboxAfter(caller.name, id), (stored) => withChannels(storage, stored)),
    markAlertRead: (caller, asked) => Effect.map(offlineAlerts.markRead(caller, asked), (alert) => ({ alert })),
    markUnread: (caller, id) =>
      Effect.gen(function* markUnread() {
        const moved = yield* storage.moveReadPositionBack(caller.name, id);
        const readPosition = yield* orMessageNotFound<MovedBackReadPosition>(String(id))(moved);
        yield* movedBack.publish({ identity: caller.name, readPosition });
        return { readPosition };
      }),
    movedBack: movedBack.subscribe,
    reactionItemFor: (caller, id) =>
      Effect.flatMap(reactionItemFor({ author: caller.name, id, storage }), (stored) => withChannels(storage, stored)),
    readPositions: (caller) =>
      Effect.map(storage.listReadPositions(caller.name), (readPositions) => ({ readPositions })),
    subscribe: subscription({ change: storage.subscribeChannel, hub: subscriptions, subscribed: true }),
    subscriptionChanged: subscriptions.subscribe,
    unfollow: following(storage.unfollowThread, false),
    unsubscribe: subscription({ change: storage.unsubscribeChannel, hub: subscriptions, subscribed: false }),
  };
}

function hubOf<Value>(): Effect.Effect<Hub<Value>> {
  return Effect.gen(function* openHub() {
    const pubSub = yield* PubSub.unbounded<Value>();
    return { publish: (value: Value) => PubSub.publish(pubSub, value), subscribe: PubSub.subscribe(pubSub) };
  });
}

const inboxLayer: Layer.Layer<Inbox, never, Storage | ReadReceipts | OfflineAlerts> = Layer.effect(
  Inbox,
  Effect.gen(function* inboxOnStorage() {
    const storage = yield* Storage;
    const readReceipts = yield* ReadReceipts;
    const offlineAlerts = yield* OfflineAlerts;
    const acked = yield* hubOf<Acked>();
    const movedBack = yield* hubOf<MovedBack>();
    const subscriptions = yield* hubOf<SubscriptionChanged>();
    return inboxOn({ hubs: { acked, movedBack, offlineAlerts, readReceipts, subscriptions }, storage });
  }),
);

export { Inbox, inboxLayer };
