# A local rule owns import order

2026-11-22 (mattpocock/cookout#35). A chief-of-staff choice, pending Matt's review.

A deterministic fix beats an agent edit, and Oxlint 1.94's `sort-imports` fixes only the order of the names inside one import: the order of the import declarations themselves, most of its reports, has no fixer, so agents reordered imports by hand. Biome's `organizeImports` sorts by module path, while `sort-imports` sorts by syntax (side-effect, namespace, several names, one name) and then by the first local name, so running both would make each undo the other.

So one tool owns import order: `local/sort-imports` (`lint/rules/sort-imports.js`), which checks exactly what `sort-imports` checked with its default options (the same three messages, on the same files and the same counts when it replaced the native rule) and fixes both orders. The native `sort-imports` is off, and Biome's assist stays off. The fix leaves the code alone when a comment or another statement sits between the imports or the names, since moving it is a judgement call; that report is fixed by hand.
