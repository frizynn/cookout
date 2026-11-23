import { ChannelListView, ChannelView, InboxView, NotBuiltView, ThreadView } from "../../views/index.tsx";
import type { Board } from "../../board/index.ts";
import type { Composer } from "../../composer/index.ts";
import type { ReactNode } from "react";
import type { Route } from "../../paths/index.ts";
import type { Unread } from "../../unread/index.ts";

interface SignedInViewProps {
  readonly board: Board;
  readonly composer: Composer;
  readonly unread: Unread;
  readonly route: Exclude<Route, { readonly name: "login" }>;
}

export function SignedInView(props: SignedInViewProps): ReactNode {
  const { board, composer, route, unread } = props;
  if (route.name === "channels") {
    return <ChannelListView board={board} unread={unread} />;
  }
  if (route.name === "inbox") {
    return <InboxView unread={unread} />;
  }
  if (route.name === "channel") {
    return <ChannelView board={board} channel={route.channel} composer={composer} key={route.channel} />;
  }
  if (route.name === "thread") {
    return (
      <ThreadView board={board} channel={route.channel} composer={composer} key={route.thread} thread={route.thread} />
    );
  }
  return <NotBuiltView description="No page has this address." title="Nothing here" />;
}
