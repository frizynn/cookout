import type { CookoutClient, EventStream } from "../../sdk/index.ts";
import type { Live } from "../../live/index.ts";
import { createLive } from "../../live/index.ts";
import { watchAdapter } from "../../testing/web.ts";

interface Watched {
  readonly live: Live;
  readonly stream: Promise<EventStream>;
}

export function watched(client: CookoutClient): Watched {
  const { promise, resolve } = Promise.withResolvers<EventStream>();
  const live = createLive(
    watchAdapter({
      watch: async (options) => {
        const stream = await client.watch(options);
        resolve(stream);
        return stream;
      },
    }),
  );
  return { live, stream: promise };
}
