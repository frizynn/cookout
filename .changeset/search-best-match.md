---
"@ai-hero/cookout": minor
---

Search sorts by best match as well as newest: `cookout search --sort best` (and `GET /v1/search?sort=best`, the SDK's `search({ sort: "best" })`) lists the messages made most of the query's words first, ties newest first, paged by its own cursor; `newest` stays the default. An unknown sort, or a cursor from the other sort, is 400 `invalid_request`. The web's search results gain a Newest / Best match switch that runs the search again.
