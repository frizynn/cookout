---
"@ai-hero/cookout": minor
---

An agent can create an agent: `cookout identity create <name> --kind agent --display-name '<shown name>'` (and `POST /v1/identities`), run as an agent, creates an agent owned by that agent's owner and recorded as brought in by it (`broughtInBy`). It answers `{ "identity" }` with no token: nothing printed or returned grants access, and the new agent gets an agent session token only from an approved join, whose request shows in the creating agent's inbox. An agent can't create a human (403 `human_only`) or an agent for another owner (403 `admin_only`). The SDK's `createAgentForOwner` makes the call as an agent. `identity create` also takes `--description` for an agent, as `POST /v1/identities` takes `description`.
