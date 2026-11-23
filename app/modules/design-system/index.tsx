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
 * with its `SidebarBody` of links (following one closes it on a narrow screen)
 * and its `SidebarFooter`, and a `WorkspaceMain` of the route's panes on the
 * right. In the sidebar, `NavLink` is one link, bold when
 * it has something new (`marked`), highlighted when it is the open item, with
 * an icon and any `Pill` after it: a count read out by its label, loud (the
 * unread colour), quiet, or unseen (read out only); `NavHeading` heads a
 * `NavList` of links; `ToggleButton` opens and closes a `Panel` above it,
 * such as Settings, where `ChoiceGroup` picks one of a few choices. `Pane` is
 * the main column, with a `PaneHeader` (title, description and any action on
 * its right, such as a `PressButton`, a button that is on or off), a
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
 * saving) and anything under it, such as an `Alert`.
 * `PaneHeader`'s title is mono, as a channel's name, unless `sans`. A
 * `Toolbar` under it holds a `FilterField` (a labelled box whose text its
 * owner holds) and `Chip`s, buttons pressed or not; a named `ListArea` scrolls
 * from the top, and its `IdentityRow`s are links to identities, each with
 * its avatar, name, any tags and a muted detail line, highlighted when open.
 * `Profile` is one identity's large avatar beside its `ProfileName` (its
 * name and any tags, as a heading) and its details; `DateText` is a moment as a date, in mono.
 *
 * `AppShell` is the page around the login view; `Card`, centred in a scrolling column, `CardHeader`,
 * `Heading` and `Muted` are a shadcn-style card and its title row, `CardBody`
 * a padded section under it; `LinkList` and
 * `LinkRow` are a named list of links, and `ItemList` and `ItemRow` a named
 * list of plain rows; `Article` is one named item shown on its own, such as a
 * thread's parent message; `Alert` is a refusal, read out by screen readers;
 * `Skeleton` stands in while something loads. `Form` hands one field's value
 * to `onSubmit` without reloading the page; `TextField` is a labelled secret
 * input in it, such as a token, `TextArea` a labelled box to write in, such
 * as a reply, whose text and caret its owner holds, where Enter sends the form
 * and Shift+Enter starts a new line, and, while its owner is `choosing` from
 * suggestions, the arrow keys move the highlight and Enter picks it;
 * `SubmitButton` sends it; `Suggestions` is a named list of options to pick
 * from under a box, such as mentions, one of them highlighted, which leaves
 * the box focused; `Button` is any other button. `FieldsForm` is a form of
 * several fields, `Select` a labelled pick in it from its `SelectOption`s,
 * `DataArea` a labelled box in it to write JSON in, whose text its owner
 * holds, and `DataBlock` a named block of JSON, such as a message's data.
 * `RowTitle` is a link row's title line, bold when it has something new
 * (`marked`), with any `Count` after it: a small number badge read out by its
 * label, such as a channel's unread messages (`plain`) or its mentions
 * (`mention`, which stands out).
 */
export { Alert } from "./lib/alert.tsx";
export { AppShell } from "./lib/app-shell.tsx";
export { Article } from "./lib/article.tsx";
export { Author } from "./lib/author.tsx";
export { BoxFrame } from "./lib/box-frame.tsx";
export { Button } from "./lib/button.tsx";
export { Card } from "./lib/card.tsx";
export { CardBody } from "./lib/card-body.tsx";
export { CardHeader } from "./lib/card-header.tsx";
export { ChoiceGroup } from "./lib/choice-group.tsx";
export { Count } from "./lib/count.tsx";
export { DataArea } from "./lib/data-area.tsx";
export { DataBlock } from "./lib/data-block.tsx";
export { FieldsForm } from "./lib/fields-form.tsx";
export { Form } from "./lib/form.tsx";
export { LineForm } from "./lib/line-form.tsx";
export { Heading } from "./lib/heading.tsx";
export { ItemList } from "./lib/item-list.tsx";
export { ItemRow } from "./lib/item-row.tsx";
export { LinkList } from "./lib/link-list.tsx";
export { LinkRow } from "./lib/link-row.tsx";
export { Muted } from "./lib/muted.tsx";
export { NavHeading } from "./lib/nav-heading.tsx";
export { NavLink } from "./lib/nav-link.tsx";
export { NavList } from "./lib/nav-list.tsx";
export { Pane } from "./lib/pane.tsx";
export { PaneHeader } from "./lib/pane-header.tsx";
export { PressButton } from "./lib/press-button.tsx";
export { Panel } from "./lib/panel.tsx";
export { Pill } from "./lib/pill.tsx";
export { RowTitle } from "./lib/row-title.tsx";
export { Select } from "./lib/select.tsx";
export { SelectOption } from "./lib/select-option.tsx";
export { SidePanel } from "./lib/side-panel.tsx";
export { ScrollArea } from "./lib/scroll-area.tsx";
export { Sidebar } from "./lib/sidebar.tsx";
export { SidebarBody } from "./lib/sidebar-body.tsx";
export { SidebarFooter } from "./lib/sidebar-footer.tsx";
export { Skeleton } from "./lib/skeleton.tsx";
export { Suggestions } from "./lib/suggestions.tsx";
export { SubmitButton } from "./lib/submit-button.tsx";
export { TextArea } from "./lib/text-area.tsx";
export { TextField } from "./lib/text-field.tsx";
export { ToggleButton } from "./lib/toggle-button.tsx";
export { Workspace } from "./lib/workspace.tsx";
export { WorkspaceMain } from "./lib/workspace-main.tsx";
export { IdentityLink } from "./lib/identity-link.tsx";
export { Chip } from "./lib/chip.tsx";
export { DateText } from "./lib/date-text.tsx";
export { FilterField } from "./lib/filter-field.tsx";
export { IdentityRow } from "./lib/identity-row.tsx";
export { ListArea } from "./lib/list-area.tsx";
export { Profile } from "./lib/profile.tsx";
export { ProfileName } from "./lib/profile-name.tsx";
export { Tag } from "./lib/tag.tsx";
export { Toolbar } from "./lib/toolbar.tsx";
