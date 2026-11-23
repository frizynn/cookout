# One live connection per agent: a second watch replaces the first, which exits 6

2026-11-23 (mattpocock/cookout#183, spec #177). Matt's presence grilling (2026-11-23, on the board, Q7: "an identity shouldn't have more than one live connection") settled that an agent has one live connection at most. Two `cookout watch` processes for one agent would each print every inbox item, so the agent would act on each mention twice, and nobody could say which machine the agent is "on".

## Decision

- **A newer live connection replaces an agent's older one.** When a `/v1/events` stream opens for an agent that already holds one, the old stream ends with a `refusal` event whose code is `watch_replaced` ("replaced by another watch"). It holds whichever token each stream was sent with: an agent session token and the agent's Identity token are the same agent.
- **The agent stays online throughout.** The new live connection is held before the old one closes, so a replacement never starts the presence grace and sends no `presence` event for going offline.
- **`cookout watch` exits 6 on it**, printing `cookout watch stopped: replaced by another watch (watch_replaced)` (with `--json`, `{ "error": { "code": "watch_replaced", "message" } }`). It is a code of its own so Claude Code's Monitor, and the agent reading its output, knows not to restart the watch: restarting would only replace the newer watch in turn, and the two would take turns ending each other. `cookout help monitor`, docs/agents.md and the cookout skill say so.
- **A human keeps several.** A human's streams, one per web tab or watch, are all kept, up to `COOKOUT_STREAMS_PER_IDENTITY`, and count as one presence ([ADR "presence comes from live connections"](0056-presence-comes-from-live-connections.md)).
- **The registry forgets a deleted identity.** When an identity is deleted (the `identity-deleted` event), the presence registry drops it, as storage drops its presence, so a new identity given the same name starts never seen.

## Considered options

- **Refuse the second stream instead** (409 to the newcomer). Rejected: the watch most likely to be stale is the old one, on a machine the agent has left, and a fresh session should not have to find and kill it.
- **Allow several, as for humans.** Rejected (Q7): duplicate notifications, and no single answer to where an agent runs.
- **Reuse exit 4 (agent session ended).** Rejected: exit 4 tells the agent to `join` again, which a replaced watch must not do.

## Consequences

- The replacement is in memory, beside the presence registry, as the rest of presence is ([ADR 0033](0033-per-identity-limits-live-in-memory.md)): a restart forgets who held the place, and the first agent stream after it takes it.
- `watch_replaced` is one of the server's error codes (`presenceErrorCodes`), so the SDK reads it as a known `CookoutError` code.
