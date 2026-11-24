import type {
  Channel,
  ChannelName,
  CookoutClient,
  CookoutEvent,
  CreateChannelRequest,
  MessageId,
  SubscriptionResponse,
} from "../../sdk/index.ts";
import type { ClosingClient, ClosingRefusal } from "./thread-closing.ts";
import type { SubscriptionChange, SubscriptionsClient } from "./subscriptions-slice.ts";
import { createMessageAcks } from "./message-acks.ts";
import { createThreadClosing } from "./thread-closing.ts";
import { refusedAs } from "./subscriptions-slice.ts";

type CallsClient = ClosingClient & SubscriptionsClient & Pick<CookoutClient, "ack" | "createChannel">;

interface BoardCalls {
  readonly createChannel: (request: CreateChannelRequest) => Promise<Channel>;
  readonly setSubscribed: (channel: ChannelName, subscribed: boolean) => void;
  readonly close: (messageId: MessageId) => void;
  readonly reopen: (messageId: MessageId) => void;
  readonly closingRefusal: () => ClosingRefusal | null;
  readonly ack: (id: MessageId) => void;
}

interface CallsOptions {
  readonly client: CallsClient;
  readonly heard: (event: CookoutEvent) => void;
  readonly subscriptionChanged: (change: SubscriptionChange) => void;
  readonly changed: () => void;
}

async function send(client: SubscriptionsClient, channel: ChannelName, wanted: boolean): Promise<SubscriptionResponse> {
  if (wanted) {
    const subscribed = await client.subscribe(channel);
    return subscribed;
  }
  const unsubscribed = await client.unsubscribe(channel);
  return unsubscribed;
}

async function after(previous: Promise<void>, step: () => Promise<void>): Promise<void> {
  await previous;
  await step();
}

function subscribing(options: CallsOptions): BoardCalls["setSubscribed"] {
  let queue = Promise.resolve();
  const { client, subscriptionChanged } = options;
  return (channel, wanted) => {
    queue = after(queue, async () => {
      subscriptionChanged({ channel, type: "subscription-asked" });
      try {
        const { subscribed } = await send(client, channel, wanted);
        subscriptionChanged({ channel, subscribed, type: "subscription-answered" });
      } catch (error: unknown) {
        subscriptionChanged({ channel, refusal: refusedAs(error), type: "subscription-refused" });
      }
    });
  };
}

function createBoardCalls(options: CallsOptions): BoardCalls {
  const { client, heard } = options;
  const closing = createThreadClosing({
    changed: (parent) => {
      heard({ parent, type: "thread" });
    },
    client,
    refused: options.changed,
  });
  return {
    ack: createMessageAcks(client),
    close: closing.close,
    closingRefusal: closing.refusal,
    createChannel: async (request) => {
      const { channel } = await client.createChannel(request);
      heard({ channel, type: "channel" });
      heard({ subscription: { channel: channel.name, subscribed: true }, type: "subscription" });
      return channel;
    },
    reopen: closing.reopen,
    setSubscribed: subscribing(options),
  };
}

export { type BoardCalls, type CallsClient, createBoardCalls };
