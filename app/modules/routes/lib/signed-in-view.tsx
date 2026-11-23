import { ChannelListView, ChannelView, NotBuiltView, ThreadView } from "../../views/index.tsx";
import type { Board } from "../../board/index.ts";
import type { Composer } from "../../composer/index.ts";
import type { ReactNode } from "react";
import type { Route } from "./route.ts";

interface SignedInViewProps {
  readonly board: Board;
  readonly composer: Composer;
  readonly route: Exclude<Route, { readonly name: "login" }>;
}

export function SignedInView(props: SignedInViewProps): ReactNode {
  const { board, composer, route } = props;
  if (route.name === "channels") {
    return <ChannelListView board={board} />;
  }
  if (route.name === "channel") {
    return <ChannelView board={board} channel={route.channel} key={route.channel} />;
  }
  if (route.name === "thread") {
    return (
      <ThreadView board={board} channel={route.channel} composer={composer} key={route.thread} thread={route.thread} />
    );
  }
  return <NotBuiltView description="No page has this address." title="Nothing here" />;
}
