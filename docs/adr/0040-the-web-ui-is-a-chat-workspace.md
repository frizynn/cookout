# The web UI is a chat workspace

2026-11-23: Matt confirmed all three assumptions below (mattpocock/cookout#134).

2026-11-23 (mattpocock/cookout#97). The layout is Matt's choice; the three assumptions below are proposed, pending Matt.

On 2026-11-23 Matt picked layout A of the throwaway layout prototype (round 2) for the web UI. Until then each route was one centred card, dark and monospace throughout. The web UI is now a chat workspace:

- A sidebar, always shown on wide screens: the cookout's name, the Inbox (with its total unread count, in the unread colour when any item is a mention), People & agents, every channel by name (bold when unread, with its mention count as a pill), and the logged-in human with a Settings button. Its panel holds the System / Light / Dark theme switch, kept in the browser and applied before the first paint.
- The open channel in the main pane, with its header, its messages kept scrolled to the newest unless the person scrolled up, and the message box pinned at the bottom.
- A thread in a panel beside its channel, not on its own page; a thread's address opens the channel with the panel open.
- Under 768 px the sidebar collapses behind a button and the thread panel takes the whole width.
- Avatars coloured from the name (one of eight hues, the lightness and chroma from theme tokens): a circle for a human, a rounded square with a badge for an agent.
- A Vercel-like neutral look with small pops of colour, in light and dark themes that are design-system tokens.

_Assumptions_ the chief of staff recorded, pending Matt:

1. **Sans text, mono times and channel names.** Message text and the UI are sans; only times and channel names are mono. Story 60 asked for monospace throughout; the prototype Matt picked is sans.
2. **Enter picks the highlighted suggestion.** In a message box Enter sends and Shift+Enter starts a new line, but while the `@` suggestions show, Enter picks the highlighted one (the arrow keys move it) instead of sending, as Slack does.
3. **The app opens on the Inbox.** `#/`, and the page right after logging in, show the Inbox, not a channel list: the sidebar lists the channels on every page.

## Considered options

- Variants B, C and D of the prototype: not chosen by Matt.
- Keep a channel-list page at `#/`: dropped, since the sidebar shows the same list everywhere.

## Consequences

- The routes and the `paths` module stay the one owner of addresses: `#/` and `#/inbox` are the Inbox, `#/people` is the People & agents route (it says "Nothing here" until its own ticket).
- The theme choice, whether the Settings panel is open and whether the narrow sidebar is open live in the `layout` store, as all web state lives in external stores.
- The page's strict CSP (no inline script or style) holds: the theme is applied before the first paint by `public/assets/theme.js`, and avatar colours are classes, not inline styles.
- The channel, thread, inbox and People & agents screens get restyled in their own tickets.
