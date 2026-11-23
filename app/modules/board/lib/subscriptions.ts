import type { ChannelName, CookoutClient, SubscriptionResponse } from "../../sdk/index.ts";
import type { Failure } from "./failure.ts";
import { failure } from "./failure.ts";

type ChangeState =
  | { readonly status: "idle" }
  | { readonly status: "changing"; readonly channel: ChannelName }
  | (Failure & { readonly channel: ChannelName });

type SubscriptionsState =
  | { readonly status: "loading" }
  | { readonly status: "loaded"; readonly channels: readonly ChannelName[]; readonly change: ChangeState }
  | Failure;

interface Subscriptions {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => SubscriptionsState;
  readonly setSubscribed: (channel: ChannelName, subscribed: boolean) => void;
}

type SubscriptionsClient = Pick<CookoutClient, "listSubscribedChannels" | "subscribe" | "unsubscribe">;

interface Store {
  readonly client: SubscriptionsClient;
  readonly publish: (next: SubscriptionsState) => void;
}

interface Change {
  readonly channel: ChannelName;
  readonly wanted: boolean;
}

function withChannel(channels: readonly ChannelName[], channel: ChannelName, subscribed: boolean): ChannelName[] {
  const others = channels.filter((each) => each !== channel);
  if (subscribed) {
    return [...others, channel].toSorted();
  }
  return others;
}

async function send(client: SubscriptionsClient, { channel, wanted }: Change): Promise<SubscriptionResponse> {
  if (wanted) {
    const subscribed = await client.subscribe(channel);
    return subscribed;
  }
  const unsubscribed = await client.unsubscribe(channel);
  return unsubscribed;
}

async function load(store: Store): Promise<readonly ChannelName[]> {
  try {
    const { channels } = await store.client.listSubscribedChannels();
    const names = channels.map((channel) => channel.name);
    store.publish({ change: { status: "idle" }, channels: names, status: "loaded" });
    return names;
  } catch (error: unknown) {
    store.publish(failure(error));
    return [];
  }
}

async function changeAfter(
  previous: Promise<readonly ChannelName[]>,
  store: Store,
  change: Change,
): Promise<readonly ChannelName[]> {
  const channels = await previous;
  const { channel } = change;
  store.publish({ change: { channel, status: "changing" }, channels, status: "loaded" });
  try {
    const answer = await send(store.client, change);
    const next = withChannel(channels, channel, answer.subscribed);
    store.publish({ change: { status: "idle" }, channels: next, status: "loaded" });
    return next;
  } catch (error: unknown) {
    store.publish({ change: { ...failure(error), channel }, channels, status: "loaded" });
    return channels;
  }
}

function createSubscriptions(client: SubscriptionsClient): Subscriptions {
  const listeners = new Set<() => void>();
  let state: SubscriptionsState = { status: "loading" };
  let queue: Promise<readonly ChannelName[]> = Promise.resolve([]);
  let loading = false;
  const store: Store = {
    client,
    publish: (next) => {
      state = next;
      for (const listener of listeners) {
        listener();
      }
    },
  };
  return {
    setSubscribed: (channel, wanted) => {
      queue = changeAfter(queue, store, { channel, wanted });
    },
    snapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      if (!loading) {
        loading = true;
        queue = load(store);
      }
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export { type Subscriptions, type SubscriptionsClient, type SubscriptionsState, createSubscriptions };
