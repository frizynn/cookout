# The rule tester may run at the top level

2026-11-22 (mattpocock/cookout#35, extending [ADR 0014](0014-more-lint-opt-outs-for-contradictions.md)). A chief-of-staff choice, pending Matt's review.

Each local rule's suite in `lint/tests/` is one top-level `ruleTester.run(...)` call, which is how Oxlint's `RuleTester` registers its `describe` and `it` blocks; called inside a test or a hook, it registers nothing. `vitest/require-hook` fails every top-level call outside a hook, so no rule suite could pass it, and a new local rule's suite could not be added lint-clean. The rule stays on, with `allowedFunctionCalls: ["ruleTester.run"]`, so every other top-level call in a test file still fails.
