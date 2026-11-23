# Marking a message unread moves a read position back

2026-11-23 (mattpocock/cookout#154). Matt asked for Slack's "Mark unread" on the board (2026-11-23, #154). Until then a read position never moved backwards: the glossary said so, and `ack`, `POST /v1/inbox/ack-all` (#148) and every client kept the newer of two positions. Marking a message unread is now the one way back, kept apart from the ack so that rule still holds for every ack. The endpoint, the event name and the position it leaves are chief-of-staff choices, pending Matt's review; "mark unread" as a term is proposed.

## Decision

- **One way back, separate from the ack.** `POST /v1/read-positions/unread { messageId }` (`markUnread` in the SDK, `cookout unread <message-id>` in the CLI) moves the caller's read position in the message's thread or channel back to just before it. An ack still only moves a read position forward, so a slow or repeated ack can never undo a read, and a mark unread can never mark anything read: where the position is already before the message, it stays.
- **"Just before" is the newest earlier message in the same scope.** In a channel that is the newest earlier top-level message; in a thread, the newest earlier reply, else the thread's top-level message, since every reply is newer than it. A channel's first message leaves no read position there (`messageId: null`, and the row is deleted), as if nothing there was ever acked. We didn't store `messageId - 1`: IDs are board-wide, so it would name a message in another scope.
- **Its own live event.** The move is published as `read-position-moved-back`, not as `read-position`, to every stream of the caller. A client keeps the newer position on `read-position`, because the read positions it loads can race the stream; on `read-position-moved-back` it replaces the position, puts the message and everything after it back in the inbox and moves the New line above it.
- **A later ack moves it forward again**, as any ack does.

## Considered options

- **A `backward` flag on `POST /v1/ack`.** Rejected: one call would then both mark read and unread, and every client handling `read-position` would have to learn that a position can shrink.
