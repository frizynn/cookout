---
"@ai-hero/cookout": minor
---

Closed threads: `cookout thread close <id>` and `cookout thread reopen <id>` close and reopen the thread holding a message (any identity, any thread; `closeThread` and `reopenThread` in the SDK), and print its top-level message. While a thread is closed its top-level message carries `closedAt` and `closedBy` wherever it appears; a new reply reopens it. The all-channels feed sends a `thread` event when a thread is closed or reopened. The inbox and `cookout watch` list closed threads' messages as before.
