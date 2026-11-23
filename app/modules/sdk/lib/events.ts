import type { ServerSentEvent, ServerSentFrame } from "../../http/client.ts";
import { allChannelsQuery, eventsPath } from "../../events/index.ts";
import { isInboxItemEvent, isMessageEvent, isReadPositionEvent } from "./generated/validators.js";
import type { ClientConnection } from "./request.ts";
import { CookoutError } from "./errors.ts";
import type { CookoutEvent } from "../../events/index.ts";
import type { MessageId } from "../../messages/index.ts";
import { openEvents } from "./request.ts";

type EventType = CookoutEvent["type"];

interface EventStream extends AsyncIterable<CookoutEvent> {
  readonly close: () => Promise<void>;
}

interface WatchOptions {
  readonly allChannels?: boolean;
  readonly lastEventId?: MessageId;
  readonly onHeartbeat?: () => void;
}

interface EventCalls {
  readonly watch: (options?: WatchOptions) => Promise<EventStream>;
}

const OK = 200;
const HEARTBEAT = "heartbeat";
const NO_OPTIONS: WatchOptions = {};

function heard(comment: string, { onHeartbeat }: WatchOptions): void {
  if (comment === HEARTBEAT && typeof onHeartbeat === "function") {
    onHeartbeat();
  }
}

function resumeHeaders({ lastEventId }: WatchOptions): Readonly<Record<string, string>> {
  if (typeof lastEventId === "number") {
    return { "last-event-id": String(lastEventId) };
  }
  return {};
}

const validators: { readonly [Type in EventType]: (data: unknown) => data is Extract<CookoutEvent, { type: Type }> } = {
  "inbox-item": isInboxItemEvent,
  message: isMessageEvent,
  "read-position": isReadPositionEvent,
};

function isEventType(event: string): event is EventType {
  return Object.hasOwn(validators, event);
}

function parsedData(data: string): unknown {
  try {
    const json: unknown = JSON.parse(data);
    return json;
  } catch {
    return data;
  }
}

function badEvent(event: string, details: unknown): CookoutError {
  return new CookoutError({
    code: "bad_response",
    details,
    message: `GET ${eventsPath} sent a ${event} event that doesn't match the protocol.`,
    status: OK,
  });
}

function checked({ data, event }: ServerSentEvent & { readonly event: EventType }): CookoutEvent {
  const json = parsedData(data);
  if (!validators[event](json)) {
    throw badEvent(event, json);
  }
  return json;
}

function eventsIn(frame: ServerSentFrame, options: WatchOptions): readonly CookoutEvent[] {
  if ("comment" in frame) {
    heard(frame.comment, options);
    return [];
  }
  if (isEventType(frame.event)) {
    return [checked({ ...frame, event: frame.event })];
  }
  return [];
}

async function* cookoutEvents(
  frames: AsyncIterable<ServerSentFrame>,
  options: WatchOptions,
): AsyncGenerator<CookoutEvent, void, undefined> {
  for await (const frame of frames) {
    yield* eventsIn(frame, options);
  }
}

function queryFor(allChannels: boolean): Readonly<Record<string, string>> {
  if (allChannels) {
    return allChannelsQuery;
  }
  return {};
}

function eventCalls(server: ClientConnection): EventCalls {
  return {
    watch: async (options = NO_OPTIONS) => {
      const { close, events } = await openEvents({
        connection: server,
        headers: resumeHeaders(options),
        path: eventsPath,
        query: queryFor(options.allChannels ?? false),
      });
      return { [Symbol.asyncIterator]: () => cookoutEvents(events, options), close };
    },
  };
}

export { type EventStream, type WatchOptions, eventCalls };
