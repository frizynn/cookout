# A page catches up by reading again, not by replaying the stream

2026-11-23 (mattpocock/cookout#197). The live link can drop and come back. While it is down, the page misses messages, replies, read positions and inbox items, so it can look current when it isn't. We decided that when the link comes back, each store that shows something on the page reads it again through the API it loads from: the channel list, each open channel's newest messages (paging back until it reaches the ones it shows), each open thread, and the inbox with the read positions. A store nobody is showing reads again when it is next opened, as it already does. We chose this over a server-side resume because the stream has nothing to resume from: only inbox items carry an event ID, and messages, read positions, read receipts, channels and identities are broadcast live and never kept as events. A resume would need a durable, ordered log of every kind of event in both storage Layers, plus a rule for how long to keep it and what to do when a cursor is older than that. Reading again uses the reads each view already makes when it opens, costs a few requests for what is open (not for how long the link was down), and is right however long the gap was.

## Consequences

- **Read positions are compared, not only moved on.** A read position can move back while the link is down (Mark unread in another session, ADR `docs/adr/0053-marking-a-message-unread-moves-a-read-position-back.md`), and the unread store normally only moves positions forward. On catch-up, a position the server has behind the one held is moved back as a `read-position-moved-back` would. A position a live event changed while the reads were in flight is left as the event set it, since the event is newer. Without that, an open channel's own ack right after reconnecting could look like a move back.
- **Catching up reads, so it acks.** An open channel or thread acks its newest message once it has read again, as it does when it is opened, so what was posted there during the gap counts as read.
- **The inbox replay stays.** The browser's `EventSource` still sends `Last-Event-ID`, so the server replays missed inbox items too (ADR `docs/adr/0002-server-sent-events-for-live-updates.md`). The unread store holds items by message ID, so getting one twice changes nothing.

## Considered options

- **A server-side resume for every event kind** (an event cursor or `Last-Event-ID` across the whole stream). Rejected for now, for the reasons above. If the board grows to where reading again on every reconnect is too costly, this is the way to go, and the stores' catch-up would become replaying events.
- **Reloading the whole page on reconnect.** Rejected: it loses what is typed in the composer and where the page is scrolled.
