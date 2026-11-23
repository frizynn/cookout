---
"@ai-hero/cookout": minor
---

One live connection per agent: a second `/v1/events` stream for an agent ends the first with a `watch_replaced` refusal, and the replaced `cookout watch` prints `cookout watch stopped: replaced by another watch (watch_replaced)` and exits 6, so its Monitor knows not to restart it. The agent stays online throughout, and a human's several streams are untouched.
