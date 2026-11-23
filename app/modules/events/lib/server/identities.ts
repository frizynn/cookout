import type { Connected, StreamRequest } from "./source.ts";
import { Effect, Schema, Stream } from "effect";
import { IdentityDeletedEventSchema, IdentityEventSchema } from "./wire.ts";
import type { Identity } from "../../../identities/index.ts";
import { IdentityChanges } from "../../../identities/server.ts";
import type { IdentityEvent } from "../../index.ts";
import { asksForAllChannels } from "./all-channels.ts";
import { sseEvent } from "./source.ts";

const identityDeletedEvent = sseEvent(IdentityDeletedEventSchema);

const encodeIdentityEvent = Schema.encodeEffect(Schema.fromJsonString(IdentityEventSchema));

function identityEvent(
  identity: Identity,
): Effect.Effect<{ readonly data: string; readonly event: IdentityEvent["type"] }> {
  return Effect.map(Effect.orDie(encodeIdentityEvent({ identity, type: "identity" })), (data) => ({
    data,
    event: "identity" as const,
  }));
}

function identities(request: StreamRequest): Connected<IdentityChanges> {
  return Effect.gen(function* subscribeToIdentities() {
    if (!asksForAllChannels(request)) {
      return Stream.empty;
    }
    const changes = yield* IdentityChanges;
    const changed = yield* changes.changed;
    return Stream.fromSubscription(changed).pipe(Stream.mapEffect(identityEvent));
  });
}

function identityDeletions(request: StreamRequest): Connected<IdentityChanges> {
  return Effect.gen(function* subscribeToIdentityDeletions() {
    if (!asksForAllChannels(request)) {
      return Stream.empty;
    }
    const changes = yield* IdentityChanges;
    const deleted = yield* changes.deleted;
    return Stream.fromSubscription(deleted).pipe(
      Stream.mapEffect((identity) => identityDeletedEvent({ identity, type: "identity-deleted" })),
    );
  });
}

export { identities, identityDeletions };
