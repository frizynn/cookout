import { Workspace, WorkspaceMain } from "../../design-system/index.tsx";
import type { Identity } from "../../sdk/index.ts";
import type { ReactNode } from "react";
import type { Route } from "../../paths/index.ts";
import { RoutePanes } from "./route-panes.tsx";
import { SidebarView } from "../../views/index.tsx";
import type { Stores } from "./stores.ts";
import { useSyncExternalStore } from "react";

interface SignedInViewProps {
  readonly identity: Identity;
  readonly route: Route;
  readonly stores: Stores;
}

export function SignedInView(props: SignedInViewProps): ReactNode {
  const { stores } = props;
  const { layout } = stores;
  const { sidebar } = useSyncExternalStore(layout.subscribe, layout.snapshot);
  const handleToggle = layout.toggleSidebar;
  return (
    <Workspace onToggleSidebar={handleToggle} sidebarOpen={sidebar}>
      <SidebarView
        board={stores.board}
        identity={props.identity}
        layout={layout}
        route={props.route}
        unread={stores.unread}
      />
      <WorkspaceMain>
        <RoutePanes me={props.identity.name} route={props.route} stores={stores} />
      </WorkspaceMain>
    </Workspace>
  );
}
