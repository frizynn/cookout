/**
 * The design system's content: text, names, avatars, lists and live regions (`layout.tsx` has the design system as a whole).
 *
 * - `Pill` is a count read out by its label, loud (the unread colour), quiet, or unseen (read out only).
 * - A name's avatar is its coloured initials, one of eight hues hashed from the name, a circle for a human and a rounded square for an agent, with its `PresenceDot` in the corner once its presence is known.
 * - `PresenceDot` is filled in the online colour while online, a hollow grey ring while offline, a ring in the accent with a dot in its middle for the owner's warning ("Offline, went offline unexpectedly"), named for a screen reader and as a tooltip ("Offline, last seen 5 minutes ago"), as a `Suggestions` option shows it beside the name.
 * - `Author` is a message's avatar and name (a display name, with the `@name` muted beside it), with an `agent` tag for an agent.
 * - `Tag` is one such small tag, such as `admin`.
 * - `IdentityLink` is the logged-in identity's avatar and name as a link, highlighted when open.
 * - `IdentityRow` is a link to an identity, with its avatar, name, any tags and a muted detail line, highlighted when open.
 * - `Profile` is one identity's large avatar beside its `ProfileName` and its details.
 * - `ProfileName` is an identity's name and any tags, as a heading.
 * - `DateText` is a moment as a date, in mono.
 * - `QuietLink` is a muted link in such a line, such as a name linking to its profile.
 * - `Heading` is part of the card's title row.
 * - `Muted` is too.
 * - `MutedLines` is muted text that keeps its line breaks.
 * - `LinkList` is a named list of links, each a `LinkRow`.
 * - `LinkRow` is one link in a `LinkList`.
 * - `ItemList` is a named list of plain rows, each an `ItemRow`.
 * - `ItemRow` is one plain row in an `ItemList`.
 * - `Alert` is a refusal, read out by screen readers.
 * - `Announcement` is a polite live region (its text again as its count moves).
 * - `Notice` is a passing word on what just happened, read out politely.
 * - `Skeleton` stands in while something loads.
 *
 * Wherever an identity has a display name (`IdentityLink`, `IdentityRow`, `ProfileName`, a `Suggestions` option's muted detail) it shows first and the `@name` muted beside it.
 */
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
