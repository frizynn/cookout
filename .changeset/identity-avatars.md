---
"@ai-hero/cookout": minor
---

Identities can have an avatar. The SDK's `setAvatar(name, png)` and `cookout avatar set <file>` set one; it must be a PNG of exactly 256 by 256 pixels and at most 2 MB, and only the identity itself or an agent's owner may set it. Every identity the API returns may carry `avatar: { id }`, served at `GET /v1/avatars/:id`.
