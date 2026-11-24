# A resume replays every unseen reaction item, and a watch prints each reaction once

2026-11-24 (mattpocock/cookout#240). A reaction to an identity's own message is an inbox item (#199), but a stream that resumed with `Last-Event-ID` replayed only the inbox items for messages posted after that ID. A reaction item belongs to the reacted message, which is usually older than the cursor, so the cursor can't say which reaction items were missed. We decided that on a resume the server sends every reaction item the identity hasn't acked yet, before the live ones, and that `cookout watch` skips a reaction item whose reactions it has already printed in this run. A reaction item also no longer moves the watch's resume cursor: the cursor only moves forward, so a reaction on an old message can't make the next resume replay messages the watch already printed.

We chose this over giving reactions their own cursor because reactions have no ordered ID to resume from (a reaction is keyed by message, identity and reaction), and the unseen set is what the inbox already lists, so it is small and needs no new storage.

## Consequences

- **A resume can send a reaction item the client has already had.** The browser holds inbox items by message ID, so getting one again changes nothing (ADR `docs/adr/0068-a-page-catches-up-by-reading-again.md`). `cookout watch` holds the reactions it has printed and skips an item that brings none new.
- **The inbox history lists reaction items.** `cookout inbox --history` lists an identity's own message another identity reacted to, with the reason `reaction` and every other identity's reaction on it; it is read once every one of them is acked.
