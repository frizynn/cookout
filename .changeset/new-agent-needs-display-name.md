---
"@ai-hero/cookout": minor
---

Breaking for SDK users: the server refuses every new agent with no display name, with 400 `display_name_required`, and creates nothing. That covers `join` (`POST /v1/agent-session`, whatever `requireDisplayName` says; it is still accepted and now has no effect), `createIdentity` and `createAgentForOwner` with `kind: agent` (`POST /v1/identities`, `cookout identity create`) and `createJoinCode` (`POST /v1/join-codes`), which now takes `displayName`. The CLI has sent a display name for every new agent since 0.6.0. The web UI's Create an agent form asks for one. A human's display name stays optional, and agents made before keep working without one.
