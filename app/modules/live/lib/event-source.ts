import type { CookoutEvent, ServerSentEvent } from "../../sdk/index.ts";
import { allChannelsQuery, eventsPath } from "../../events/index.ts";
import type { LiveAdapter } from "./adapter.ts";
import { urlOf } from "../../http/client.ts";

interface SentEvent {
  readonly type: string;
  readonly data: unknown;
}

const eventTypes = {
  "agent-session": true,
  channel: true,
  "channel-deleted": true,
  command: true,
  identity: true,
  "inbox-item": true,
  message: true,
  "read-position": true,
  "read-position-moved-back": true,
  subscription: true,
} as const satisfies Readonly<Record<CookoutEvent["type"], true>>;

function eventSourceAdapter(baseUrl: string): LiveAdapter {
  return {
    open: (onEvent, onLink) => {
      const source = new EventSource(urlOf({ baseUrl, path: eventsPath, query: allChannelsQuery }));
      function heard({ data, type }: SentEvent): void {
        if (typeof data === "string") {
          const sent: ServerSentEvent = { data, event: type };
          onEvent(sent);
        }
      }
      for (const type of Object.keys(eventTypes)) {
        source.addEventListener(type, heard);
      }
      source.addEventListener("error", () => {
        onLink("down");
      });
      source.addEventListener("open", () => {
        onLink("up");
      });
    },
  };
}

export { eventSourceAdapter };
