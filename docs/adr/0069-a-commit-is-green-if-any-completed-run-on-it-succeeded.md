# A commit is green if any completed run on it succeeded

2026-11-24 (mattpocock/cookout#266). Check runs on a branch other than v1 share one concurrency group per branch, with cancel-in-progress. Pushing the same merge-ticket-N commit again, or rerunning an older run, puts two runs on one commit, and one cancels the other; a merge once waited about 30 minutes on that. We decided that `ci:wait` and `merge-ticket` judge a commit, not a run. When the run they watch did not pass, they list every Check push run on its commit. The commit is green if any completed run on it succeeded, in whatever order the runs ran. If another run on it is still in progress, they watch that one. It is red only if a completed run failed: a cancelled run never counts as red. If every run on it was cancelled and none is in progress, they rerun the newest once and wait for it; if that is cancelled too, they stop. One function in `scripts/lib/ci-verdict.ts` makes this call for both.

## Consequences

- **A run that passes is still read alone.** The other runs on a commit are listed only when the watched run has a job that is not green, so a green run costs no extra API call.
- **merge-ticket doesn't push a commit origin already has.** If merge-ticket-N on origin is already at the commit to check, `merge-ticket` (and `--continue`) waits for its existing run instead of deleting and pushing the branch again, which would start a run that cancels the first.
