import type { ClientConnection } from "./request.ts";
import { CookoutError } from "./errors.ts";
import type { CookoutEvent } from "../../events/index.ts";
import type { ServerSentEvent } from "../../http/client.ts";
import { eventsPath } from "../../events/index.ts";
import { isInboxItemEvent } from "./generated/validators.js";
import { openEvents } from "./request.ts";

type EventType = CookoutEvent["type"];

interface EventStream extends AsyncIterable<CookoutEvent> {
  readonly close: () => Promise<void>;
}

interface EventCalls {
  readonly watch: () => Promise<EventStream>;
}

const OK = 200;

const validators: { readonly [Type in EventType]: (data: unknown) => data is Extract<CookoutEvent, { type: Type }> } = {
  "inbox-item": isInboxItemEvent,
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

async function* cookoutEvents(events: AsyncIterable<ServerSentEvent>): AsyncGenerator<CookoutEvent, void, undefined> {
  for await (const event of events) {
    if (isEventType(event.event)) {
      yield checked({ ...event, event: event.event });
    }
  }
}

function eventCalls(server: ClientConnection): EventCalls {
  return {
    watch: async () => {
      const { close, events } = await openEvents({ connection: server, path: eventsPath });
      return { [Symbol.asyncIterator]: () => cookoutEvents(events), close };
    },
  };
}

export { type EventStream, eventCalls };
