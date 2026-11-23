# Every confirmation is one dialog, on Radix's AlertDialog

2026-11-23 (mattpocock/cookout#176). Matt asked on the board (2026-11-23) for "a much nicer modal, kind of maybe using Shadcn, for various actions like confirmations, deletions, deactivations". Until then each confirmation was its own inline component under the buttons (`deactivate-confirm.tsx`, `delete-confirm.tsx`), and rotate, revoke, reactivate and transfer ran on the first click. We adopt shadcn's AlertDialog, built on `@radix-ui/react-alert-dialog`, as the design system's one `ConfirmDialog`, and every identity action in the web UI asks through it.

## Decision

- **Radix does the behaviour.** A modal dialog has to trap focus, close on Escape, give focus back to what opened it, hide the rest of the page from screen readers and carry the `alertdialog` role with its title and body as its name and description. Radix's AlertDialog does all of that and is what shadcn's AlertDialog is built on; we copy shadcn's shape (overlay, centred content, title, description, Cancel and an action) into `app/modules/design-system` and style it with the app's own tokens, so it follows the light and dark themes like every other part. This is the first Radix dependency: [ADR 0034](0034-the-design-system-is-hand-written-and-shadcn-styled.md) kept the plain elements hand-written because Radix bought them nothing, and a modal dialog is where it does. The other components stay hand-written.
- **AlertDialog only.** shadcn also has Dialog; nothing in the web UI needs a dialog that isn't a confirmation yet, and knip would flag an unused one. One dependency is added: `@radix-ui/react-alert-dialog`.
- **One owner.** `ConfirmDialog` takes a title, a body naming exactly what happens, the confirm button's label, whether the action can't be undone (the confirm button is then in the destructive colour), `pending` and an `error`. Its owner holds whether it is open: it stays open while the action runs (both buttons disabled, Escape ignored) and when the server refuses (the refusal inside it), and closes only once the action succeeds or on Cancel or Escape. It never closes silently. The body is one string, so a caller can add a warning to it, such as the handler identity's (#198).
- **Focus goes back by hand.** Radix gives focus back to its own Trigger, and a confirmation is opened by buttons elsewhere in the page (Rotate token, Deactivate, a Transfer form), so `ConfirmDialog` remembers what had focus when it opened and focuses it again on close, if it is still on the page.
- **Seams.** `radix-only-in-design-system` in `.dependency-cruiser.cjs` fails any `@radix-ui/` import outside `app/modules/design-system/`, and `no-restricted-globals` (`confirm`) with `no-restricted-properties` (`window.confirm`, `globalThis.confirm`) fail the browser's own confirm everywhere. Each has a canary in `lint/canary/`.

## Considered options

- **Keep the inline confirms.** Rejected: Matt asked for a modal, and each inline confirm handled pending and refusal its own way, or not at all.
- **`window.confirm`.** Rejected: it can't be styled or themed, can't show a pending state or an error, and blocks the page.
- **A hand-written modal on `<dialog>`.** Rejected: focus return, hiding the rest of the page and the alertdialog semantics would all be ours to get right and test, where Radix already has them tested.
- **Headless UI or React Aria.** Rejected: shadcn, which the design system already follows, is built on Radix.

## Consequences

- A later confirmation (delete channel, rotate command secret, leave) uses `ConfirmDialog`; none of them exist in the web UI yet.
- Opening the dialog hides the rest of the page from screen readers, so a route test looks up what is behind it only once it closes.
