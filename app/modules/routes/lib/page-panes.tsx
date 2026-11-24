import { InboxView, LoginView, SettingsView } from "../../views/index.tsx";
import type { IdentityName } from "../../sdk/index.ts";
import type { ReactNode } from "react";
import type { Route } from "../../paths/index.ts";
import type { Stores } from "./stores.ts";

interface PagePanesProps {
  readonly me: IdentityName;
  readonly route: Extract<Route, { readonly name: "inbox" | "login" | "settings" }>;
  readonly stores: Stores;
}

export function PagePanes(props: PagePanesProps): ReactNode {
  const { route, stores } = props;
  if (route.name === "inbox") {
    return (
      <InboxView
        board={stores.board}
        identities={stores.composer.identities}
        me={props.me}
        selected={route.selected}
        unread={stores.unread}
      />
    );
  }
  if (route.name === "login") {
    return <LoginView session={stores.session} />;
  }
  return <SettingsView composer={stores.composer} layout={stores.layout} me={props.me} section={route.section} />;
}
