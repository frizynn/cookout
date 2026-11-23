import type { Connected, StreamRequest } from "./source.ts";
import { Effect, Stream } from "effect";
import { Inbox, OfflineAlerts } from "../../../inbox/server.ts";
import { OfflineAlertEventSchema, SubscriptionEventSchema } from "./wire.ts";
import { Channels } from "../../../channels/server.ts";
import type { SubscriptionResponse } from "../../../inbox/index.ts";
import { sseEvent } from "./source.ts";

const subscriptionEvent = sseEvent(SubscriptionEventSchema);
const offlineAlertEvent = sseEvent(OfflineAlertEventSchema);

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

function offlineAlerts({ caller }: StreamRequest): Connected<OfflineAlerts> {
  return Effect.gen(function* subscribeToOfflineAlerts() {
    const alerts = yield* OfflineAlerts;
    const changed = yield* alerts.changed;
    return Stream.fromSubscription(changed).pipe(
      Stream.filter(({ owner }) => owner === caller.name),
      Stream.mapEffect(({ alert }) => offlineAlertEvent({ alert, type: "offline-alert" })),
    );
  });
}

export { offlineAlerts, subscriptions };
