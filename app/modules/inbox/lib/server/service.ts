import type {
  AckAllResponse,
  AckResponse,
  FollowResponse,
  InboxHistoryItem,
  InboxHistoryResponse,
  InboxItem,
  InboxResponse,
  MarkUnreadResponse,
  MovedBackReadPosition,
  ReadPositionsResponse,
  SubscriptionResponse,
} from "../../index.ts";
import type { Acked, Fails, Hub } from "./acks.ts";
import { Array as Arr, Context, Effect, Layer, Option, Predicate, PubSub } from "effect";
import type { Channel, ChannelName } from "../../../channels/index.ts";
import type { Identity, IdentityName } from "../../../identities/index.ts";
import { ReadReceipts, messageNotFound } from "../../../messages/server.ts";
import { acksOn, orMessageNotFound } from "./acks.ts";
import { isMessageId, pageSize } from "../../../messages/index.ts";
import { itemsWithReactions, reactionItemFor, withReactionItems } from "./reaction-items.ts";
import type { MessageId } from "../../../messages/index.ts";
import type { Scope } from "effect";
import { Storage } from "../../../storage/server.ts";
import type { StorageUnavailable } from "../../../storage/server.ts";
import { channelNotFound } from "../../../channels/server.ts";
import { isChannelName } from "../../../channels/index.ts";

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

type SubscriptionChange = (identity: IdentityName, channel: ChannelName) => Effect.Effect<boolean, StorageUnavailable>;

interface MovedBack {
  readonly identity: IdentityName;
  readonly readPosition: MovedBackReadPosition;
}

interface SubscriptionChanged {
  readonly identity: IdentityName;
  readonly subscription: SubscriptionResponse;
}

interface Hubs {
  readonly acked: Hub<Acked>;
  readonly readReceipts: ReadReceipts["Service"];
  readonly movedBack: Hub<MovedBack>;
  readonly subscriptions: Hub<SubscriptionChanged>;
}

interface InboxService {
  readonly inbox: (caller: Identity) => Fails<InboxResponse>;
  readonly history: (caller: Identity, query: HistoryQuery) => Fails<InboxHistoryResponse>;
  readonly itemFor: (caller: Identity, id: MessageId) => Fails<readonly InboxItem[]>;
  readonly itemsAfter: (caller: Identity, id: MessageId) => Fails<readonly InboxItem[]>;
  readonly reactionItemFor: (caller: Identity, id: MessageId) => Fails<readonly InboxItem[]>;
  readonly ack: (caller: Identity, id: MessageId) => Fails<AckResponse>;
  readonly ackAll: (caller: Identity, upTo: MessageId) => Fails<AckAllResponse>;
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

function subscription(change: SubscriptionChange, subscribed: boolean, hub: Hub<SubscriptionChanged>) {
  return (caller: Identity, channel: string): Fails<SubscriptionResponse> =>
    Effect.gen(function* changeSubscription() {
      if (!isChannelName(channel)) {
        return yield* Effect.fail(channelNotFound(channel));
      }
      const exists = yield* change(caller.name, channel);
      if (!exists) {
        return yield* Effect.fail(channelNotFound(channel));
      }
      const answer = { channel, subscribed };
      yield* hub.publish({ identity: caller.name, subscription: answer });
      return answer;
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

function historyOf(storage: Storage["Service"], caller: Identity, query: HistoryQuery): Fails<InboxHistoryResponse> {
  return Effect.flatMap(storage.listInboxHistory(caller.name, historyPage(query)), ({ hasMore, items }) =>
    Effect.map(withChannels<StoredHistoryItem>(storage, items), (listed) => ({ hasMore, items: listed })),
  );
}

function inboxOf(storage: Storage["Service"], caller: Identity): Fails<InboxResponse> {
  return storage.listInbox(caller.name).pipe(
    Effect.flatMap((items) => withReactionItems({ author: caller.name, items, storage })),
    Effect.flatMap((stored) => withChannels(storage, stored)),
    Effect.map((items) => ({ items })),
  );
}

function inboxOn(storage: Storage["Service"], hubs: Hubs): InboxService {
  const { acked: hub, movedBack, subscriptions } = hubs;
  return {
    ...acksOn({ hubs, storage }),
    acked: hub.subscribe,
    follow: following(storage.followThread, true),
    history: (caller, query) => historyOf(storage, caller, query),
    inbox: (caller) => inboxOf(storage, caller),
    itemFor: (caller, id) =>
      Effect.flatMap(storage.findInboxItem(caller.name, id), (stored) =>
        withChannels(storage, Arr.fromNullishOr(stored)),
      ),
    itemsAfter: (caller, id) =>
      Effect.flatMap(storage.listInboxAfter(caller.name, id), (stored) => withChannels(storage, stored)),
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
    subscribe: subscription(storage.subscribeChannel, true, subscriptions),
    subscriptionChanged: subscriptions.subscribe,
    unfollow: following(storage.unfollowThread, false),
    unsubscribe: subscription(storage.unsubscribeChannel, false, subscriptions),
  };
}

function hubOf<Value>(): Effect.Effect<Hub<Value>> {
  return Effect.gen(function* openHub() {
    const pubSub = yield* PubSub.unbounded<Value>();
    return { publish: (value: Value) => PubSub.publish(pubSub, value), subscribe: PubSub.subscribe(pubSub) };
  });
}

const inboxLayer: Layer.Layer<Inbox, never, Storage | ReadReceipts> = Layer.effect(
  Inbox,
  Effect.gen(function* inboxOnStorage() {
    const storage = yield* Storage;
    const readReceipts = yield* ReadReceipts;
    const acked = yield* hubOf<Acked>();
    const movedBack = yield* hubOf<MovedBack>();
    const subscriptions = yield* hubOf<SubscriptionChanged>();
    return inboxOn(storage, { acked, movedBack, readReceipts, subscriptions });
  }),
);

export { Inbox, inboxLayer };
