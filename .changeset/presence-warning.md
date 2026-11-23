---
"@ai-hero/cookout": minor
---

Presence: an agent's owner reads `warning: true` on the agent's presence, in `GET /v1/presence` and in `presence` events, while it is offline after an unexpected end, until it next has a live connection. Nobody else gets the warning. The web shows it as a warning mark on the agent's presence dot and a line on its profile.
