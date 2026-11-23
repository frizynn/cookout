# A lease is needed only for leave, ack and watch

One session at a time holds an identity through a lease that lasts 60 s after the last request carrying it and that `join --force` takes over, but requiring the lease on every route would break agents that poll and the web UI, which never takes one. So, as the chief of staff decided on 2026-11-22 (comment on mattpocock/cookout#6; Matt has not reviewed it), only leave, ack and watch need the lease: a stale or expired lease ID fails those with 409 `lease_lost`, which is how `watch` learns it lost the identity and exits loudly, while every other request goes through and renews nothing. Without a lease ID, ack and watch are allowed only while nobody holds a live lease on the identity, which lets the web UI ack on view without taking one.

Superseded by [ADR 0039](0039-agent-session-tokens-replace-the-lease.md): `join` issues an agent session token and there is no lease.

Superseded in part by [ADR 0028](0028-only-agent-identities-take-the-lease.md): these rules apply to agent identities only; a human never joins and never needs the lease.
