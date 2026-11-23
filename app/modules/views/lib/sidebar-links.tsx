import { NavHeading, NavLink, NavList } from "../../design-system/index.tsx";
import type { Board } from "../../board/index.ts";
import type { ChannelName } from "../../sdk/index.ts";
import { ChannelRows } from "./channel-rows.tsx";
import { InboxLink } from "./inbox-link.tsx";
import type { ReactNode } from "react";
import type { Route } from "../../paths/index.ts";
import type { Unread } from "../../unread/index.ts";
import { hrefOf } from "../../paths/index.ts";
import { useSyncExternalStore } from "react";

const TEXT = { channels: "Channels", people: "People & agents", views: "Views" } as const;

interface SidebarLinksProps {
  readonly board: Board;
  readonly route: Route;
  readonly unread: Unread;
}

function openChannel(route: Route): ChannelName | null {
  if (route.name === "channel" || route.name === "thread") {
    return route.channel;
  }
  return null;
}

export function SidebarLinks(props: SidebarLinksProps): ReactNode {
  const { route } = props;
  const { channels } = useSyncExternalStore(props.board.subscribe, props.board.snapshot);
  const unread = useSyncExternalStore(props.unread.subscribe, props.unread.snapshot);
  return (
    <>
      <NavList label={TEXT.views}>
        <InboxLink active={route.name === "inbox"} unread={unread} />
        <NavLink
          active={route.name === "people"}
          href={hrefOf({ name: "people" })}
          icon="people"
          label={TEXT.people}
          marked={false}
        />
      </NavList>
      <NavHeading>{TEXT.channels}</NavHeading>
      <ChannelRows channels={channels} open={openChannel(route)} unread={unread} />
    </>
  );
}
