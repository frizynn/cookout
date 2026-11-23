import type { Connected, StreamRequest } from "./source.ts";
import { Effect, Stream } from "effect";
import { Inbox } from "../../../inbox/server.ts";
import { InboxItemEventSchema } from "./wire.ts";
import { Messages } from "../../../messages/server.ts";
import { sseEvent } from "./source.ts";

const inboxItemEvent = sseEvent(InboxItemEventSchema);

function inboxItems({ caller }: StreamRequest): Connected<Inbox | Messages> {
  return Effect.gen(function* subscribeToInboxItems() {
    const messages = yield* Messages;
    const inbox = yield* Inbox;
    const posted = yield* messages.posted;
    return Stream.fromSubscription(posted).pipe(
      Stream.mapEffect(({ id }) => inbox.itemFor(caller, id)),
      Stream.flattenIterable,
      Stream.mapEffect((item) => inboxItemEvent({ item, type: "inbox-item" }, item.message.id)),
    );
  });
}

export { inboxItems };
