# Each type-aware lint check has its own CI job

The CI runners for this private repository have 2 cores (`nproc` on run 45072577757). Most of each type-aware Oxlint run is spent starting Node and loading the JS plugins and `effect-tsgo`, not running tsgolint. When `lint` shared a job with `canaries`, and `fixers` shared one with `types`, each ran about 1.7 times slower than alone. On run 45072577757, `lint` took 8.4s alongside `canaries` and 4.9s alone. `fixers` took 10.9s alongside `types` and 8.3s alone. Both have 8s budgets, so they passed only on the re-time from ADR 0013, or failed (mattpocock/cookout#37).

So `lint`, `canaries` and `fixers` each run in their own matrix job in `.github/workflows/check.yml`, as the test shards do. Two changes go with this:

- `fixers` counts the fixture's diagnostics before the fix in parallel with the first fix pass, instead of in a separate pass before it, so it waits on one Oxlint run fewer.
- The check job sets `NODE_COMPILE_CACHE` under `node_modules/.cache`. That folder is already restored between runs, so Node does not recompile the plugins on every Oxlint run.

## Considered Options

- **Capping Oxlint's `--threads` and tsgolint's `GOMAXPROCS`**: rejected. A single run's CPU time is about its wall time, so it uses about one core, and capping it gave no gain (fixers took 4.3s uncapped and 4.6s capped, on 2 local cores).
- **Raising the budgets or widening the re-time**: rejected, for the reasons in ADR 0013.

## Consequences

With separate jobs, `lint` took 3.9s to 5.5s and `fixers` 4.4s to 7.4s on their first timing, over runs 45073088815, 45073211039, 45073328831, 45073753544 and 45073758595. The workflow starts two more runners. Each job's setup (checkout, install, cache) runs in parallel with the others, so the run's wall time does not grow. A new type-aware check also gets its own job, rather than joining an existing one.
