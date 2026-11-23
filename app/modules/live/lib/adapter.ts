import type { ServerSentEvent } from "../../sdk/index.ts";

type Link = "down" | "up";

interface LiveAdapter {
  readonly open: (onEvent: (event: ServerSentEvent) => void, onLink: (link: Link) => void) => void;
}

export type { Link, LiveAdapter };
