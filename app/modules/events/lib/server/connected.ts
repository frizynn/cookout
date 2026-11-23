import type { Connected, StreamRequest } from "./source.ts";
import { ConnectedEventSchema, PresenceEventSchema } from "./wire.ts";
import { Effect, Schema, Stream } from "effect";
import { PresenceRegistry, holdLiveConnection, watchReplacedRefusal } from "../../../presence/server.ts";
import { refusalSseEvent, sseEvent } from "./source.ts";
import { Messages } from "../../../messages/server.ts";
import type { Storage } from "../../../storage/server.ts";
import { asksForAllChannels } from "./all-channels.ts";
import { presenceName } from "../../../presence/index.ts";

const encodeConnected = Schema.encodeEffect(Schema.fromJsonString(ConnectedEventSchema));
const presenceEvent = sseEvent(PresenceEventSchema);

type LiveConnectionNeeds = Messages | PresenceRegistry | Storage;

function connected({ authorization, caller }: StreamRequest): Connected<LiveConnectionNeeds> {
  return Effect.gen(function* readLatestOnRun() {
    const held = yield* holdLiveConnection({ authorization, caller });
    const messages = yield* Messages;
    const endedByReplacement = Stream.fromEffect(Effect.andThen(held.replaced, refusalSseEvent(watchReplacedRefusal)));
    const sayingConnected = Stream.fromEffect(
      Effect.gen(function* sayConnected() {
        const latest = yield* messages.latestId;
        const data = yield* Effect.orDie(encodeConnected({ latestMessageId: latest ?? null, type: "connected" }));
        return { data, event: "connected" } as const;
      }),
    );
    return Stream.concat(sayingConnected, endedByReplacement);
  });
}

function presence(request: StreamRequest): Connected<PresenceRegistry> {
  return Effect.gen(function* subscribeToPresence() {
    if (!asksForAllChannels(request)) {
      return Stream.empty;
    }
    const registry = yield* PresenceRegistry;
    const changed = yield* registry.changed;
    return Stream.fromSubscription(changed).pipe(
      Stream.mapEffect((changedPresence) => presenceEvent({ presence: changedPresence, type: presenceName })),
    );
  });
}

export { type LiveConnectionNeeds, connected, presence };
