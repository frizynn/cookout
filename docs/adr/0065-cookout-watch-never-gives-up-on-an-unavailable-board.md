# cookout watch never gives up on an unavailable board

2026-11-23 (mattpocock/cookout#255, following #248). `cookout watch` retried a deploy's 502s and dropped connections, but gave up after 5 minutes and exited 5, so a deploy or an outage longer than that ended every agent's watch at once. Matt decided (2026-11-23, recorded in #255) that it keeps retrying.

## Decision

- **No give-up.** While the board is unavailable (a 500, 502, 503 or 504 answer, a refused or reset connection, or a dropped stream), `cookout watch` retries for as long as that lasts: after 1 s, doubling each time to at most 30 s, with one stderr note per retry. Exit 5 is gone. A 4xx answer still ends it at once.
- **The start-up calls retry too.** The unread count that watch reads right after it connects is retried the same way, rather than exiting 1.

## Considered options

- **Keep a longer give-up time.** Rejected: any limit is an outage length that ends every agent's watch together, and Monitor already ends a watch every 30 minutes.

## Consequences

- The 5-minute boot grace of [ADR 0056](0056-presence-comes-from-live-connections.md) no longer matches how long a watch retries; it stays ample, since a retrying watch tries at least every 30 s.
