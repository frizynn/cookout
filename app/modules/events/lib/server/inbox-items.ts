import { Array as Arr, Effect, Option, Stream } from "effect";
import type { Connected, StreamRequest } from "./source.ts";
import { Inbox } from "../../../inbox/server.ts";
import { InboxItemEventSchema } from "./wire.ts";
import type { MessageId } from "../../../messages/index.ts";
import { Messages } from "../../../messages/server.ts";
import { sseEvent } from "./source.ts";

const inboxItemEvent = sseEvent(InboxItemEventSchema);

function inboxItems({ caller, lastEventId }: StreamRequest): Connected<Inbox | Messages> {
  return Effect.gen(function* subscribeToInboxItems() {
    const messages = yield* Messages;
    const inbox = yield* Inbox;
    const posted = yield* messages.posted;
    const live = Stream.fromSubscription(posted).pipe(
      Stream.mapEffect(({ id }) => inbox.itemFor(caller, id)),
      Stream.flattenIterable,
    );
    function missedThenLive(after: MessageId): typeof live {
      return Stream.unwrap(
        Effect.map(inbox.itemsAfter(caller, after), (missed) => {
          const seen = Option.match(Arr.last(missed), { onNone: () => after, onSome: (item) => item.message.id });
          return Stream.concat(
            Stream.fromIterable(missed),
            Stream.filter(live, (item) => item.message.id > seen),
          );
        }),
      );
    }
    const items = Option.match(lastEventId, { onNone: () => live, onSome: missedThenLive });
    return Stream.mapEffect(items, (item) =>
      Effect.map(inboxItemEvent({ item, type: "inbox-item" }), (event) => ({ ...event, id: item.message.id })),
    );
  });
}

export { inboxItems };
