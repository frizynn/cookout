import type { Connected, StreamRequest } from "./source.ts";
import { Effect, Schema, Stream } from "effect";
import { DisplayNames } from "../../../identities/server.ts";
import type { Identity } from "../../../identities/index.ts";
import type { IdentityEvent } from "../../index.ts";
import { IdentityEventSchema } from "./wire.ts";
import { asksForAllChannels } from "./all-channels.ts";

const encodeIdentityEvent = Schema.encodeEffect(Schema.fromJsonString(IdentityEventSchema));

function identityEvent(
  identity: Identity,
): Effect.Effect<{ readonly data: string; readonly event: IdentityEvent["type"] }> {
  return Effect.map(Effect.orDie(encodeIdentityEvent({ identity, type: "identity" })), (data) => ({
    data,
    event: "identity" as const,
  }));
}

function identities(request: StreamRequest): Connected<DisplayNames> {
  return Effect.gen(function* subscribeToIdentities() {
    if (!asksForAllChannels(request)) {
      return Stream.empty;
    }
    const displayNames = yield* DisplayNames;
    const changed = yield* displayNames.changed;
    return Stream.fromSubscription(changed).pipe(Stream.mapEffect(identityEvent));
  });
}

export { identities };
