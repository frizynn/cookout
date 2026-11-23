import type {
  AckResponse,
  FollowResponse,
  InboxHistoryItem,
  InboxHistoryResponse,
  InboxItem,
  InboxResponse,
  ReadPosition,
  SubscriptionResponse,
} from "../../index.ts";
import { Array as Arr, Context, Effect, Layer, Option, Predicate, PubSub } from "effect";
import type { Channel, ChannelName } from "../../../channels/index.ts";
import type { Identity, IdentityName } from "../../../identities/index.ts";
import { isMessageId, pageSize } from "../../../messages/index.ts";
import type { MessageId } from "../../../messages/index.ts";
import type { Refusal } from "../../../http/index.ts";
import type { Scope } from "effect";
import { Storage } from "../../../storage/server.ts";
import type { StorageUnavailable } from "../../../storage/server.ts";
import { channelNotFound } from "../../../channels/server.ts";
import { isChannelName } from "../../../channels/index.ts";
import { messageNotFound } from "../../../messages/server.ts";

type Fails<Value> = Effect.Effect<Value, Refusal | StorageUnavailable>;

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

interface Acked {
  readonly identity: IdentityName;
  readonly readPosition: ReadPosition;
}

interface AckHub {
  readonly publish: (acked: Acked) => Effect.Effect<boolean>;
  readonly subscribe: Effect.Effect<PubSub.Subscription<Acked>, never, Scope.Scope>;
}

interface InboxService {
  readonly inbox: (caller: Identity) => Fails<InboxResponse>;
  readonly history: (caller: Identity, query: HistoryQuery) => Fails<InboxHistoryResponse>;
  readonly itemFor: (caller: Identity, id: MessageId) => Fails<readonly InboxItem[]>;
  readonly itemsAfter: (caller: Identity, id: MessageId) => Fails<readonly InboxItem[]>;
  readonly ack: (caller: Identity, id: MessageId) => Fails<AckResponse>;
  readonly acked: Effect.Effect<PubSub.Subscription<Acked>, never, Scope.Scope>;
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

function orMessageNotFound<Value>(asked: string): (value: Value | undefined) => Fails<Value> {
  return (value) => {
    if (Predicate.isUndefined(value)) {
      return Effect.fail(messageNotFound(asked));
    }
    return Effect.succeed(value);
  };
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

function subscription(change: SubscriptionChange, subscribed: boolean) {
  return (caller: Identity, channel: string): Fails<SubscriptionResponse> =>
    Effect.gen(function* changeSubscription() {
      if (!isChannelName(channel)) {
        return yield* Effect.fail(channelNotFound(channel));
      }
      const exists = yield* change(caller.name, channel);
      if (!exists) {
        return yield* Effect.fail(channelNotFound(channel));
      }
      return { channel, subscribed };
    });
}

function withChannels<Item extends StoredItem>(
  storage: Storage["Service"],
  items: readonly Item[],
): Fails<readonly (Item & { readonly channel: Channel })[]> {
  return Effect.map(storage.listChannels(), (channels) => Arr.flatMap(items, (item) => withChannel(channels, item)));
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
    Effect.flatMap((stored) => withChannels(storage, stored)),
    Effect.map((items) => ({ items })),
  );
}

function inboxOn(storage: Storage["Service"], hub: AckHub): InboxService {
  return {
    ack: (caller, id) =>
      Effect.gen(function* ackMessage() {
        const acked = yield* storage.ackMessage(caller.name, id);
        const readPosition = yield* orMessageNotFound<ReadPosition>(String(id))(acked);
        yield* hub.publish({ identity: caller.name, readPosition });
        return { readPosition };
      }),
    acked: hub.subscribe,
    follow: following(storage.followThread, true),
    history: (caller, query) => historyOf(storage, caller, query),
    inbox: (caller) => inboxOf(storage, caller),
    itemFor: (caller, id) =>
      Effect.map(inboxOf(storage, caller), ({ items }) => Arr.filter(items, (item) => item.message.id === id)),
    itemsAfter: (caller, id) =>
      Effect.flatMap(storage.listInboxAfter(caller.name, id), (stored) => withChannels(storage, stored)),
    subscribe: subscription(storage.subscribeChannel, true),
    unfollow: following(storage.unfollowThread, false),
    unsubscribe: subscription(storage.unsubscribeChannel, false),
  };
}

const inboxLayer: Layer.Layer<Inbox, never, Storage> = Layer.effect(
  Inbox,
  Effect.gen(function* inboxOnStorage() {
    const storage = yield* Storage;
    const pubSub = yield* PubSub.unbounded<Acked>();
    const hub: AckHub = { publish: (acked) => PubSub.publish(pubSub, acked), subscribe: PubSub.subscribe(pubSub) };
    return inboxOn(storage, hub);
  }),
);

export { Inbox, inboxLayer };
