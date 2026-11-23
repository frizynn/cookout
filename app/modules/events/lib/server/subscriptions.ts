import type { Connected, StreamRequest } from "./source.ts";
import { Effect, Stream } from "effect";
import { Channels } from "../../../channels/server.ts";
import { Inbox } from "../../../inbox/server.ts";
import { SubscriptionEventSchema } from "./wire.ts";
import type { SubscriptionResponse } from "../../../inbox/index.ts";
import { sseEvent } from "./source.ts";

const subscriptionEvent = sseEvent(SubscriptionEventSchema);

function subscriptions({ caller }: StreamRequest): Connected<Inbox | Channels> {
  return Effect.gen(function* subscribeToSubscriptions() {
    const inbox = yield* Inbox;
    const channels = yield* Channels;
    const changed = yield* inbox.subscriptionChanged;
    const created = yield* channels.created;
    const own: Stream.Stream<SubscriptionResponse> = Stream.fromSubscription(changed).pipe(
      Stream.filter(({ identity }) => identity === caller.name),
      Stream.map(({ subscription }) => subscription),
    );
    const createdByCaller: Stream.Stream<SubscriptionResponse> = Stream.fromSubscription(created).pipe(
      Stream.filter(({ creator }) => creator === caller.name),
      Stream.map(({ channel }) => ({ channel: channel.name, subscribed: true })),
    );
    return Stream.merge(own, createdByCaller).pipe(
      Stream.mapEffect((subscription) => subscriptionEvent({ subscription, type: "subscription" })),
    );
  });
}

export { subscriptions };
