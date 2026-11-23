import type { CookoutClient, EventStream, ServerSentEvent } from "../../sdk/index.ts";
import type { LiveAdapter } from "./adapter.ts";

async function forward(opening: Promise<EventStream>, onEvent: (event: ServerSentEvent) => void): Promise<boolean> {
  try {
    const events = await opening;
    for await (const event of events) {
      onEvent({ data: JSON.stringify(event), event: event.type });
    }
    return true;
  } catch {
    return false;
  }
}

async function closeAfter(previous: Promise<boolean>, opening: Promise<EventStream>): Promise<boolean> {
  try {
    const events = await opening;
    await events.close();
  } catch {
    return false;
  }
  return previous;
}

function watchAdapter(client: Pick<CookoutClient, "watch">): LiveAdapter {
  return {
    open: (onEvent) => {
      const opening = client.watch({ allChannels: true });
      let running = forward(opening, onEvent);
      return () => {
        running = closeAfter(running, opening);
      };
    },
  };
}

export { watchAdapter };
