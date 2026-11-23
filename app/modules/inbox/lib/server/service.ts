import type {
  AckResponse,
  FollowResponse,
  InboxItem,
  InboxResponse,
  ReadPosition,
  SubscriptionResponse,
} from "../../index.ts";
import { Array as Arr, Context, Effect, Layer, Option, Predicate } from "effect";
import type { Channel, ChannelName } from "../../../channels/index.ts";
import type { Identity, IdentityName } from "../../../identities/index.ts";
import type { MessageId } from "../../../messages/index.ts";
import type { Refusal } from "../../../http/index.ts";
import { Storage } from "../../../storage/server.ts";
import type { StorageUnavailable } from "../../../storage/server.ts";
import { channelNotFound } from "../../../channels/server.ts";
import { isChannelName } from "../../../channels/index.ts";
import { isMessageId } from "../../../messages/index.ts";
import { messageNotFound } from "../../../messages/server.ts";

type Fails<Value> = Effect.Effect<Value, Refusal | StorageUnavailable>;

type StoredItem = Omit<InboxItem, "channel">;

type FollowChange = (identity: IdentityName, id: MessageId) => Effect.Effect<MessageId | undefined, StorageUnavailable>;

type SubscriptionChange = (identity: IdentityName, channel: ChannelName) => Effect.Effect<boolean, StorageUnavailable>;

interface InboxService {
  readonly inbox: (caller: Identity) => Fails<InboxResponse>;
  readonly itemFor: (caller: Identity, id: MessageId) => Fails<readonly InboxItem[]>;
  readonly itemsAfter: (caller: Identity, id: MessageId) => Fails<readonly InboxItem[]>;
  readonly ack: (caller: Identity, id: MessageId) => Fails<AckResponse>;
  readonly follow: (caller: Identity, asked: string) => Fails<FollowResponse>;
  readonly unfollow: (caller: Identity, asked: string) => Fails<FollowResponse>;
  readonly subscribe: (caller: Identity, channel: string) => Fails<SubscriptionResponse>;
  readonly unsubscribe: (caller: Identity, channel: string) => Fails<SubscriptionResponse>;
}

class Inbox extends Context.Service<Inbox, InboxService>()("@ai-hero/cookout/inbox/lib/server/service/Inbox") {}

function withChannel(channels: readonly Channel[], item: StoredItem): readonly InboxItem[] {
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

function withChannels(storage: Storage["Service"], items: readonly StoredItem[]): Fails<readonly InboxItem[]> {
  return Effect.map(storage.listChannels(), (channels) => Arr.flatMap(items, (item) => withChannel(channels, item)));
}

function inboxOf(storage: Storage["Service"], caller: Identity): Fails<InboxResponse> {
  return storage.listInbox(caller.name).pipe(
    Effect.flatMap((stored) => withChannels(storage, stored)),
    Effect.map((items) => ({ items })),
  );
}

function inboxOn(storage: Storage["Service"]): InboxService {
  return {
    ack: (caller, id) =>
      Effect.gen(function* ackMessage() {
        const acked = yield* storage.ackMessage(caller.name, id);
        const readPosition = yield* orMessageNotFound<ReadPosition>(String(id))(acked);
        return { readPosition };
      }),
    follow: following(storage.followThread, true),
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

const inboxLayer: Layer.Layer<Inbox, never, Storage> = Layer.effect(Inbox, Effect.map(Storage, inboxOn));

export { Inbox, inboxLayer };
