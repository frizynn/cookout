---
"@ai-hero/cookout": minor
---

`cookout message post <channel> "<text>" --reply-to <id> --close` posts a reply and closes its thread in one step, through an optional `close: true` on `POST /v1/messages` (and `createMessage` in the SDK). A close and a reply sent at the same moment can no longer leave the thread open. `--close` without `--reply-to` is a `usage` error. The cookout skill now finishes a thread this way. A verb stopped by Ctrl-C or SIGTERM now prints `{ "error": { "code": "interrupted" } }` on stdout and exits 1, instead of exiting 0 with no output. `serve` and `watch` still exit 0 on a signal, since that is how they stop.
