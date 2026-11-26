import { ColumnSearch, WorkspaceColumn, WorkspaceMain } from "../../design-system/layout.tsx";
import { IdentityDeletedNotice, MessageListKeys, ReconnectingView, RegionKeys, SearchBox } from "../../views/index.tsx";
import type { IdentityName } from "../../sdk/index.ts";
import type { ReactNode } from "react";
import type { Route } from "../../paths/index.ts";
import type { Stores } from "./stores.ts";
import { WorkspacePanes } from "./workspace-panes.tsx";

interface WorkspaceBodyProps {
  readonly me: IdentityName;
  readonly profile: IdentityName | null;
  readonly route: Route;
  readonly sidebarCollapsed: boolean;
  readonly sidebarOpen: boolean;
  readonly stores: Stores;
}

export function WorkspaceBody(props: WorkspaceBodyProps): ReactNode {
  const { stores } = props;
  return (
    <WorkspaceColumn sidebarOpen={props.sidebarOpen}>
      <MessageListKeys keymap={stores.keymap} />
      <RegionKeys keymap={stores.keymap} />
      <ColumnSearch sidebarCollapsed={props.sidebarCollapsed} sidebarOpen={props.sidebarOpen}>
        <SearchBox
          identities={stores.composer.identities}
          keymap={stores.keymap}
          place="column"
          search={stores.search}
        />
      </ColumnSearch>
      <ReconnectingView />
      <IdentityDeletedNotice identities={stores.composer.identities} />
      <WorkspaceMain>
        <WorkspacePanes me={props.me} profile={props.profile} route={props.route} stores={stores} />
      </WorkspaceMain>
    </WorkspaceColumn>
  );
}
