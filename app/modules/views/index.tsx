/**
 * The views: each screen of the web UI, drawn from the design system and read
 * from the stores with `useSyncExternalStore`. `LoginView` swaps a human
 * identity's token for the session cookie, or shows who is logged in;
 * `ChannelListView` lists every channel on the server, each linking to its
 * channel, or says why it can't; `ChannelView` shows a channel's top-level
 * messages with their reply counts, newest last, with "Load more" for older
 * ones, and viewing it marks the channel read, with a form to call a command
 * there that shows the schema errors of data the command refuses; `ThreadView` shows a thread's
 * parent message and its replies, oldest first, with a reply box that
 * suggests identities to mention as `@` and a name are typed (the `composer`
 * store), and opening it marks the thread read; each links back up a level. A message's data is
 * shown with it, a command call's as the data it called the command with. `NotBuiltView` says
 * a route has nothing to show.
 */
export { ChannelListView } from "./lib/channel-list.tsx";
export { ChannelView } from "./lib/channel.tsx";
export { LoginView } from "./lib/login.tsx";
export { NotBuiltView } from "./lib/not-built.tsx";
export { ThreadView } from "./lib/thread.tsx";
