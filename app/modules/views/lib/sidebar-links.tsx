import { NavHeading, NavLink, NavList } from "../../design-system/index.tsx";
import type { Board } from "../../board/index.ts";
import type { ChannelName } from "../../sdk/index.ts";
import { ChannelRows } from "./channel-rows.tsx";
import { InboxLink } from "./inbox-link.tsx";
import type { Looking } from "./use-unread-levels.ts";
import { NewChannel } from "./new-channel.tsx";
import { NewChannelButton } from "./new-channel-button.tsx";
import type { ReactNode } from "react";
import type { Route } from "../../paths/index.ts";
import { hrefOf } from "../../paths/index.ts";
import { useSidebarCounts } from "./use-unread-levels.ts";
import { useSyncExternalStore } from "react";

const TEXT = {
  channels: "Channels",
  openThreads: "Open threads",
  people: "People & agents",
  views: "Views",
} as const;

interface SidebarLinksProps {
  readonly board: Board;
  readonly route: Route;
  readonly unread: Looking["unread"];
  readonly me: string;
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
  const counts = useSidebarCounts({ me: props.me, state: unread });
  return (
    <>
      <NavList label={TEXT.views}>
        <InboxLink active={route.name === "inbox"} counts={counts.inbox} />
        <NavLink
          active={route.name === "open-threads"}
          href={hrefOf({ all: false, name: "open-threads" })}
          icon="threads"
          label={TEXT.openThreads}
          marked={false}
        />
        <NavLink
          active={route.name === "people" || route.name === "profile"}
          href={hrefOf({ name: "people" })}
          icon="people"
          label={TEXT.people}
          marked={false}
        />
      </NavList>
      <NavHeading label={TEXT.channels}>
        <NewChannelButton creation={props.board.creation} />
      </NavHeading>
      <ChannelRows channels={channels} open={openChannel(route)} counts={counts.channels} />
      <NewChannel creation={props.board.creation} />
    </>
  );
}
