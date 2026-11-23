/**
 * The routes: the web UI's one tested interface (ADR 0015). `CookoutApp`
 * reads the page's location hash and draws the view for it. Until the session
 * is logged in, every route shows the login view, alone on the page. Once it
 * is, every route is drawn in the workspace, with the sidebar beside it:
 * `#/` (or no hash) and `#/inbox` the inbox, so the app opens on it, also
 * right after logging in; `#/login` who is logged in; `#/people` the people
 * and agents (not built yet, so "Nothing here"); `#/channels/<name>` the
 * channel; and `#/channels/<name>/threads/<id>` the channel with the thread's
 * panel open beside it. Any other hash, a channel name that isn't a channel
 * name, or a thread ID that isn't a message ID, says there is nothing here.
 * `#/approve/<user code>` is the approval page for a login request, a page of
 * its own outside the workspace (after the login view, if logged out). The
 * `paths` module reads the hash and builds every link's.
 */
import type { ReactNode } from "react";
import { RouteView } from "./lib/route-view.tsx";
import type { Stores } from "./lib/stores.ts";
import { routeOf } from "../paths/index.ts";
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
export type CookoutAppProps = Stores;

/**
 * The whole web UI: the view for the page's location hash, redrawn when it changes.
 * @param props The stores.
 * @returns The app.
 */
export function CookoutApp(props: CookoutAppProps): ReactNode {
  const hash = useSyncExternalStore(subscribeToHash, currentHash);
  return <RouteView route={routeOf(hash)} stores={props} />;
}
