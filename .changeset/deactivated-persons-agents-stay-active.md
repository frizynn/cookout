---
"@ai-hero/cookout": minor
---

Deactivating a person no longer deactivates the agents they own: their agents keep their tokens, sessions and live connections, and act as before. `cookout identity deactivate` (`client.deactivateIdentity`) still answers `agents`, now always empty and deprecated; it goes in a later release. An admin can reactivate an agent whose owner is deactivated, so `owner_deactivated` is no longer an error code, and can transfer it to another owner as before. The web UI's Deactivate confirmation is unchanged and says nothing about a person's agents.
