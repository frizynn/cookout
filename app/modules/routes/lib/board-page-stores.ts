import type { BoardStore, ChannelCreation, Scheduling } from "../../board/index.ts";
import { browserClock, browserTimeZone } from "../../format/index.ts";
import { createChannelCreation, createScheduling } from "../../board/index.ts";

const PREVIEW_PAUSE_MS = 200;

interface BoardPageStores {
  readonly channelCreation: ChannelCreation;
  readonly scheduling: Scheduling;
}

function boardPageStores(store: BoardStore): BoardPageStores {
  return {
    channelCreation: createChannelCreation({ createChannel: store.calls.createChannel }),
    scheduling: createScheduling({
      clock: browserClock,
      create: store.calls.createScheduledMessage,
      pause: PREVIEW_PAUSE_MS,
      preview: store.calls.previewScheduledMessage,
      timeZone: browserTimeZone(),
    }),
  };
}

export { type BoardPageStores, boardPageStores };
