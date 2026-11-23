import { ChannelEventSchema, MessageEventSchema, ReactionEventSchema, ReadReceiptEventSchema } from "./wire.ts";
import type { Connected, StreamRequest } from "./source.ts";
import { Effect, Record, Stream } from "effect";
import { Messages, Reactions, ReadReceipts } from "../../../messages/server.ts";
import { Channels } from "../../../channels/server.ts";
import { allChannelsQuery } from "../../index.ts";
import { sseEvent } from "./source.ts";

const PATH_BASE = "http://cookout.invalid";

const messageEvent = sseEvent(MessageEventSchema);
const channelEvent = sseEvent(ChannelEventSchema);
const readReceiptEvent = sseEvent(ReadReceiptEventSchema);
const reactionEvent = sseEvent(ReactionEventSchema);

type AllChannelsNeeds = Messages | Channels | ReadReceipts | Reactions;

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

function readReceipts(request: StreamRequest): Connected<ReadReceipts> {
  return Effect.gen(function* subscribeToReadReceipts() {
    if (!asksForAllChannels(request)) {
      return Stream.empty;
    }
    const service = yield* ReadReceipts;
    const recorded = yield* service.recorded;
    return Stream.fromSubscription(recorded).pipe(
      Stream.mapEffect((receipt) => readReceiptEvent({ receipt, type: "read-receipt" })),
    );
  });
}

function reactions(request: StreamRequest): Connected<Reactions> {
  return Effect.gen(function* subscribeToReactions() {
    if (!asksForAllChannels(request)) {
      return Stream.empty;
    }
    const service = yield* Reactions;
    const changed = yield* service.changed;
    return Stream.fromSubscription(changed).pipe(
      Stream.mapEffect((change) => reactionEvent({ ...change.reactions, type: "reaction" })),
    );
  });
}

export { type AllChannelsNeeds, allChannels, asksForAllChannels, channels, reactions, readReceipts };
