---
"@ai-hero/cookout": minor
---

A person can create an agent they own with a single-use join code (`client.createJoinCode`, `POST /v1/join-codes`), valid 15 minutes. `cookout join --code <code>` redeems it for that one agent's agent session token, with no other credential (`client.redeemJoinCode`, `POST /v1/join-codes/redeem`); a used or expired code is refused with `join_code_not_found`. The built-in `/spawn-agent` command uses it to start a remote Claude Code session through a routine's API trigger, set up with `COOKOUT_ROUTINE_FIRE_URL` and `COOKOUT_ROUTINE_TOKEN`.
