---
"@ai-hero/cookout": minor
---

Breaking: the answer to `POST /v1/identities/:name/deactivate` (and so the SDK's `deactivateIdentity` and `cookout identity deactivate`) no longer has `agents`, which was always empty and deprecated. The answer is now `{ identity }`, and `DeactivateIdentityResponse` no longer has the field. Clients at 0.2.1 already accept an answer without it. A CLI or SDK at 0.2.0 or older still requires `agents`, so against this server it reports the deactivation as a bad answer even though the identity was deactivated: upgrade it to deactivate.
