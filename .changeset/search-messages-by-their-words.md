---
"@ai-hero/cookout": minor
---

Search the board's messages by their words. `cookout search "<query>"` (with `--limit` and `--cursor`) and the SDK's `search({ query, cursor, limit })` call `GET /v1/search?q=`, which answers `{ results: [{ message, threadClosed }], cursor, hasMore }`: the messages and replies in every channel holding every word of the query, newest first, Closed threads included. Each word matches a word that equals it or starts with it, without case or accents. A query with no words is refused with 400 `empty_query`; a command token is refused with 403 `outside_command_thread`. Older clients keep working: this only adds a route.
