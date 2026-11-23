/**
 * The routes: the web UI's one tested interface (ADR 0015). `CookoutApp`
 * reads the page's location hash and draws the view for it, in the design
 * system's shell: `#/` the channel list, `#/login`, `#/channels/<name>` and
 * `#/channels/<name>/threads/<id>`. Until the session is logged in, every route
 * shows the login view. The thread route says it isn't built yet, and any
 * other hash says there is nothing here.
 */
import { AppShell } from "../design-system/index.tsx";
import type { Board } from "../board/index.ts";
import type { ReactNode } from "react";
import { RouteView } from "./lib/route-view.tsx";
import type { Session } from "../session/index.ts";
import { routeOf } from "./lib/route.ts";
import { useSyncExternalStore } from "react";

function subscribeToHash(listener: () => void): () => void {
  globalThis.addEventListener("hashchange", listener);
  return () => {
    globalThis.removeEventListener("hashchange", listener);
  };
}

function currentHash(): string {
  return globalThis.location.hash;
}

/** What the web UI reads: the stores, each made with the SDK client it talks through. */
export interface CookoutAppProps {
  readonly board: Board;
  readonly session: Session;
}

/**
 * The whole web UI: the view for the page's location hash, redrawn when it changes.
 * @param props The stores.
 * @returns The app.
 */
export function CookoutApp(props: CookoutAppProps): ReactNode {
  const hash = useSyncExternalStore(subscribeToHash, currentHash);
  return (
    <AppShell>
      <RouteView board={props.board} route={routeOf(hash)} session={props.session} />
    </AppShell>
  );
}
