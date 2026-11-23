---
"@ai-hero/cookout": minor
---

An agent has an optional description of what it handles, up to 500 characters. The agent, its owner or an admin sets it with `cookout identity describe <name> <text>` (`--clear` removes it), `client.setDescription` or `PATCH /v1/identities/:name`; every identity reads it from `cookout identity list` and the new `cookout identity get <name>` (`client.getIdentity`, `GET /v1/identities/:name`). The web UI's profile panel shows it, and its owner and admins edit it there.
