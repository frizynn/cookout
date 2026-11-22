# Each type-aware lint check has its own CI job

The CI runners for this private repository have 2 cores (`nproc` on run 45072577757), and a type-aware Oxlint run (Oxlint plus tsgolint) keeps both busy. When `lint` shared a job with `canaries`, and `fixers` shared one with `types`, each ran about 1.7 times slower than when it ran alone: on run 45072577757 `lint` took 8.4s alongside `canaries` and 4.9s alone, and `fixers` took 10.9s alongside `types` and 8.3s alone, against 8s budgets. They passed only on the re-time from ADR 0013, or failed (mattpocock/cookout#37). So `lint`, `canaries` and `fixers` each run in their own matrix job in `.github/workflows/check.yml`, as the test shards do. `fixers` also counts the fixture's diagnostics before the fix in parallel with the first fix pass, instead of in a separate pass before it, so it does one type-aware pass fewer.

## Considered Options

- **Capping Oxlint's `--threads` and tsgolint's `GOMAXPROCS`**: rejected, because on 2 cores capping each run to 1 thread gave no gain locally (fixers 4.3s uncapped, 4.6s capped); the two checks still share the same 2 cores.
- **Raising the budgets or widening the re-time**: rejected for the reasons in ADR 0013.

## Consequences

The workflow starts two more runners. Each job's setup (checkout, install, cache) runs in parallel with the others, so the run's wall time does not grow. A new type-aware check gets its own job too, rather than joining an existing one.
