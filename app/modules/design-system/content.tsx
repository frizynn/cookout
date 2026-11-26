/**
 * The design system's content: text, names, avatars, lists and live regions (`layout.tsx` has the design system as a whole).
 *
 * - `Pill` is a count read out by its label, loud (the unread colour), quiet, or unseen (read out only).
 * - A name's avatar is its picture, from the nearest `AvatarImages` source, named by its display name; or, when it has none or the picture fails to load, its coloured initials, one of eight hues hashed from the name, for a human, or for an agent a robot drawn from its name. It is a circle for a human and a rounded square for an agent, with its `PresenceDot` in the corner once its presence is known. Every avatar of a name (a message's, a row's, a profile's, a mention suggestion's, an identity card's tile) shows the same picture, and a new one as soon as the source has it.
 * - `AvatarImages` is the source of avatar pictures the views provide, by name; with none, every human avatar shows its initials and every agent its robot.
 * - `PresenceDot` is filled in the online colour while online, a hollow grey ring while offline, a ring in the accent with a dot in its middle for the owner's warning ("Offline, went offline unexpectedly"), named for a screen reader and as a tooltip ("Offline, last seen 5 minutes ago"), as a `Suggestions` option shows it beside the name.
 * - `Author` is a message's avatar and name (a display name, with the `@name` muted beside it), with an `agent` tag for an agent.
 * - `Tag` is one such small tag, such as `admin`.
 * - `IdentityLink` is the logged-in identity's avatar and name as a link, highlighted when open.
 * - `IdentityRow` is a link to an identity, with its avatar, name, any tags and a muted detail line, highlighted when open.
 * - `Profile` is one identity's large avatar beside its first part, a `ProfileHead`, with every later part (its fields and actions) below at full width. With an `edit`, the avatar is a button named by its `label` that calls `onEdit`, with a pencil at its corner: on hover or focus with a mouse, always on a touch screen.
 * - `ProfileHead` holds a profile's `ProfileName` and the facts under it.
 * - `ProfileName` is an identity's name and any tags, as a heading. With an `edit`, a pencil button named by its `label` that calls `onEdit` follows the heading, outside it, so the heading's name stays the identity's: shown on hover or focus with a mouse, always on a touch screen.
 * - `ProfileSection` is one group of a profile's fields or actions, ruled off from the group above; with nothing in it, it isn't shown.
 * - `DateText` is a moment as a date, in tabular figures.
 * - `QuietLink` is a muted link in such a line, such as a name linking to its profile.
 * - `Heading` is part of the card's title row.
 * - `Muted` is too.
 * - `MutedLines` is muted text that keeps its line breaks.
 * - `LinkList` is a named list of links, each a `LinkRow`.
 * - `LinkRow` is one link in a `LinkList`.
 * - `ItemList` is a named list of plain rows, each an `ItemRow`.
 * - `ItemRow` is one plain row in an `ItemList`.
 * - `CurrentItemRow` is an `ItemRow` that is highlighted, and marked `aria-current`, while `current`, such as the schedule a post's marker opened.
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
  CurrentItemRow,
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
  ProfileHead,
  ProfileName,
  ProfileSection,
  AvatarImages,
} from "./lib/content.ts";
export type { AvatarImage, AvatarImageSource } from "./lib/avatar-parts.ts";
export type { EditAction } from "./lib/edit-action.ts";
