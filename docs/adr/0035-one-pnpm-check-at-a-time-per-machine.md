# One pnpm check at a time per machine

2026-11-23 (mattpocock/cookout#94). A chief-of-staff choice, pending Matt's review.

Three `pnpm check` runs at once, each in its own checkout, failed the tests job every time, on 5 s Vitest timeouts (and the 10 s ones in `scripts/tests/`). Alone, each run passes. We looked for shared state first. Each checkout has its own Vite cache, coverage folder and SQLite files; servers take port 0; temporary folders are unique. Nothing is shared. The cause is load. One check runs its 14 jobs at once, and the tests job alone runs a Vitest worker per core. Three checks put 60 to 90 runnable threads on 10 cores. The tests that failed are the ones that spawn a process (`cookout` from `app/main.ts`, `pnpm dev`, the handler example, `git` in the merge tests). Such a cold start costs about 0.5 s of CPU: 0.46 s alone, but up to 7.3 s measured under three checks. So a test with two spawns and a 1 s `--timeout` went from 2 s to past 5 s. No test was waiting on another run's files.

So `scripts/check.ts` holds a machine-wide lock while it runs (`cookout-check.lock` in the OS temporary folder, holding the runner's PID). A second check prints which PID it is waiting for, then starts when that one ends. A lock whose PID has exited is taken over, so a killed check never blocks the next one. CI skips the lock (`--ci`), since each job has a machine of its own. We didn't raise the timeouts: under a 9-fold overload no timeout we would keep is safe. Waiting costs little: three checks in a row took about 85 s in all, while three at once took about 50 s each and every one failed.

## Consequences

A merge's `pnpm check` can wait for another agent's check. `pnpm merge-ticket` already merges again if v1 moved in the meantime. `pnpm coverage:changed` and plain `vitest` runs take no lock.

Ten tests spend 3 s each (about 30 s of worker time per run) waiting for the test server to close. When `close()` runs, the SDK's `fetch` (undici) still holds a socket open, and the server waits until undici's 3 s keep-alive timer drops it. This happens after a test opens and closes event streams (the CLI `watch` tests, the stream-limit test). It isn't shared state and wasn't what failed the runs, so it is left for its own ticket.
