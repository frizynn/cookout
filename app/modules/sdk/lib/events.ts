import { CookoutError, isServerErrorCode } from "./errors.ts";
import { allChannelsQuery, eventsPath, refusalEvent } from "../../events/index.ts";
import { isErrorResponse, isInboxItemEvent, isMessageEvent, isReadPositionEvent } from "./generated/validators.js";
import type { ClientConnection } from "./request.ts";
import type { CookoutEvent } from "../../events/index.ts";
import type { HeldLease } from "./held-lease.ts";
import type { ServerSentEvent } from "../../http/client.ts";
import { leaseLost } from "../../leases/index.ts";
import { openEvents } from "./request.ts";

type EventType = CookoutEvent["type"];

interface EventStream extends AsyncIterable<CookoutEvent> {
  readonly close: () => Promise<void>;
}

interface WatchOptions {
  readonly allChannels?: boolean;
}

interface EventCalls {
  readonly watch: (options?: WatchOptions) => Promise<EventStream>;
}

const OK = 200;

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

function refused(lease: HeldLease, data: string): CookoutError {
  const json = parsedData(data);
  if (!isErrorResponse(json) || !isServerErrorCode(json.error.code)) {
    return badEvent(refusalEvent, json);
  }
  if (json.error.code === leaseLost) {
    lease.drop();
  }
  return new CookoutError({ ...json.error, code: json.error.code, status: OK });
}

async function* cookoutEvents(
  events: AsyncIterable<ServerSentEvent>,
  lease: HeldLease,
): AsyncGenerator<CookoutEvent, void, undefined> {
  for await (const event of events) {
    if (event.event === refusalEvent) {
      throw refused(lease, event.data);
    }
    if (isEventType(event.event)) {
      yield checked({ ...event, event: event.event });
    }
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
    watch: async ({ allChannels = false } = {}) => {
      const query = queryFor(allChannels);
      const { close, events } = await openEvents({ connection: server, path: eventsPath, query });
      return { [Symbol.asyncIterator]: () => cookoutEvents(events, server.lease), close };
    },
  };
}

export { type EventStream, type WatchOptions, eventCalls };
