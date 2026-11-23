/**
 * The page's title: the one owner of `document.title`, so no view sets it.
 * `usePageTitle` sets it for the page being drawn: what the page is, then
 * `· cookout` ("Inbox · cookout", "#general · cookout", "Thread in #general ·
 * cookout", "@ada · cookout"), led by how many unread messages are for whoever
 * is looking when there are any ("(3) Inbox · cookout"). Those are the unread
 * inbox items that mention them, as the sidebar counts them loud. Logged out,
 * every route is titled for the login view, and nothing is counted.
 */
import type { Unread, UnreadState } from "../unread/index.ts";
import { useEffect, useSyncExternalStore } from "react";
import type { Route } from "../paths/index.ts";

const APP = "cookout";
const NONE = 0;

const FIXED: Readonly<Record<Exclude<Route["name"], "channel" | "profile" | "thread">, string>> = {
  approve: "Approve a login",
  "approve-join": "Approve an agent",
  inbox: "Inbox",
  login: "Logged in",
  missing: "Nothing here",
  people: "People",
  settings: "Settings",
};

const LOGGED_OUT = "Log in";

const NOTHING_LOADED: UnreadState = { status: "loading" };

function routeName(route: Route): string {
  if (route.name === "channel") {
    return `#${route.channel}`;
  }
  if (route.name === "thread") {
    return `Thread in #${route.channel}`;
  }
  if (route.name === "profile") {
    return `@${route.identity}`;
  }
  return FIXED[route.name];
}

function pageName(options: PageTitleOptions): string {
  if (!options.loggedIn) {
    return LOGGED_OUT;
  }
  return routeName(options.route);
}

function forYouCount(state: UnreadState): number {
  if (state.status !== "loaded") {
    return NONE;
  }
  return state.items.filter((item) => item.reasons.includes("mention")).length;
}

function titleOf(name: string, forYou: number): string {
  const title = `${name} · ${APP}`;
  if (forYou === NONE) {
    return title;
  }
  return `(${String(forYou)}) ${title}`;
}

const unchanging = new Set<() => void>();

function followNothing(listener: () => void): () => void {
  unchanging.add(listener);
  return () => {
    unchanging.delete(listener);
  };
}

function nothingLoaded(): UnreadState {
  return NOTHING_LOADED;
}

interface Followed {
  readonly subscribe: (listener: () => void) => () => void;
  readonly snapshot: () => UnreadState;
}

function followed(options: PageTitleOptions): Followed {
  if (!options.loggedIn) {
    return { snapshot: nothingLoaded, subscribe: followNothing };
  }
  return options.unread;
}

/** What sets the title: whether anyone is logged in, the route drawn, and the unread store, read only while logged in. */
export interface PageTitleOptions {
  readonly loggedIn: boolean;
  readonly route: Route;
  readonly unread: Unread;
}

/**
 * Sets the page's title for the route drawn, led by the unread count for whoever is logged in.
 * @param options Whether anyone is logged in, the route, and the unread store, read only while logged in.
 */
export function usePageTitle(options: PageTitleOptions): void {
  const store = followed(options);
  const state = useSyncExternalStore(store.subscribe, store.snapshot);
  const title = titleOf(pageName(options), forYouCount(state));
  useEffect(() => {
    globalThis.document.title = title;
  }, [title]);
}
