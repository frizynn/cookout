/**
 * The views: each screen of the web UI, drawn from the design system and read
 * from the stores with `useSyncExternalStore`. `LoginView` swaps a human
 * identity's token for the session cookie, or shows who is logged in.
 * `SidebarView` is the workspace's sidebar: the Inbox link with the inbox's
 * total unread count (in the unread colour when any item is a mention), the
 * People & agents link, every channel sorted by name, bold when it has unread
 * messages, with its mention count as a pill (its unread count read out only),
 * or why the channels can't load, the open item highlighted, and the
 * logged-in human with a Settings button, whose panel holds a form for the
 * human's own display name and one for each agent they own (the `composer`
 * store: saving shows at once, a refusal shows in that form and keeps the
 * text) and the theme switch (the `layout` store). Wherever an identity
 * shows, its display name, read live from the identity list `Authors` gives,
 * comes first with the `@name` muted beside it. `ChannelView` is a channel's pane: its name and
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
 * first message by someone else after the read position the view opened at
 * (the `unread` store's `newLine`), and a message mentioning the logged-in human is highlighted,
 * its `@name` marked. Both boxes suggest identities to mention
 * as `@` and a name are typed, keep their text in a draft (the `composer`
 * store) until a post succeeds, send on Enter, start a new line on
 * Shift+Enter, and while suggestions show, move the highlight with the arrow
 * keys and pick it on Enter. A message's author is drawn with their avatar,
 * as an agent if the identity list says so (or, for an author no longer in
 * it, if the message carries an owner), and its data is folded behind a
 * toggle, a command call's shown as the command and the data it called it
 * with. `Authors` gives
 * every message under it the identity list. `InboxView` is the inbox of
 * whoever is logged in (the `unread` store): Unread, with its count, newest
 * first and live, or "You're all caught up."; then Earlier, the read items
 * from the inbox history, newest first, with "Load more" while older ones
 * remain and "That's everything." at the end, or "Nothing read yet.". Each
 * row is a link to where its message is read (a reply's thread or a
 * top-level message's channel), with its author, channel, a short time, a
 * reply's thread, two lines of its text with mentions styled (the reader's
 * own in the mention colour) and its reasons as badges; opening it acks it,
 * so it moves to Earlier. `PeopleView` is the directory of every
 * identity (the identity list, which any identity may read): how many there
 * are, a name filter and All / Humans / Agents chips, each counting what the
 * name filter leaves (both kept in the `layout` store), and a row per
 * identity shown, with its avatar, name, "(you)" on the logged-in human, its
 * `agent` and `admin` tags and its kind and owner, the open one highlighted;
 * "Nobody matches." when the filters leave none. `ProfileView` is the panel
 * beside it for one identity: its large avatar, name and tags, display name,
 * kind and owner, and when it joined, or "Unknown identity", with a link that
 * closes it. To an admin, a human's profile has "Make admin", or "Remove
 * admin" if it is one, and says why if the server refuses the change. The sidebar's footer links to the logged-in human's own profile.
 * `NotBuiltView` says a route has nothing to show.
 */
export { Authors } from "./lib/authors.tsx";
export { ChannelView } from "./lib/channel.tsx";
export { InboxView } from "./lib/inbox.tsx";
export { LoginView } from "./lib/login.tsx";
export { NotBuiltView } from "./lib/not-built.tsx";
export { PeopleView } from "./lib/people.tsx";
export { ProfileView } from "./lib/profile.tsx";
export { SidebarView } from "./lib/sidebar.tsx";
export { ThreadView } from "./lib/thread.tsx";
