import { ChannelView, ThreadView } from "../../views/index.tsx";
import type { Board } from "../../board/index.ts";
import type { Composer } from "../../composer/index.ts";
import type { ReactNode } from "react";
import type { Route } from "../../paths/index.ts";

interface ChannelPanesProps {
  readonly board: Board;
  readonly composer: Composer;
  readonly route: Extract<Route, { readonly name: "channel" | "thread" }>;
}

export function ChannelPanes(props: ChannelPanesProps): ReactNode {
  const { board, composer, route } = props;
  return (
    <>
      <ChannelView board={board} channel={route.channel} composer={composer} />
      {route.name === "thread" && (
        <ThreadView
          board={board}
          channel={route.channel}
          composer={composer}
          key={String(route.thread)}
          thread={route.thread}
        />
      )}
    </>
  );
}
