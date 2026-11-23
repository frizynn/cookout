import type { CookoutClient, ServerSentEvent } from "../../sdk/index.ts";
import type { LiveAdapter } from "../../live/index.ts";

async function forward(client: Pick<CookoutClient, "watch">, onEvent: (event: ServerSentEvent) => void): Promise<void> {
  const events = await client.watch({ allChannels: true });
  for await (const event of events) {
    onEvent({ data: JSON.stringify(event), event: event.type });
  }
}

function watchAdapter(client: Pick<CookoutClient, "watch">): LiveAdapter {
  const streams: Promise<void>[] = [];
  return {
    open: (onEvent) => {
      streams.push(forward(client, onEvent));
    },
  };
}

export { watchAdapter };
