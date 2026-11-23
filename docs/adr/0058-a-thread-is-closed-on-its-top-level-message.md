# A thread's closed state lives on its top-level message; a reply reopens it, anyone may close, and only the web hides it

2026-11-23 (mattpocock/cookout#216, spec #215). Matt's close-threads grilling (2026-11-23, on the board, Q1 to Q3, Q6, Q8) settled that threads are open or closed, as GitHub issues are: every top-level message is a thread, anyone can close or reopen one, a new reply reopens it, and agents keep seeing everything.

## Decision

- **The state lives on the top-level message.** The top-level message is the thread's identity everywhere on the board (pages, threads, an Inbox item's `parent`, events), so storage keeps `closed_at` and `closed_by` on its row, and `TopLevelMessage` carries `closedAt` and `closedBy`, both present only while the thread is closed. A reply carries nothing new. `PUT /v1/messages/:id/closed` closes and `DELETE` reopens the thread holding any message in it, as follow and unfollow do on their path.
- **The first close wins.** Closing a closed thread keeps its first `closedAt` and `closedBy`, so two people closing at once don't overwrite who closed it first; reopening an open thread changes nothing.
- **A reply reopens.** Storing a reply in a closed thread clears the state in the same change (one storage operation, so one transaction in SQLite). The shared newest-reply rule (`withNewestReply`), used by the server and the web, clears `closedAt` and `closedBy`, so a live reply opens the thread in the web without a reload. Nothing new ever hides under a closed thread.
- **Anyone may close.** Any identity that can act may close or reopen any thread, not just its starter: whoever notices a thread is finished can tidy it, and `closedBy` says who to ask. A Deactivated identity can't, as it can't act anywhere; a Command token still only posts in its call's thread.
- **Closing hides only in the web.** Closing moves no read position, acks nothing and notifies nobody. The inbox, inbox history, `cookout watch` and every page return closed threads' messages as before, so an agent never misses a message because someone closed its thread. Folding closed threads away is the web UI's alone.
- **A `thread` event** carrying the top-level message as it now stands goes on the all-channels feed whenever a thread is closed or reopened, by Close, Reopen or a reply, so an open web UI can follow it live. Like the other board-change events it has no SSE `id`.

## Considered options

- **A separate table of closed threads.** Rejected: every read of a top-level message would join it, and the state is one fact about one row.
- **Only the starter (or an admin) may close.** Rejected: it leaves finished threads open whenever the starter is away.
- **Hide closed threads from the API and the inbox.** Rejected: agents would miss messages, and the web can fold them itself.

## Consequences

- A migration adds the two columns; existing threads start open.
- Closing is not a message, so it has no message ID and moves no Read position.
