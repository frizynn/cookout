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
 * description, its top-level messages, newest last, with "Load older
 * messages" for older ones or, when there are none, the start of the channel,
 * and viewing it marks the channel read; under them a message box that posts a
 * top-level message there and a form to call a command there that shows the
 * schema errors of data the command refuses. Each message shows its reply
 * count as a link to its thread and, on hover or focus, a "Reply" link to it;
 * the open thread's parent is highlighted. `ThreadView` is the thread panel
 * beside it: the thread's parent message, its reply count, and its replies,
 * oldest first, with a reply box that takes focus when the panel opens and a
 * link that closes it, and opening it marks the thread read. In both,
 * consecutive messages from one author within 5 minutes sit under one name
 * (a new day, the "New" line or a message with replies starts a new group),
 * each day starts with a separator naming it, the "New" line sits above the
 * first message that was unread when the view opened (the `unread` store's
 * `newLine`), and a message mentioning the logged-in human is highlighted,
 * its `@name` marked. Both boxes suggest identities to mention
 * as `@` and a name are typed, keep their text in a draft (the `composer`
 * store) until a post succeeds, send on Enter, start a new line on
 * Shift+Enter, and while suggestions show, move the highlight with the arrow
 * keys and pick it on Enter. A message's author is drawn with their avatar,
 * as an agent if the identity list says so (or, for an author no longer in
 * it, if the message carries an owner), and its data is folded behind a
 * toggle, a command call's shown as the command and the data it called it
 * with. `Authors` gives
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
