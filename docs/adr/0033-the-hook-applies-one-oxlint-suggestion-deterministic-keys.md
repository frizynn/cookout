# The hook applies one Oxlint suggestion: deterministic-keys

2026-11-23 (mattpocock/cookout#93). A chief-of-staff choice, pending Matt's review.

The target says Oxlint's suggestions stay off because they may change behaviour, and #83 asked only for rules whose fix is a safe `--fix`. The lint ratchet, and so the pre-commit hook, still runs `--fix-suggestions` for one rule, `effecttsgo(deterministic-keys)`, with its own config (`lint/suggest.oxlintrc.json`) and only on the files that rule flagged. We keep it because that suggestion only rewrites the string key of a `Context.Service` class to the one its package, file path and class name determine (`@ai-hero/cookout/storage/server/Storage`); error tags such as `StorageUnavailable` are not rewritten. The same input always gives the same key, and code reaches a service through its class, never through the key string, so the rewrite changes no behaviour the tests or callers see. Without it, every new service would stop an agent on a hand edit the hook could make. Any other suggestion stays off: a rule joins `SUGGESTED` in `scripts/lib/fix-until-stable.ts` only with an ADR saying why its suggestion is as safe.

## Consequences

A key is part of behaviour wherever it is serialised or compared as a string (a key in a log query, or two services that would end up with one key). If code ever does that, this suggestion stops being safe for that file, and the pass must be dropped or that file excluded.
