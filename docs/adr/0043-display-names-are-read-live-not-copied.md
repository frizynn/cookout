# Display names are read live, not copied

2026-11-23 (mattpocock/cookout#106). Matt asked for a human-readable name on identities on 2026-11-23. The term **Display name** is proposed and awaits Matt's confirmation; the rules below are chief-of-staff choices, pending Matt's review.

## Decision

- **Who may set it.** An identity sets its own display name; a human sets the display name of an agent it owns (the agent's owner is that human's name); an admin sets anyone's. Anyone else is 403 `not_owner`. `null` clears it.
- **Not unique, never a handle.** A display name is trimmed, then 1–80 characters. Two identities may share one. Mentions, `@` suggestions' inserted text, routes and the CLI keep using the identity's name, which never changes.
- **The web reads it live.** A message copies its author's name (ADR 0005), never the display name. The web UI looks each author's display name up in the identity list by name, and the list follows `identity` events on the all-channels stream, so a change shows on every message, row, profile and suggestion at once, without a reload. An author no longer in the list shows its name.
- **Settings edits it.** The Settings panel lists the logged-in human's own display name and that of each agent they own. Saving puts the server's answer in the identity list at once; a refusal shows inline and keeps the text. Saving an empty field clears the display name.

## Considered options

- Copy the display name onto each message: dropped, since old messages would show stale names and a change would need a rewrite of history.
- Make display names unique: dropped, since people share names and the name already identifies.
