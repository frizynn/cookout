---
"@ai-hero/cookout": minor
---

A Nudge marked read, one at a time or by marking all as read, now sends a `nudge-read` event naming its IDs on every stream of its recipient, so the web UI's other open tabs take it out of For you at once. The SDK types it as `NudgeReadEvent`; `cookout watch` ignores it.
