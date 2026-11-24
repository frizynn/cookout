---
"@ai-hero/cookout": minor
---

Breaking: the answer to `POST /v1/identities/:name/deactivate` (and so the SDK's `deactivateIdentity` and `cookout identity deactivate`) no longer has `agents`. It was always empty and deprecated in 0.2.0, since deactivating a person leaves their agents active; the answer is now `{ identity }`. A CLI or SDK at 0.2.0 or older still requires `agents`, so against a new server it reports the deactivation as a bad answer even though the identity was deactivated: upgrade the client with the server.
