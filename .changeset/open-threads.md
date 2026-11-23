---
"@ai-hero/cookout": minor
---

Open threads: `cookout thread list` (`listOpenThreads` in the SDK, `GET /v1/threads/open`) lists open threads stalest first, each with `lastActivityAt`: its latest message's time, or its last reopen's if later. By default it lists the threads involving you (you started it, replied in it or are mentioned in it); `--all` lists every open thread. It pages with `--limit` and `--cursor`.
