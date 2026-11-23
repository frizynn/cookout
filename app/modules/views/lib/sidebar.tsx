import { Sidebar, SidebarBody, SidebarFooter } from "../../design-system/index.tsx";
import type { Board } from "../../board/index.ts";
import type { Composer } from "../../composer/index.ts";
import type { Identity } from "../../sdk/index.ts";
import type { Layout } from "../../layout/index.ts";
import type { ReactNode } from "react";
import type { Route } from "../../paths/index.ts";
import { SidebarLinks } from "./sidebar-links.tsx";
import { SidebarSettings } from "./sidebar-settings.tsx";
import type { Unread } from "../../unread/index.ts";
import { useSyncExternalStore } from "react";

const TEXT = { name: "cookout", sidebar: "Sidebar" } as const;

interface SidebarProps {
  readonly board: Board;
  readonly composer: Composer;
  readonly identity: Identity;
  readonly layout: Layout;
  readonly route: Route;
  readonly unread: Unread;
}

export function SidebarView(props: SidebarProps): ReactNode {
  const { layout } = props;
  const state = useSyncExternalStore(layout.subscribe, layout.snapshot);
  const handleFollow = layout.closeSidebar;
  const handleToggleCollapsed = layout.toggleCollapsed;
  return (
    <Sidebar
      collapsed={state.collapsed}
      label={TEXT.sidebar}
      onToggleCollapsed={handleToggleCollapsed}
      open={state.sidebar}
      title={TEXT.name}
    >
      <SidebarBody onFollow={handleFollow}>
        <SidebarLinks board={props.board} route={props.route} unread={props.unread} />
      </SidebarBody>
      <SidebarFooter>
        <SidebarSettings
          composer={props.composer}
          identity={props.identity}
          layout={layout}
          open={props.route.name === "profile" && props.route.identity === props.identity.name}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
