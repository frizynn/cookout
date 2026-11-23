/**
 * The views: each screen of the web UI, drawn from the design system and read
 * from the stores with `useSyncExternalStore`. `ChannelListView` lists every
 * channel on the server, each linking to its channel, or says why it can't;
 * `NotBuiltView` stands in for a screen that has a route but isn't built yet.
 */
export { ChannelListView } from "./lib/channel-list.tsx";
export { NotBuiltView } from "./lib/not-built.tsx";
