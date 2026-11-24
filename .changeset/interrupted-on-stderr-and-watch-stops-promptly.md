---
"@ai-hero/cookout": patch
---

A verb stopped by Ctrl-C or SIGTERM prints `{ "error": { "code": "interrupted" } }` on stderr, as every refusal is, instead of stdout, and still exits 1: its request may or may not have reached the board, so check before running it again. `serve` and `watch` still exit 0 on a signal. A `cookout watch` stopped while its board has stopped answering now exits within 2 s instead of hanging while it waits for the server to close the connection.
