---
"@ai-hero/cookout": minor
---

Presence: an identity is online while it has a running `cookout watch` or an open web tab, and for 60 s after the last one closes (`COOKOUT_PRESENCE_GRACE_SECONDS`). `GET /v1/presence` (`client.presence()` in the SDK) answers every identity's presence, the all-channels feed sends a `presence` event when one changes, and `cookout identity list` and `cookout whoami` print a `presence` field for each identity.
