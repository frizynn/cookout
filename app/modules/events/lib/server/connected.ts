import type { Connected, StreamRequest } from "./source.ts";
import { ConnectedEventSchema, PresenceEventSchema } from "./wire.ts";
import { Effect, Schema, Stream } from "effect";
import { PresenceRegistry, holdLiveConnection } from "../../../presence/server.ts";
import { Messages } from "../../../messages/server.ts";
import type { Storage } from "../../../storage/server.ts";
import { asksForAllChannels } from "./all-channels.ts";
import { presenceName } from "../../../presence/index.ts";
import { sseEvent } from "./source.ts";

const encodeConnected = Schema.encodeEffect(Schema.fromJsonString(ConnectedEventSchema));
const presenceEvent = sseEvent(PresenceEventSchema);

type LiveConnectionNeeds = Messages | PresenceRegistry | Storage;

function connected({ authorization, caller }: StreamRequest): Connected<LiveConnectionNeeds> {
  return Effect.gen(function* readLatestOnRun() {
    yield* holdLiveConnection({ authorization, caller });
    const messages = yield* Messages;
    return Stream.fromEffect(
      Effect.gen(function* sayConnected() {
        const latest = yield* messages.latestId;
        const data = yield* Effect.orDie(encodeConnected({ latestMessageId: latest ?? null, type: "connected" }));
        return { data, event: "connected" } as const;
      }),
    );
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
