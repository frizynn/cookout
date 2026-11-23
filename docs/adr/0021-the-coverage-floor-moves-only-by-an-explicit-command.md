# The coverage floor moves only by an explicit command

2026-11-22 (mattpocock/cookout#36, part of mattpocock/cookout#17). A chief-of-staff choice, pending Matt's review. This departs from the target's coverage floor, which sets `coverage.thresholds.autoUpdate: true` so the floor rises whenever coverage does.

With auto-update on, every `pnpm test` that beat the floor rewrote `vitest.config.ts`, so `pnpm check` left a modified tracked file behind and parallel tickets conflicted on the rewritten numbers. A retro of the review-fix implementer counted 12 of 58 `pnpm check` runs red on coverage and 10 runs of `git checkout vitest.config.ts` to undo the rewrite, the third retro in a row to find it. So `vitest.config.ts` sets `autoUpdate: false`: `pnpm test`, `pnpm check` and CI still fail a run whose coverage is below the floor, but never write a file. `pnpm coverage:raise` runs the tests with auto-update on for that one run, which raises each threshold to its measured value and never lowers one (Vitest only rewrites a threshold the coverage is above). It runs on its own, in a commit of its own.

## Considered Options

- **Keep auto-update and commit the rewrite with each change**: rejected, because every ticket then touches `vitest.config.ts`, and tickets in parallel conflict on numbers that mean nothing to either.
- **A ratchet script of our own** that reads a coverage summary and rewrites the thresholds: rejected, because Vitest's auto-update already raises and never lowers, so one flag on one script does the same job with no code.

## Consequences

The floor no longer rises by itself, so it lags coverage until someone runs `pnpm coverage:raise`; a drop that stays above the stale floor passes. A ticket that adds tests should raise the floor in a commit of its own once it is merged.
