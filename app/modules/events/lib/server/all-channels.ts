import type { Connected, StreamRequest } from "./source.ts";
import { Effect, Record, Stream } from "effect";
import { MessageEventSchema } from "./wire.ts";
import { Messages } from "../../../messages/server.ts";
import { allChannelsQuery } from "../../index.ts";
import { sseEvent } from "./source.ts";

const PATH_BASE = "http://cookout.invalid";

const messageEvent = sseEvent(MessageEventSchema);

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
      Stream.mapEffect((message) => messageEvent({ message, type: "message" }, message.id)),
    );
  });
}

export { allChannels, asksForAllChannels };
