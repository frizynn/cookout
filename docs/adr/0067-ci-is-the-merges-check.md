# CI is the merge's check, not a full local pnpm check

2026-11-24 (mattpocock/cookout#260). A chief-of-staff choice, pending Matt's review.

On 2026-11-23 and 24, merges kept failing in merge-ticket's local `pnpm check` on tests the ticket didn't touch, at load averages of 30 to 50 with many agents on one machine; #249 failed four times this way. So merge-ticket now runs only the fast local checks on the merge (types, lint and hygiene, which holds the migration and ADR guards). Then it pushes the merge to `merge-ticket-N`, which the Check workflow runs on, and waits for that run. Only when every job is green, and v1 hasn't moved, does it push that exact commit to v1, never forced: a push v1 refuses as not a fast-forward means v1 moved, and it merges the new v1 and repeats. A red run stops it with the failed jobs printed and nothing pushed to v1. It deletes the remote `merge-ticket-N` when it finishes.

This replaces the `pnpm check` step of the merge in ADR 0029; the rest of that ADR stands.
