/**
 * The views: each screen of the web UI, drawn from the design system and read
 * from the stores with `useSyncExternalStore`. `LoginView` swaps a human
 * identity's token for the session cookie, or shows who is logged in.
 * `SidebarView` is the workspace's sidebar: the Inbox link with the inbox's
 * total unread count (in the unread colour when any item is a mention), the
 * People & agents link, every channel sorted by name, bold when it has unread
 * messages, with its mention count as a pill (its unread count read out only),
 * or why the channels can't load, the open item highlighted, and the
 * logged-in human with a Settings button, whose panel holds the theme switch
 * (the `layout` store). `ChannelView` is a channel's pane: its name and
 * description, its top-level messages with their reply counts, newest last,
 * with "Load more" for older ones, and viewing it marks the channel read; under
 * them a message box that posts a top-level message there and a form to call a
 * command there that shows the schema errors of data the command refuses.
 * `ThreadView` is the thread panel beside it: the thread's parent message and
 * its replies, oldest first, with a reply box and a link that closes it, and
 * opening it marks the thread read. Both boxes suggest identities to mention
 * as `@` and a name are typed, keep their text in a draft (the `composer`
 * store) until a post succeeds, send on Enter, start a new line on
 * Shift+Enter, and while suggestions show, move the highlight with the arrow
 * keys and pick it on Enter. A message's author is drawn with their avatar,
 * as an agent if the identity list says so (or, for an author no longer in
 * it, if the message carries an owner), and its data is shown with it, a
 * command call's as the data it called the command with. `Authors` gives
 * every message under it the identity list. `InboxView` lists the inbox
 * items of whoever is logged in, oldest first, each with its reasons and a
 * link to where it is read, after each channel's unread and mention counts
 * (the `unread` store, live). `NotBuiltView` says a route has nothing to show.
 */
export { Authors } from "./lib/authors.tsx";
export { ChannelView } from "./lib/channel.tsx";
export { InboxView } from "./lib/inbox.tsx";
export { LoginView } from "./lib/login.tsx";
export { NotBuiltView } from "./lib/not-built.tsx";
export { SidebarView } from "./lib/sidebar.tsx";
export { ThreadView } from "./lib/thread.tsx";
