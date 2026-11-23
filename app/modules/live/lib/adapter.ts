import type { ServerSentEvent } from "../../sdk/index.ts";

interface LiveAdapter {
  readonly open: (onEvent: (event: ServerSentEvent) => void) => void;
}

export type { LiveAdapter };
