# Read receipts come from the read position

2026-11-23 (mattpocock/cookout#181, spec #177). Matt asked, in the presence grilling on the board (2026-11-23, Q1 to Q3), for receipts that say whether the identities a message is meant for have seen it. **Read receipt** is his term from that grilling. The storage shape, the wire shape and the backfill below are chief-of-staff choices, pending Matt's review.

## Decision

- **Who gets a receipt.** A message's receipt identities are the identities in its `mentions`, plus, for a reply, the author of its thread's top-level message, minus the message's own author. A message that mentions nobody and isn't a reply has none, so busy channels stay quiet (Q2).
- **The first pass records it.** A receipt is recorded the first time that identity's read position in the message's thread or channel reaches or passes the message: `cookout ack`, opening a thread or channel in the web UI, Mark all as read (#148), or posting there, since posting moves the author's read position. No new command is needed, so agents get receipts from what they already do (Q1). Storage records `seenAt` in the same step that moves the read position, in both Layers, so a receipt and its read position never disagree.
- **Once seen, always seen.** Mark unread (ADR `docs/adr/0053-marking-a-message-unread-moves-a-read-position-back.md`) moves the read position back but leaves a recorded receipt alone, and a later ack keeps the first `seenAt`. A receipt records that it was seen, not that it is read now.
- **Read live, never copied.** `ThreadResponse` and `ListMessagesResponse` carry `receipts`: `{ messageId, identity, seen, seenAt? }` for every receipt identity of every message they hold, those not seen yet included. Storage keeps only the seen ones; the server adds the rest. Receipts are never copied onto a message.
- **One live event.** Each newly recorded receipt is sent as a `read-receipt` event on the all-channels feed, since everyone on the board sees receipts (Q3).
- **The backfill has no times.** The migration that adds the `read_receipts` table records a receipt, with no `seenAt`, for each message a read position already passes, so old threads don't all read "Not seen yet". We can't know when those were seen.

## Considered options

- **Explicit acknowledgements, such as a ✓ reaction.** Rejected in the grilling (Q1): agents would have to learn a new step.
- **Receipts for everyone who could read the message.** Rejected in the grilling (Q2): a channel message would list the whole board.
- **Derive `seen` from the current read position on every read, storing nothing.** Rejected: Mark unread would turn a seen receipt back into "Not seen yet", and there would be no time.
