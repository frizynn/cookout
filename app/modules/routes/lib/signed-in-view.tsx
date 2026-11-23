import type { Identity, IdentityName } from "../../sdk/index.ts";
import type { ReactNode } from "react";
import type { Route } from "../../paths/index.ts";
import { SidebarView } from "../../views/index.tsx";
import type { Stores } from "./stores.ts";
import { Workspace } from "../../design-system/index.tsx";
import { WorkspaceBody } from "./workspace-body.tsx";
import { useSyncExternalStore } from "react";

interface SignedInViewProps {
  readonly identity: Identity;
  readonly profile: IdentityName | null;
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
      <WorkspaceBody me={props.identity.name} profile={props.profile} route={props.route} stores={stores} />
    </Workspace>
  );
}
