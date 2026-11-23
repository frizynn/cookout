import type { Live } from "../../live/index.ts";
import { createLive } from "../../live/index.ts";

type Link = ReturnType<Live["link"]>;

export interface Cuttable {
  readonly live: Live;
  readonly report: (link: Link) => void;
}

export function cuttable(): Cuttable {
  const reports: ((link: Link) => void)[] = [];
  const live = createLive({
    open: (_onEvent, onLink) => {
      reports.push(onLink);
    },
  });
  return {
    live,
    report: (link) => {
      for (const onLink of reports) {
        onLink(link);
      }
    },
  };
}
