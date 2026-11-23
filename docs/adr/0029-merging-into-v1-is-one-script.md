# Merging into v1 is one script, and v1 CI runs are never cancelled

2026-11-23 (mattpocock/cookout#82). A chief-of-staff choice, pending Matt's review.

A retro on #50 and #52 found that hand-running the merge into v1 was the largest single cost of a ticket. `pnpm merge-ticket <N>` now runs it: fetch, `merge-ticket-N` from `origin/v1`, a `--no-ff` merge of `ticket-N`, then `pnpm install` if `pnpm-lock.yaml` changed, `pnpm check`, and `git push origin HEAD:v1`. If v1 moved before the push, it starts again from the fetch, up to five times. It resolves only three kinds of conflict. Generated files (validators, `api/*.api.md`, `lint-baseline.json`) are regenerated with their scripts. Migrations both branches appended are renumbered with v1's first. In the coverage floor in `vitest.config.ts`, each threshold takes the lower of the two values, since neither branch measured the merge. Any other conflict, or a migration that edits a shipped one, stops it with the files listed and nothing pushed.

The script's decisions are tested against throwaway git repos, through `mergeTicket` in `scripts/lib/merge-ticket.ts`, in `scripts/tests/`. That folder joins the tested interfaces in `tests-only-at-tested-interfaces`. Coverage still counts only `app/`.

CI's `cancel-in-progress` cancelled a v1 push run whenever the next merge landed, so implementers waited on runs that never finished. Each v1 push now gets a concurrency group of its own (the ref plus the SHA), and v1 runs are never cancelled. Other refs keep one group per ref, so a newer push to a ticket branch still cancels the older run.
