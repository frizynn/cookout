/**
 * The design system: hand-written Tailwind components styled after shadcn/ui (its token names and its card), in a Vercel-like neutral look with small pops of colour (ADR 0080). Every view builds from these and none styles itself, so no component takes classes. `styles.css` is the Tailwind theme, which `index.html` loads: its tokens are CSS variables, dark by default, light under `data-theme="light"` on the root element, and light under `prefers-color-scheme: light` unless `data-theme="dark"`; components read tokens, never raw colours. Text and the UI are sans, times and channel names mono.
 *
 * - `Workspace` is the page around every route once logged in: a `Sidebar` on the left, and a `WorkspaceMain` of the route's panes on the right, in a `WorkspaceColumn` under any `StatusBar`.
 * - `Sidebar` is on the left (on a narrow screen, behind a button that opens and closes it), which a button at its top collapses to a narrow rail holding only that button on a wide screen (`collapsed`), and, given an `edge`, is as wide as it says, its right edge a `PanelEdge` (`side` `right`; no `onClose`, so a drag stops at its narrowest), with its `SidebarBody` and its `SidebarFooter`.
 * - `SidebarBody` is the sidebar's body of links (following one, but not pressing a button, closes it on a narrow screen).
 * - `SidebarFooter` is the sidebar's footer.
 * - `WorkspaceMain` holds the route's panes on the right.
 * - `WorkspaceColumn` is the column of the route's panes, under any `StatusBar`.
 * - `StatusBar` is a named polite live region that shows its text in a bar, in the attention colours, only while `shown`, such as "Reconnecting…".
 * - `NavLink` is one link in the sidebar, bold when it has something new (`marked`), highlighted when it is the open item, with an icon and any `Pill` after it; a `menu` is its `ActionMenu`.
 * - `Pill` is a count read out by its label, loud (the unread colour), quiet, or unseen (read out only).
 * - `ActionMenu` is a menu outside a message: right-clicking its children, or Shift+F10 or the menu key in them, opens its `choices` (each showing any `keys` it has) as a context menu named by its `label`; a More actions button (or `buttonLabel`), shown on hover or focus (`inline`: before a name), opens them as a dropdown.
 * - `PersonMenu` is a name's `ActionMenu`; under a `PersonKeysArea`, its keys (View profile, Message, Copy name, which a polite status announces) act on the name while focus is in it.
 * - `NavHeading` heads a `NavList` of links, with any `HeadingButton` on its line.
 * - `NavList` is a list of links under a `NavHeading`.
 * - `HeadingButton` is a plus named by its label that starts something new, such as a channel.
 * - `FooterLink` is a link in the footer with a gear, such as Settings, highlighted when open.
 * - `Pane` is the main column, with a `PaneHeader`, a named `Page` or `ScrollArea`, and anything under it, such as a message box in a `BoxFrame` with its keyboard hint.
 * - `PaneHeader` is a pane's title, description and any action on its right, such as a `PressButton`; its title is mono, as a channel's name, unless `sans`.
 * - `PressButton` is a button that is on or off.
 * - `Page` is named and scrolls a centred column of `PageSection`s.
 * - `PageSection` is headed by a link to itself, its heading focused when `focused` (such as Settings).
 * - `ChoiceGroup` is a radio group of a few choices.
 * - `ScrollArea` is named and stays scrolled to the end as what it counts grows, unless scrolled up.
 * - `BoxFrame` holds a message box with its keyboard hint.
 * - `SidePanel` is a named column on the pane's right with a close link (the whole width on a narrow screen), its title an `ActionMenu`'s target given a `menu`. Given an `edge`, it is as wide as its edge says on a wide screen (never more than 60% of the space beside it), and its left edge is a `PanelEdge`.
 * - `PanelEdge` is a focusable vertical separator, a line on hover and focus, that a drag or the arrow keys resize (Left widens), Home and End take to its narrowest and widest, and a drag released past its narrowest closes (`onClose`); it isn't shown on a narrow screen.
 * - `ListPane` is the main column of a split view, such as the inbox's (hidden on a narrow screen while `hiddenWhenNarrow`), beside a `ConversationPanel` or a `ConversationEmpty`.
 * - `ConversationPanel` is a named column with a `BackLink` arrow (shown only on a narrow screen, where the panel takes the whole width), its detail, its header's `actions` as small buttons and any `open` link, each naming its `Shortcut` in `aria-keyshortcuts` and a tooltip, its `message` being what an identity card's Message does in it (an `IdentityCardComposer`). Given an `edge`, it is as wide as its edge says on a wide screen (never more than 60% of the space beside it), and its left edge is a `PanelEdge`.
 * - `Shortcut` is a control's keys as the keymap names them.
 * - `ConversationEmpty` is a named column holding only a muted line (hidden on a narrow screen).
 * - `DividerButton` is a divider line led by a quiet button, such as one that shows the replies folded under it.
 * - A name's avatar is its coloured initials, one of eight hues hashed from the name, a circle for a human and a rounded square for an agent, with its `PresenceDot` in the corner once its presence is known.
 * - `PresenceDot` is filled in the online colour while online, a hollow grey ring while offline, a ring in the accent with a dot in its middle for the owner's warning ("Offline, went offline unexpectedly"), named for a screen reader and as a tooltip ("Offline, last seen 5 minutes ago"), as a `Suggestions` option shows it beside the name.
 * - `Author` is a message's avatar and name (a display name, with the `@name` muted beside it), with an `agent` tag for an agent.
 * - `Tag` is one such small tag, such as `admin`.
 * - `IdentityLink` is the logged-in identity's avatar and name as a link, highlighted when open.
 * - `LineForm` is a named form of one labelled line of text, whose text its owner holds, with a Save button (disabled while saving; `submit` names its button, `Save` unless given) and anything under it, such as an `Alert`.
 * - `AreaForm` is `LineForm`'s form of a few growing lines of text, up to `limit` characters shown as a counter, where Enter starts a new line and Ctrl/Cmd+Enter saves.
 * - `ActionGroup` is a named group of what can be done to one thing.
 * - `ButtonRow` puts buttons side by side.
 * - `TokenText` shows a secret, such as a fresh token, to copy.
 * - `ConfirmDialog` asks before an action, in a modal shadcn AlertDialog on Radix's primitives (ADR 0080), the one part built on a library: its title, a body naming exactly what happens, Cancel and a confirm button, in the destructive colour when the action can't be undone. It holds focus inside while open, Escape or Cancel calls `onCancel`, and focus goes back to what opened it when it closes. While `pending` both buttons are disabled and the confirm button says so; an `error` shows inside it. Its owner decides when it is `open`, so it never closes.
 * - `FormDialog` is a Radix modal form.
 * - `RunList`.
 * - `FieldNote`.
 * - `MoreActions`.
 * - `ShortcutList` is a Radix modal of keyboard shortcuts, each group a list named by its heading, each row what a shortcut does beside its keys; Escape calls `onClose`, and focus goes back to what was focused when it opened.
 * - `Toolbar` sits under a `PaneHeader` and holds a `FilterField` and `Chip`s.
 * - `FilterField` is a labelled box whose text its owner holds.
 * - `Chip` is a button, pressed or not.
 * - `ListArea` is named and scrolls from the top, holding `IdentityRow`s.
 * - `IdentityRow` is a link to an identity, with its avatar, name, any tags and a muted detail line, highlighted when open.
 * - `Profile` is one identity's large avatar beside its `ProfileName` and its details.
 * - `ProfileName` is an identity's name and any tags, as a heading.
 * - `DateText` is a moment as a date, in mono.
 * - `Feed` is a named, centred column that scrolls, such as the inbox, read from the top.
 * - `FeedHeading` heads a part of a `Feed`, with its count, or, with no count, as a divider line.
 * - `FeedList` is a named list of `FeedRow`s.
 * - `FeedRow` is a link over the whole row (named by its text) leading with why it is there (`why`), then a message with its author's avatar and name (its own link, to `authorHref`, above the row's), what they did (`action`) and in which channel, a short time, a `Closed` marker when it is `closed` (its thread is closed), any `count` of how many of its messages are new ("3 new") and any `context` line (a reply's thread), then what it holds: its `FeedText` and any `RowButton`; given a `menu`, it is an `ActionMenu`'s target. A `for-you` row has an accent dot and why, a bold name and bright text; an `activity` row has a muted dot and why, a bold name and bright text; a `read` one is muted. A `current` row, the one whose conversation is shown, is highlighted and its link marked as the current page.
 * - `FeedText` is a row's text, up to two lines.
 * - `RowButton` is a small button raised above the row's link.
 * - `FeedNoticeRow` sits in a `FeedList` for an Inbox entry about an identity rather than a message: its why, then the identity's avatar and name (a link to `href`) and a short time, then any buttons; `for-you` or `read` as a `FeedRow`.
 * - `Mention` is an `@` mention in a message's text, in the mention colour when it is the reader's own (`mine`).
 * - `FeedNote` is a muted line in a feed: why a part is `empty`, or that it has reached the `end`.
 * - `MoreButton` is a quiet full-width row under a list that loads more of it, with a spinner while `loading`.
 * - `MessageList` is a named `feed` of `MessageItem`s (`aria-busy` while `busy`; `aria-setsize` -1 while `more`) with one Tab stop: the item focused last or the newest (see its ADR); `feed` is its element ID.
 * - `MessageItem` is one message, an `article` labelled by its author and time, which takes focus, with its avatar, name and time, or only its time on hover when `grouped` under the one before; the day's separator and the "New" line above it when it starts them; a mark (`for-you`, the filled accent block, when it mentions or answers the reader, or `open`); and, shown on hover or focus, a "Quick actions" group of icon buttons, each with no text and named by its tooltip: a button for each of its `menu`'s `reactions` that is `inHoverBar`, then, when `replyOnHover`, its action (such as Reply: a link, or a button with `onAction`), then its thread choice when `threadOnHover`, then More actions. Each reaction's button has its `key` as `aria-keyshortcuts` for the keymap to press; one not in the hover bar gets a `hidden` one (its menu item shows the key). Its `menu` gives it one actions menu (the action, then each reaction, then Mark unread, then the thread choice, such as Close, if any), drawn two ways on Radix: right-clicking the message, or the context-menu key or Shift+F10 on it, opens it as a context menu at the pointer, and the More actions button opens it as a dropdown. Every menu item draws its `icon` (a `ThreadChoice` names one too), which its type requires, before its label. An item may be `disabled`, dimmed and not chosen. Radix gives both their keyboard and focus behaviour; a chosen item's action runs once the menu has closed. An item given `keys` (a `Shortcut`) names them in `aria-keyshortcuts` and shows their label at its end. Mark unread's tooltip names its shortcut, `Alt-click`: an Alt-click (Option-click on macOS) on the message, but not on a link, button or other interactive element in it, runs Mark unread at once and focuses and selects nothing. A message's time takes focus, and hovering or focusing it opens a tooltip with the full date and time and, when the message has one, its read receipt.
 * - `StandaloneMessage` is one named message on its own, such as a thread's parent; an Alt-click on it runs Mark unread as on a `MessageItem`.
 * - `IdentityCard` is what a message's author name and an `@name` in its text each are: hovering it (after a short delay) or focusing it opens a card, a Radix tooltip beside the name, kept inside the window: a labelled `dialog` led by a square avatar tile (grey when deactivated; an Agent chip on an agent's), then its name, `@name` handle, presence or a red Deactivated, kind, description, an agent's Open session ↗ (its `sessionOf`, in a new tab), and Message (calls the nearest `IdentityCardComposer`; disabled when deactivated or with none) and View profile. Tab on the name moves into it; Escape or Tab past either end closes it, focus back on the name. Its card comes from the `IdentityCards` source the views provide; with none, the name is drawn alone.
 * - `IdentityCards` is the source of identity cards the views provide.
 * - `IdentityCardComposer` is what an identity card's Message calls, the nearest one.
 * - `MessageBody` holds a message's rendered Markdown text, `Mention` an `@name` in it.
 * - `CallChip` is a command call and its data.
 * - `DataToggle` is a message's data folded away.
 * - `ThreadSummary` is a link to a message's thread: its repliers' avatars, its reply count, how many replies are new (bold, after an accent dot and with how many are to the reader when any is) and when it was last replied to.
 * - `ReactionChips` is a message's named row of `ReactionChip`s.
 * - `ReactionChip` is a reaction and its count, pressed (in the accent) when one is the reader's own, with who reacted as its tooltip.
 * - `RepliesDivider` heads a thread's replies.
 * - `ChannelStart` says a channel has nothing older.
 * - `QuietButton` is a muted centred button, naming what it `controls`, such as loading older messages.
 * - `ClosedFold` is an item of a message list standing for closed threads folded away, an `article` named by its button on a dashed line that unfolds them; given a `day`, the day's label (a separator to a screen reader) shares that line, in place of a day separator of its own beside it: the label in the line's centre, the button at its right end, shortening rather than overlapping the label on a narrow line.
 * - `ThreadBar` is a muted bar across the top of a thread: a line of text and one icon button named by its tooltip, such as who closed it and Reopen thread.
 * - `QuietLink` is a muted link in such a line, such as a name linking to its profile.
 * - `AppShell` is the page around the login view.
 * - `Card` is a shadcn-style card, centred in a scrolling column.
 * - `CardHeader` is the card's title row.
 * - `Heading` is part of the card's title row.
 * - `Muted` is part of the card's title row.
 * - `CardBody` is a padded section under the card's title row.
 * - `MutedLines` is muted text that keeps its line breaks.
 * - `LinkList` is a named list of links, each a `LinkRow`.
 * - `LinkRow` is one link in a `LinkList`.
 * - `ItemList` is a named list of plain rows, each an `ItemRow`.
 * - `ItemRow` is one plain row in an `ItemList`.
 * - `Alert` is a refusal, read out by screen readers.
 * - `Announcement` is a polite live region (its text again as its count moves).
 * - `Notice` is a passing word on what just happened, read out politely.
 * - `Skeleton` stands in while something loads.
 * - `Form` hands one field's value to `onSubmit` without reloading the page.
 * - `TextField` is a labelled secret input in a `Form`, such as a token.
 * - `TextArea` is a labelled box to write in, such as a reply, whose text and caret its owner holds, where Enter sends the form and Shift+Enter starts a new line, and, while its owner is `choosing` from suggestions, is a combobox naming the highlighted option as its active descendant, where the arrows move it, Enter or Tab picks it and Escape closes the list. It takes focus when it first appears if `focused`.
 * - `SubmitButton` sends a `Form`.
 * - `SendButton` is its paper-plane icon form, named and tooltipped by `label`.
 * - `Suggestions` is a named listbox of options under a box, such as mentions or commands (each with any muted detail), one selected, which leaves the box focused even when a pointer picks one; it floats above the box, out of its layout, over all in the pane.
 * - `ComboboxField` is a named search input (`box` its ID) that is a combobox controlling the listbox `list`, its option at `active` the active one while `expanded`.
 * - `Listbox` is the named listbox (`list` its ID) both draw, of options in optional named groups, drawn by its children, the one at `highlighted` selected (scrolled into view in the `results` look); pressing one calls `onChoose` with its `value`, leaving the box focused.
 * - `ResultOption` is a result's label, detail and children.
 * - `DataArea` is a labelled box to write JSON in, whose text its owner holds.
 * - `LinesArea` is an optional labelled box for lines (`name: value` headers), whose text its owner holds.
 * - `PromptForm` is a named card in place of a message box that asks for a command's data, titled, with a Cancel and a submit button, its first field focused, and Escape anywhere in it calls `onEscape`.
 * - `InputField` is a labelled field in a `PromptForm` (text, a number, an integer, a date or a time) whose value its owner holds, marked when required, with its help text and any error under it, both read out as its description.
 * - `PickField` is a labelled field in a `PromptForm` (one of a list, or none) whose value its owner holds, marked when required, with its help text and any error under it, both read out as its description.
 * - `CheckField` is a labelled field in a `PromptForm` (a checkbox) whose value its owner holds, marked when required, with its help text and any error under it, both read out as its description.
 *
 * Wherever an identity has a display name (`IdentityLink`, `IdentityRow`, `ProfileName`, a `Suggestions` option's muted detail) it shows first and the `@name` muted beside it.
 */
export {
  AppShell,
  BoxFrame,
  Card,
  CardBody,
  CardHeader,
  HeadingButton,
  NavHeading,
  NavLink,
  NavList,
  Pane,
  ListPane,
  ConversationEmpty,
  ConversationPanel,
  PaneHeader,
  Page,
  PageSection,
  FooterLink,
  SidePanel,
  ScrollArea,
  Sidebar,
  SidebarBody,
  SidebarFooter,
  Workspace,
  WorkspaceMain,
  WorkspaceColumn,
  StatusBar,
  ListArea,
  Toolbar,
} from "./lib/layout.ts";
export type { PanelAction, PanelEdgeParts, ShortcutLinkParts } from "./lib/layout.ts";
export {
  CallChip,
  ChannelStart,
  DataToggle,
  MessageBody,
  MessageItem,
  MessageList,
  ClosedFold,
  ThreadBar,
  RepliesDivider,
  ThreadSummary,
  StandaloneMessage,
  Mention,
  IdentityCard,
  PersonMenu,
  PersonKeysArea,
  IdentityCardComposer,
  IdentityCards,
  ReactionChip,
  ReactionChips,
} from "./lib/messages.ts";
export type {
  PersonKeysSource,
  IdentityCardLink,
  IdentityCardParts,
  IdentityCardSession,
  IdentityCardSource,
  ActionMenuParts,
  MenuChoice,
  ReactionChoice,
  ThreadChoice,
} from "./lib/messages.ts";
export {
  FeedRowClosed,
  MoreButton,
  Feed,
  FeedHeading,
  FeedList,
  FeedNote,
  FeedNoticeRow,
  FeedRow,
  FeedText,
  RowButton,
} from "./lib/feed-rows.ts";
export {
  ActionGroup,
  ConfirmDialog,
  FormDialog,
  ShortcutList,
  FieldNote,
  RunList,
  MoreActions,
  ButtonRow,
  TokenText,
  QuietButton,
  Button,
  CheckField,
  ChoiceGroup,
  DataArea,
  LinesArea,
  Form,
  LineForm,
  AreaForm,
  InputField,
  DividerButton,
  PressButton,
  PickField,
  PromptForm,
  Suggestions,
  ComboboxField,
  Listbox,
  type ListboxGroup,
  type ListboxOption,
  ResultOption,
  SendButton,
  SubmitButton,
  TextArea,
  TextField,
  Chip,
  FilterField,
} from "./lib/controls.ts";
export {
  Alert,
  Announcement,
  Heading,
  ItemList,
  ItemRow,
  LinkList,
  LinkRow,
  Muted,
  MutedLines,
  QuietLink,
  Notice,
  Pill,
  Skeleton,
  Tag,
  IdentityLink,
  DateText,
  IdentityRow,
  Profile,
  ProfileName,
} from "./lib/content.ts";
