import { ChannelListView, ChannelView, NotBuiltView } from "../../views/index.tsx";
import type { Board } from "../../board/index.ts";
import type { ReactNode } from "react";
import type { Route } from "./route.ts";

interface SignedInViewProps {
  readonly board: Board;
  readonly route: Exclude<Route, { readonly name: "login" }>;
}

export function SignedInView(props: SignedInViewProps): ReactNode {
  const { board, route } = props;
  if (route.name === "channels") {
    return <ChannelListView board={board} />;
  }
  if (route.name === "channel") {
    return <ChannelView board={board} channel={route.channel} key={route.channel} />;
  }
  if (route.name === "thread") {
    return (
      <NotBuiltView
        description="This thread's replies aren't shown yet."
        title={`Thread ${route.thread} in #${route.channel}`}
      />
    );
  }
  return <NotBuiltView description="No page has this address." title="Nothing here" />;
}
