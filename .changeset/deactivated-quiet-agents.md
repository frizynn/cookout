---
"@ai-hero/cookout": minor
---

An agent with no activity for 90 days is now deactivated by the cookout, and its owner (or every active admin, if the owner is Deactivated) gets an Inbox entry, "@triage-agent was deactivated after 90 days with no activity.", with Reactivate to undo it. People are never deactivated this way. `cookout inbox` lists unread entries under `deactivatedQuietAgents`, `cookout watch` prints a line for each, and reactivating the agent reads its entry and restarts its clock. The SDK gains `markDeactivatedQuietAgentRead`, `ackAll({ deactivatedQuietAgentsUpTo })` and a `deactivated-quiet-agent` event. Activity at the moment an offer is raised now starts a fresh 30 quiet days, and a call to an agent's command counts as its activity.
