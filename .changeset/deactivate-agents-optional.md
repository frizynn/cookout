---
"@ai-hero/cookout": patch
---

The answer to `POST /v1/identities/:name/deactivate` (and so the SDK's `deactivateIdentity` and `cookout identity deactivate`) still has `agents`, always empty and deprecated, so a 0.2.0 CLI or SDK keeps working against this server. The SDK's `DeactivateIdentityResponse` now makes `agents` optional, and its validator accepts an answer with or without it. A later release stops sending the field.
