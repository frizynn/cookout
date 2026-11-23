import { ChannelEventSchema, MessageEventSchema, PresenceEventSchema } from "./wire.ts";
import type { Connected, StreamRequest } from "./source.ts";
import { Effect, Record, Stream } from "effect";
import { Channels } from "../../../channels/server.ts";
import { Messages } from "../../../messages/server.ts";
import { PresenceRegistry } from "../../../presence/server.ts";
import type { Storage } from "../../../storage/server.ts";
import { allChannelsQuery } from "../../index.ts";
import { presenceName } from "../../../presence/index.ts";
import { sseEvent } from "./source.ts";

const PATH_BASE = "http://cookout.invalid";

const messageEvent = sseEvent(MessageEventSchema);
const channelEvent = sseEvent(ChannelEventSchema);
const presenceEvent = sseEvent(PresenceEventSchema);

type AllChannelsNeeds = Messages | Channels | PresenceRegistry | Storage;

function asksForAllChannels({ url }: StreamRequest): boolean {
  const search = new URL(url, PATH_BASE).searchParams;
  return Record.every(allChannelsQuery, (value, name) => search.get(name) === value);
}

function allChannels(request: StreamRequest): Connected<Messages> {
  return Effect.gen(function* subscribeToAllChannels() {
    if (!asksForAllChannels(request)) {
      return Stream.empty;
    }
    const messages = yield* Messages;
    const posted = yield* messages.posted;
    return Stream.fromSubscription(posted).pipe(
      Stream.mapEffect((message) => messageEvent({ message, type: "message" })),
    );
  });
}

function channels(request: StreamRequest): Connected<Channels> {
  return Effect.gen(function* subscribeToChannels() {
    if (!asksForAllChannels(request)) {
      return Stream.empty;
    }
    const service = yield* Channels;
    const created = yield* service.created;
    return Stream.fromSubscription(created).pipe(
      Stream.mapEffect(({ channel }) => channelEvent({ channel, type: "channel" })),
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

export { type AllChannelsNeeds, allChannels, asksForAllChannels, channels, presence };
