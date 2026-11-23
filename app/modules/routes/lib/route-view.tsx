import { AgentJoinApprovalView, Authors, LoginApprovalView, LoginView } from "../../views/index.tsx";
import { AppShell } from "../../design-system/index.tsx";
import type { ReactNode } from "react";
import type { Route } from "../../paths/index.ts";
import { SignedInView } from "./signed-in-view.tsx";
import type { Stores } from "./stores.ts";
import { usePageTitle } from "../../page-title/index.ts";
import { useSyncExternalStore } from "react";

interface RouteViewProps {
  readonly route: Route;
  readonly stores: Stores;
}

export function RouteView(props: RouteViewProps): ReactNode {
  const { session } = props.stores;
  const state = useSyncExternalStore(session.subscribe, session.snapshot);
  usePageTitle({ route: props.route, session, unread: props.stores.unread });
  if (state.status !== "logged-in") {
    return (
      <AppShell>
        <LoginView session={session} />
      </AppShell>
    );
  }
  if (props.route.name === "approve") {
    return (
      <AppShell>
        <LoginApprovalView approval={props.stores.loginApprovals.forCode(props.route.userCode)} />
      </AppShell>
    );
  }
  if (props.route.name === "approve-join") {
    return (
      <AppShell>
        <AgentJoinApprovalView approval={props.stores.agentJoinApprovals.forCode(props.route.userCode)} />
      </AppShell>
    );
  }
  return (
    <Authors identities={props.stores.composer.identities}>
      <SignedInView identity={state.identity} route={props.route} stores={props.stores} />
    </Authors>
  );
}
