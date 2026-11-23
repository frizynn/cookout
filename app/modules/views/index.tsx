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
 * (the `unread` store, live). `PeopleView` is the directory of every
 * identity (the identity list, which any identity may read): how many there
 * are, a name filter and All / Humans / Agents chips, each counting what the
 * name filter leaves (both kept in the `layout` store), and a row per
 * identity shown, with its avatar, name, "(you)" on the logged-in human, its
 * `agent` and `admin` tags and its kind and owner, the open one highlighted;
 * "Nobody matches." when the filters leave none. `ProfileView` is the panel
 * beside it for one identity: its large avatar, name and tags, display name,
 * kind and owner, and when it joined, or "Unknown identity", with a link that
 * closes it. The sidebar's footer links to the logged-in human's own profile.
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
