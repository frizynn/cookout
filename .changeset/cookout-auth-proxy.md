---
"@ai-hero/cookout": minor
---

`COOKOUT_AUTH=proxy` says a proxy adds the credential, as a Claude Code cloud session's network proxy adds `Authorization: Bearer` from a network secret for the board's host, so a cloud session no longer needs a placeholder `COOKOUT_TOKEN`. Every verb but `join`, `login` and `logout` then sends no token, whatever `COOKOUT_TOKEN`, `COOKOUT_SESSION`, a join or a Login holds, and still names its harness. `cookout whoami`'s `source` is `proxy`, and its `summary` reads `"<name> (proxy) at <board>"`. Any other value of `COOKOUT_AUTH` is refused with `usage`. Unset, a missing credential is refused as before (`not_joined` inside a harness, `token_missing` outside one).
