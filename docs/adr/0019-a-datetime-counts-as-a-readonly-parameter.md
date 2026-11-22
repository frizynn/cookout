# A `DateTime` counts as a readonly parameter

2026-11-22 (the code review of mattpocock/cookout#31, part of mattpocock/cookout#17, extending [ADR 0014](0014-more-lint-opt-outs-for-contradictions.md)). A chief-of-staff choice, pending Matt's review.

The review asked for one owned timestamp brand, `IsoTime`, in place of five copies of the same pattern. The backend writes the current time with Effect's `DateTime`, so the one function that turns a `DateTime` into an `IsoTime` has to take a `DateTime`. `typescript/prefer-readonly-parameter-types` reads Effect's `DateTime` (`Utc` and `Zoned`) as mutable, as it reads `Option` and `Effect`: the values are immutable, but their interfaces declare `pipe` as a method and carry internals the rule can't see through. So `DateTime`, `Utc` and `Zoned` join ADR 0014's list of Effect types the rule allows, on the same grounds as `Option`.
