import type { ChannelName, CookoutClient, CookoutEvent, SubscriptionResponse } from "../../sdk/index.ts";
import type { Failure } from "./failure.ts";
import type { Live } from "../../live/index.ts";
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
  readonly current: () => SubscriptionsState;
  readonly publish: (next: SubscriptionsState) => void;
}

interface LiveSubscriptions {
  readonly subscriptions: Subscriptions;
  readonly heard: (change: SubscriptionResponse) => void;
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

async function heardAfter(
  previous: Promise<readonly ChannelName[]>,
  store: Store,
  { channel, subscribed }: SubscriptionResponse,
): Promise<readonly ChannelName[]> {
  const channels = await previous;
  const current = store.current();
  if (current.status !== "loaded") {
    return channels;
  }
  const next = withChannel(channels, channel, subscribed);
  store.publish({ ...current, channels: next });
  return next;
}

interface SubscriptionsOptions {
  readonly client: SubscriptionsClient;
  readonly live: Live | null;
}

function createSubscriptions({ client, live }: SubscriptionsOptions): LiveSubscriptions {
  const listeners = new Set<() => void>();
  let state: SubscriptionsState = { status: "loading" };
  let queue: Promise<readonly ChannelName[]> = Promise.resolve([]);
  let loading = false;
  const store: Store = {
    client,
    current: () => state,
    publish: (next) => {
      state = next;
      for (const listener of listeners) {
        listener();
      }
    },
  };
  function heard(change: SubscriptionResponse): void {
    queue = heardAfter(queue, store, change);
  }
  function receive(event: CookoutEvent): void {
    if (event.type === "subscription") {
      heard(event.subscription);
    }
  }
  const subscriptions: Subscriptions = {
    setSubscribed: (channel, wanted) => {
      queue = changeAfter(queue, store, { channel, wanted });
    },
    snapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      if (!loading) {
        loading = true;
        queue = load(store);
        if (live !== null) {
          live.subscribe(receive);
        }
      }
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return { heard, subscriptions };
}

export { type Subscriptions, type SubscriptionsClient, type SubscriptionsState, createSubscriptions };
