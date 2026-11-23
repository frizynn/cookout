import { InboxView, LoginView, NotBuiltView } from "../../views/index.tsx";
import { ChannelPanes } from "./channel-panes.tsx";
import type { ReactNode } from "react";
import type { Route } from "../../paths/index.ts";
import type { Stores } from "./stores.ts";

const TEXT = { missing: "No page has this address.", nothing: "Nothing here" } as const;

interface RoutePanesProps {
  readonly me: string;
  readonly route: Route;
  readonly stores: Stores;
}

export function RoutePanes(props: RoutePanesProps): ReactNode {
  const { route, stores } = props;
  if (route.name === "inbox") {
    return <InboxView me={props.me} unread={stores.unread} />;
  }
  if (route.name === "login") {
    return <LoginView session={stores.session} />;
  }
  if (route.name === "channel" || route.name === "thread") {
    return <ChannelPanes board={stores.board} composer={stores.composer} key={route.channel} route={route} />;
  }
  return <NotBuiltView description={TEXT.missing} title={TEXT.nothing} />;
}
