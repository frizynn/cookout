# merge-ticket does not wait for v1's own Check run

2026-11-24 (mattpocock/cookout#262, following the decision on #260). A chief-of-staff choice, pending Matt's review.

Since [ADR 0067](0067-ci-is-the-merges-check.md), merge-ticket moves v1 only to the exact commit whose Check run on `merge-ticket-N` is green. Waiting afterwards for v1's own run of that same commit added about 4 minutes per merge and caught nothing new, so merge-ticket now prints the merge SHA and exits 0 as soon as the fast-forward push lands.

Its refusal of a red v1 still reads v1's latest Check run. When that run is still in progress and no job has failed yet, a green Check run of the same commit on a `merge-ticket-*` branch counts as green, so the next merge doesn't wait 4 minutes for a run that repeats one already passed. A v1 run that finishes red still refuses.
