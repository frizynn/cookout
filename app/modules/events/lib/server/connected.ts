import type { Connected, StreamRequest } from "./source.ts";
import { Effect, Schema, Stream } from "effect";
import { ConnectedEventSchema } from "./wire.ts";
import { Messages } from "../../../messages/server.ts";
import type { PresenceRegistry } from "../../../presence/server.ts";
import type { Storage } from "../../../storage/server.ts";
import { holdLiveConnection } from "../../../presence/server.ts";

const encodeConnected = Schema.encodeEffect(Schema.fromJsonString(ConnectedEventSchema));

function connected({ authorization, caller }: StreamRequest): Connected<Messages | PresenceRegistry | Storage> {
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

export { connected };
