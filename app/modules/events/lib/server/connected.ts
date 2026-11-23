import { Effect, Schema, Stream } from "effect";
import type { Connected } from "./source.ts";
import { ConnectedEventSchema } from "./wire.ts";
import { Messages } from "../../../messages/server.ts";

const encodeConnected = Schema.encodeEffect(Schema.fromJsonString(ConnectedEventSchema));

function connected(): Connected<Messages> {
  return Effect.gen(function* readLatestOnRun() {
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
