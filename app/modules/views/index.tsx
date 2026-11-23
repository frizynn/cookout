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
