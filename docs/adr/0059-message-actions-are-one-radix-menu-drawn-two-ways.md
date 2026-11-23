# Message actions are one Radix menu, drawn two ways

2026-11-23 (mattpocock/cookout#210). Matt said on the board (2026-11-23) that right-clicking a message opened its Reply / Mark unread menu away from the cursor: "What we need is the proper shadcn style action menu." The menu #154 built was hand-written: one absolutely placed list under the message's top-right corner, opened by right-click or the More actions button, with its own Escape handling, focus and open state held in the unread store.

## Decision

- **Radix does the behaviour, as for the confirmation dialog.** We adopt shadcn's ContextMenu and DropdownMenu, on `@radix-ui/react-context-menu` and `@radix-ui/react-dropdown-menu`, inside `app/modules/design-system`, styled with the app's own tokens like `ConfirmDialog` ([ADR `every-confirmation-is-one-radix-alert-dialog`](0058-every-confirmation-is-one-radix-alert-dialog.md)). Right-clicking a message opens the context menu at the pointer, flipping to stay inside the window near its edges; the More actions button opens the dropdown under it. Radix gives both the keyboard (arrow keys, Enter, Escape, typeahead) and focus behaviour.
- **One menu definition.** `useMessageChoices` lists a message's actions once (its action, such as Reply, then Mark unread); both menus draw that list through one `MenuChoice`. Later actions (the 👍/👎 reactions of #200) are added there and show in both.
- **Radix holds whether a menu is open.** Radix's ContextMenu can't be opened from outside, so the unread store no longer tracks which message's menu is open: its `menu` keeps only Mark unread and the last refusal.
- **A chosen action runs once the menu has closed.** The open menu traps focus and, on closing, focuses its trigger again, which undid Reply's focusing of the reply box. So a chosen item's action runs after Radix has given focus back: an action that moves focus keeps it, and one that doesn't (Mark unread) leaves focus on the trigger.
- **Seams.** `radix-only-in-design-system` already fails every `@radix-ui/` import outside `app/modules/design-system/`; its canary now imports the two menus too.

## Considered options

- **Fix the hand-built menu's position.** Rejected: placing it at the pointer and keeping it inside the window, plus the menu keyboard pattern, is what Radix already has tested.
- **Hold open state in the store and control both menus.** Rejected: ContextMenu has no `open` prop, and nothing outside a menu needs to know it is open.
