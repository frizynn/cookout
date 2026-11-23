# One rule decides which other writes need the lease

2026-11-23 (mattpocock/cookout#7). Builds on [ADR 0004](0004-a-lease-is-needed-only-for-leave-ack-and-watch.md). A chief-of-staff choice, pending Matt's review.

Superseded in its lease parts by [ADR 0042](0042-agent-session-tokens-replace-the-lease.md): there is no lease, so nothing is left for this rule to decide.

Spec mattpocock/cookout#1 refuses any write sent without a lease ID while a lease is held (409), but ADR 0004, as built, needs the lease only for leave, ack and watch. Which one holds is an open question for Matt, so the code follows ADR 0004 and keeps the choice in one place: `Leases.requireLease` takes a rule, `while-held` (the live lease ID, or no lease ID while nobody holds a live lease) or `none`, and the gate in `leases/server.ts` applies `otherWritesRule` to every request that is neither a `GET` nor a lease route. That rule is `none` today. If Matt picks the spec's answer, it becomes `while-held` and no route changes. Ack and watch call `requireLeaseWhileHeld` themselves, so they keep the lease whatever the rule says.
