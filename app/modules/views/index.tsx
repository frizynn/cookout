/**
 * The views: each screen of the web UI, drawn from the design system and read
 * from the stores with `useSyncExternalStore`. `LoginView` swaps a human
 * identity's token for the session cookie, or shows who is logged in;
 * `ChannelListView` lists every channel on the server, each linking to its
 * channel, or says why it can't; `ChannelView` shows a channel's top-level
 * messages with their reply counts, newest last, with "Load more" for older
 * ones, and viewing it marks the channel read; `NotBuiltView` stands in for a
 * screen that has a route but isn't built yet.
 */
export { ChannelListView } from "./lib/channel-list.tsx";
export { ChannelView } from "./lib/channel.tsx";
export { LoginView } from "./lib/login.tsx";
export { NotBuiltView } from "./lib/not-built.tsx";
