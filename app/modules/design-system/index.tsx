/**
 * The design system: hand-written Tailwind components styled after shadcn/ui
 * (its token names and its card), in a Vercel-like neutral look with small
 * pops of colour (ADR 0034, ADR 0040). Every view builds from these and none
 * styles itself, so no component takes classes. `styles.css` is the Tailwind
 * theme, which `index.html` loads: its tokens are CSS variables, dark by
 * default, light under `data-theme="light"` on the root element, and light
 * under `prefers-color-scheme: light` unless `data-theme="dark"`; components
 * read tokens, never raw colours. Text and the UI are sans, times and channel
 * names mono.
 *
 * `Workspace` is the page around every route once logged in: a `Sidebar` on
 * the left (on a narrow screen, behind a button that opens and closes it),
 * which a button at its top collapses to a narrow rail holding only that
 * button on a wide screen (`collapsed`),
 * with its `SidebarBody` of links (following one, but not pressing a button, closes it on a narrow screen)
 * and its `SidebarFooter`, and a `WorkspaceMain` of the route's panes on the
 * right, in a `WorkspaceColumn` under any `StatusBar`: a named polite live
 * region that shows its text in a bar, in the attention colours, only while
 * `shown`, such as "Reconnecting…". In the sidebar, `NavLink` is one link, bold when
 * it has something new (`marked`), highlighted when it is the open item, with
 * an icon and any `Pill` after it: a count read out by its label, loud (the
 * unread colour), quiet, or unseen (read out only); `NavHeading` heads a
 * `NavList` of links, with any `HeadingButton` on its line, a plus named by
 * its label that starts something new, such as a channel; in the footer, `FooterLink` is a link
 * with a gear, such as Settings, highlighted when open. `Pane` is
 * the main column, with a `PaneHeader` (title, description and any action on
 * its right, such as a `PressButton`, a button that is on or off), a
 * named `Page` that scrolls a centred column of `PageSection`s, each headed by
 * a link to itself, its heading focused when `focused` (such as Settings,
 * where `ChoiceGroup` picks one of a few choices), a
 * named `ScrollArea` that stays scrolled to the end as what it counts grows, unless
 * scrolled up, and anything under it, such as a message box in a `BoxFrame`
 * with its keyboard hint; `SidePanel` is a
 * named column on its right with a close link (the whole width on a narrow
 * screen). A name's avatar is its coloured initials, one of eight hues hashed
 * from the name, a circle for a human and a square with a badge for an agent;
 * `Author` is a message's avatar and name (a display name, with the `@name`
 * muted beside it), with an `agent` tag for an agent;
 * `Tag` is one such small tag, such as `admin`. `IdentityLink` is the
 * logged-in identity's avatar and name as a link, highlighted when open.
 * Wherever an identity has a display name (`IdentityLink`, `IdentityRow`,
 * `ProfileName`, a `Suggestions` option's muted detail) it shows first and the
 * `@name` muted beside it. `LineForm` is a named form of one labelled line of
 * text, whose text its owner holds, with a Save button (disabled while
 * saving; `submit` names its button, `Save` unless given) and anything under
 * it, such as an `Alert`. `ActionGroup` is a named group of what can be done
 * to one thing, `ButtonRow` puts buttons side by side, and `TokenText` shows a
 * secret, such as a fresh token, to copy.
 * `PaneHeader`'s title is mono, as a channel's name, unless `sans`. A
 * `Toolbar` under it holds a `FilterField` (a labelled box whose text its
 * owner holds) and `Chip`s, buttons pressed or not; a named `ListArea` scrolls
 * from the top, and its `IdentityRow`s are links to identities, each with
 * its avatar, name, any tags and a muted detail line, highlighted when open.
 * `Profile` is one identity's large avatar beside its `ProfileName` (its
 * name and any tags, as a heading) and its details; `DateText` is a moment as a date, in mono.
 *
 * `Feed` is a named, centred column that scrolls, such as the inbox, read
 * from the top: a `FeedHeading` heads a part of it, with its count, or, with
 * no count, as a divider line; a `FeedList` is a named list of `FeedRow`s,
 * each a link over the whole row (named by its text) leading with why it is
 * there (`why`), then a message with its author's avatar and name (its own
 * link, to `authorHref`, above the row's), what they did (`action`) and in which channel, a
 * short time and any `context` line (a reply's thread), then what it holds:
 * its `FeedText`, up to two lines. A `for-you` row has an accent dot and why,
 * a bold name and bright text; an `activity` row has a muted dot and why, a
 * bold name and bright text; a `read` one is muted. `Mention` is
 * an `@` mention in a message's text, in the mention colour when it is the
 * reader's own (`mine`). `FeedNote` is a muted line in a feed: why a part is
 * `empty`, or that it has reached the `end`.
 * `MessageList` is a named list of `MessageItem`s: one message each, which
 * takes focus, with its avatar, name and time, or only its time on hover when
 * `grouped` under the one before; the day's separator and the "New" line above it when it starts them; a
 * mark (`for-you`, the filled accent block, when it mentions or answers the reader, or `open`); and an action (such as Reply: a link, or a button with `onAction`) and
 * a More actions button shown on hover or focus. With a `menu`, right-clicking it or that button opens its actions
 * menu (the action and Mark unread), which takes focus and closes on Escape. `StandaloneMessage` is one named message on its own, such as a
 * thread's parent. In a message, `MessageBody` holds its rendered Markdown text, `Mention` an
 * `@name` in it, `CallChip` a command call
 * and its data, `DataToggle` its data folded away, and `ThreadSummary` a link to
 * its thread: its repliers' avatars, its reply count, how many replies are new (bold, after an accent dot and with how many are to the reader when any is) and when it was last replied to. `RepliesDivider` heads a thread's replies, `ChannelStart` says a
 * channel has nothing older, and `QuietButton` is a muted centred button,
 * such as loading older messages. `TextArea` takes focus when it first appears
 * if `focused`.
 *
 * `AppShell` is the page around the login view; `Card`, centred in a scrolling column, `CardHeader`,
 * `Heading` and `Muted` are a shadcn-style card and its title row, `CardBody`
 * a padded section under it; `LinkList` and
 * `LinkRow` are a named list of links, and `ItemList` and `ItemRow` a named
 * list of plain rows; `Alert` is a refusal, read out by screen readers;
 * `Notice` is a passing word on what just happened, read out politely;
 * `Skeleton` stands in while something loads. `Form` hands one field's value
 * to `onSubmit` without reloading the page; `TextField` is a labelled secret
 * input in it, such as a token, `TextArea` a labelled box to write in, such
 * as a reply, whose text and caret its owner holds, where Enter sends the form
 * and Shift+Enter starts a new line, and, while its owner is `choosing` from
 * suggestions, the arrow keys move the highlight, Enter or Tab picks it and
 * Escape closes the list;
 * `SubmitButton` sends it, and `SendButton` is its paper-plane icon form, named
 * and tooltipped by `label`; `Suggestions` is a named list of options to pick
 * from under a box, such as mentions or commands (each with any muted detail
 * after it), one of them highlighted, which leaves the box focused; it sits
 * in the overlay layer, above everything else in the pane.
 * `DataArea` is a labelled box to write JSON in, whose
 * text its owner holds. `PromptForm` is a named card in place of a message
 * box that asks for a command's data, titled, with a Cancel and a submit
 * button, its first field focused, and Escape anywhere in it calls
 * `onEscape`; in it `InputField` (text, a number or an
 * integer), `PickField` (one of a list, or none) and `CheckField` (a checkbox)
 * are labelled fields whose value their owner holds, each marked when
 * required, with its help text and any error under it, both read out as its
 * description.
 */
export { ActionGroup } from "./lib/action-group.tsx";
export { Alert } from "./lib/alert.tsx";
export { ButtonRow } from "./lib/button-row.tsx";
export { TokenText } from "./lib/token-text.tsx";
export { CallChip } from "./lib/call-chip.tsx";
export { ChannelStart } from "./lib/channel-start.tsx";
export { DataToggle } from "./lib/data-toggle.tsx";
export { MessageBody } from "./lib/message-body.tsx";
export { MessageItem } from "./lib/message-item.tsx";
export { MessageList } from "./lib/message-list.tsx";
export { QuietButton } from "./lib/quiet-button.tsx";
export { RepliesDivider } from "./lib/replies-divider.tsx";
export { ThreadSummary } from "./lib/thread-summary.tsx";
export { StandaloneMessage } from "./lib/standalone-message.tsx";
export { AppShell } from "./lib/app-shell.tsx";
export { BoxFrame } from "./lib/box-frame.tsx";
export { Button } from "./lib/button.tsx";
export { Card } from "./lib/card.tsx";
export { CheckField } from "./lib/check-field.tsx";
export { CardBody } from "./lib/card-body.tsx";
export { CardHeader } from "./lib/card-header.tsx";
export { ChoiceGroup } from "./lib/choice-group.tsx";
export { DataArea } from "./lib/data-area.tsx";
export { Feed } from "./lib/feed.tsx";
export { FeedHeading } from "./lib/feed-heading.tsx";
export { FeedList } from "./lib/feed-list.tsx";
export { FeedNote } from "./lib/feed-note.tsx";
export { FeedRow } from "./lib/feed-row.tsx";
export { FeedText } from "./lib/feed-text.tsx";
export { Form } from "./lib/form.tsx";
export { LineForm } from "./lib/line-form.tsx";
export { Heading } from "./lib/heading.tsx";
export { InputField } from "./lib/input-field.tsx";
export { ItemList } from "./lib/item-list.tsx";
export { ItemRow } from "./lib/item-row.tsx";
export { LinkList } from "./lib/link-list.tsx";
export { LinkRow } from "./lib/link-row.tsx";
export { Mention } from "./lib/mention.tsx";
export { Muted } from "./lib/muted.tsx";
export { Notice } from "./lib/notice.tsx";
export { HeadingButton } from "./lib/heading-button.tsx";
export { NavHeading } from "./lib/nav-heading.tsx";
export { NavLink } from "./lib/nav-link.tsx";
export { NavList } from "./lib/nav-list.tsx";
export { Pane } from "./lib/pane.tsx";
export { PaneHeader } from "./lib/pane-header.tsx";
export { Page } from "./lib/page.tsx";
export { PageSection } from "./lib/page-section.tsx";
export { FooterLink } from "./lib/footer-link.tsx";
export { PressButton } from "./lib/press-button.tsx";
export { PickField } from "./lib/pick-field.tsx";
export { Pill } from "./lib/pill.tsx";
export { PromptForm } from "./lib/prompt-form.tsx";
export { SidePanel } from "./lib/side-panel.tsx";
export { ScrollArea } from "./lib/scroll-area.tsx";
export { Sidebar } from "./lib/sidebar.tsx";
export { SidebarBody } from "./lib/sidebar-body.tsx";
export { SidebarFooter } from "./lib/sidebar-footer.tsx";
export { Skeleton } from "./lib/skeleton.tsx";
export { Suggestions } from "./lib/suggestions.tsx";
export { SendButton } from "./lib/send-button.tsx";
export { SubmitButton } from "./lib/submit-button.tsx";
export { Tag } from "./lib/tag.tsx";
export { TextArea } from "./lib/text-area.tsx";
export { TextField } from "./lib/text-field.tsx";
export { Workspace } from "./lib/workspace.tsx";
export { WorkspaceMain } from "./lib/workspace-main.tsx";
export { WorkspaceColumn } from "./lib/workspace-column.tsx";
export { StatusBar } from "./lib/status-bar.tsx";
export { IdentityLink } from "./lib/identity-link.tsx";
export { Chip } from "./lib/chip.tsx";
export { DateText } from "./lib/date-text.tsx";
export { FilterField } from "./lib/filter-field.tsx";
export { IdentityRow } from "./lib/identity-row.tsx";
export { ListArea } from "./lib/list-area.tsx";
export { Profile } from "./lib/profile.tsx";
export { ProfileName } from "./lib/profile-name.tsx";
export { Toolbar } from "./lib/toolbar.tsx";
