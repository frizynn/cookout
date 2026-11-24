import type {
  AckAllRequest,
  AckAllResponse,
  AckResponse,
  FollowResponse,
  InboxHistoryResponse,
  InboxItem,
  InboxResponse,
  MarkUnreadResponse,
  MovedBackReadPosition,
  NudgeResponse,
  OfflineAlertResponse,
  ReadPositionsResponse,
  SubscriptionResponse,
} from "../../index.ts";
import type { Acked, Fails, Hub } from "./acks.ts";
import { Context, Effect, Layer, PubSub } from "effect";
import type { Identity, IdentityName } from "../../../identities/index.ts";
import { ReadReceipts, messageNotFound } from "../../../messages/server.ts";
import { acksOn, orMessageNotFound } from "./acks.ts";
import type { MessageId } from "../../../messages/index.ts";
import { OfflineAlerts } from "./offline-alerts.ts";
import type { Scope } from "effect";
import { Storage } from "../../../storage/server.ts";
import type { StorageUnavailable } from "../../../storage/server.ts";
import type { SubscriptionChanged } from "./subscriptions.ts";
import { isMessageId } from "../../../messages/index.ts";
import { listingOn } from "./listing.ts";
import { subscription } from "./subscriptions.ts";

interface HistoryQuery {
  readonly before?: MessageId;
  readonly limit?: number;
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
  readonly markNudgeRead: (caller: Identity, asked: string) => Fails<NudgeResponse>;
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

interface InboxOn {
  readonly storage: Storage["Service"];
  readonly hubs: Hubs;
}

function inboxOn(on: InboxOn): InboxService {
  const { hubs, storage } = on;
  const { acked: hub, movedBack, offlineAlerts, subscriptions } = hubs;
  return {
    ...acksOn(on),
    ...listingOn({ offlineAlerts, storage }),
    acked: hub.subscribe,
    follow: following(storage.followThread, true),
    markAlertRead: (caller, asked) => Effect.map(offlineAlerts.markRead(caller, asked), (alert) => ({ alert })),
    markUnread: (caller, id) =>
      Effect.gen(function* markUnread() {
        const moved = yield* storage.moveReadPositionBack(caller.name, id);
        const readPosition = yield* orMessageNotFound<MovedBackReadPosition>(String(id))(moved);
        yield* movedBack.publish({ identity: caller.name, readPosition });
        return { readPosition };
      }),
    movedBack: movedBack.subscribe,
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
