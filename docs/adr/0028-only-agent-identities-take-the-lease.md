# Only agent identities take the lease

2026-11-23 (mattpocock/cookout#49, from #39). Supersedes [ADR 0004](0004-a-lease-is-needed-only-for-leave-ack-and-watch.md) in part: its lease rules now apply to agent identities only. Builds on [ADR 0025](0025-one-rule-decides-which-other-writes-need-the-lease.md) and [ADR 0027](0027-an-identity-is-a-human-or-an-agent.md). Keeping the lease is Matt's decision; the refusal's code and status are chief-of-staff choices, pending Matt's review.

Superseded in its lease parts by [ADR 0042](0042-agent-session-tokens-replace-the-lease.md): there is no lease; a human still never joins (403 `identity_kind`).

Matt, 2026-11-23 on questions board #423, on keeping the lease once identities have kinds: "Yep, keeping it sounds fine to me. We also need to make sure that all humans have an identity, i.e. you can't log in to a session without one." So the lease stays, but only agents run `cookout join`, and nothing a human does needs a lease.

- **A human can't join.** `POST /v1/lease` for a human identity, with or without `force`, is 403 `identity_kind` ("ada is a human identity; only agent identities join."). A join as another identity's name is still 403 `not_your_identity`, checked first.
- **A human never needs the lease.** `Leases.requireLease` decides by kind: for a human it passes whatever the rule and whatever lease ID was sent, so a human's ack (from the web UI or anywhere) goes through with no lease ID, and a stray lease ID is never checked. The gate in `leases/server.ts` and `requireLeaseWhileHeld` both go through it, so when watch gets its lease gate (ticket 8d) it reuses the same decision, and if ADR 0025's other-writes rule ever becomes `while-held` it still binds agents only.
- **Agents are unchanged.** An agent's ack and watch follow ADR 0004: the live lease ID, or none while nobody holds a live lease; a stale lease ID is 409 `lease_lost`.

If Matt chooses otherwise, the kind check is in one place for each half: the `join` of `Leases` and its `requireLease`.
