import { ChannelListView, NotBuiltView } from "../../views/index.tsx";
import type { Board } from "../../board/index.ts";
import type { ReactNode } from "react";
import type { Route } from "./route.ts";

interface RouteViewProps {
  readonly board: Board;
  readonly route: Route;
}

const NOT_BUILT = {
  channel: "This channel's messages aren't shown yet.",
  login: "Signing in isn't built yet.",
  missing: "No page has this address.",
  thread: "This thread's replies aren't shown yet.",
} as const;

function titleOf(route: Exclude<Route, { readonly name: "channels" }>): string {
  if (route.name === "channel") {
    return `#${route.channel}`;
  }
  if (route.name === "thread") {
    return `Thread ${route.thread} in #${route.channel}`;
  }
  if (route.name === "login") {
    return "Sign in";
  }
  return "Nothing here";
}

export function RouteView(props: RouteViewProps): ReactNode {
  const { board, route } = props;
  if (route.name === "channels") {
    return <ChannelListView board={board} />;
  }
  return <NotBuiltView description={NOT_BUILT[route.name]} title={titleOf(route)} />;
}
