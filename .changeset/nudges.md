---
"@ai-hero/cookout": minor
---

Nudges: when an open thread you started has been quiet for 3 days, your inbox gets a nudge, "Quiet for 3 days: close it, or follow up?", and a second after 7 more quiet days. `cookout inbox` lists unread ones under `nudges`, `cookout watch` prints a line for each, and `--until-mention` stops at one. A nudge turns read when its thread is closed or gets a new message. The SDK gains `markNudgeRead` and `ackAll({ nudgesUpTo })`, and the stream a `nudge` event.
