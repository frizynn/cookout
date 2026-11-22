# A check fails its CI budget only on two slow runs in a row

Each check in `scripts/check.ts` has a time budget that fails CI, but the same commit's checks vary by about half between runners (on 8832db5 the `exports` check took 2.1s on the push run and 3.3s on the PR run against its 3s budget, and a tests shard took 18.8s and 26.0s), so a single timing failed merges on runner noise (mattpocock/cookout#34). In CI, a check that passes but runs over its budget is therefore run again on its own, after the job's other checks, and fails only if that second run is over budget too; budgets stay at about twice the measured CI time, with no added margin. A check that has become slow is slow on both runs and still fails, while one noisy timing does not. The report shows the first time next to the second, so drift stays visible.

## Considered Options

- **A margin over the budget** (for example, fail only past 1.5 times the budget): rejected, because the observed noise is about 50%, so the margin would have to be as large as the budget's own headroom and would let a check double in cost before anything failed.
- **Raising the budgets**: rejected for the same reason, and because a budget is a statement of how fast the check should be.

## Consequences

The second run can find warmer caches (tsc's build info, dependency-cruiser's cache) than the first, so a check that is slow only on a cold cache passes. In CI the caches are restored from the previous run, so the warm time is the one the budget is meant for. A slow check costs its job one extra run, well inside the job's 5-minute timeout.
