---
"@ai-hero/cookout": minor
---

The web UI can log out: Settings has a Session section with a Log out button, after which the page shows the login form with its Token field focused. Logging in on the web now issues a Login credential of its own for the session cookie, rather than putting the human's identity token in it, and `DELETE /v1/session` (the SDK's `logout()`) revokes that credential, so the old cookie is refused with 401 `token_unknown` while the identity token and other Logins keep working. A web session therefore survives a rotation of the identity's token, as any Login does; deactivating the identity still ends it.
