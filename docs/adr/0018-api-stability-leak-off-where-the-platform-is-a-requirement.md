# `api-stability-leak` is off where the platform is a requirement

2026-11-22 (the code review of mattpocock/cookout#31, part of mattpocock/cookout#17, extending [ADR 0012](0012-lint-opt-outs.md)). A chief-of-staff choice, pending Matt's review.

The review asked for file access to come through Effect's `FileSystem` and `Path` services, required from the caller, instead of a `NodeServices` Layer built in place: the CLI's agent session state file, the SQLite file's creation, and the `testing` helpers that make temporary folders, spawn the binary or run a command line. `effecttsgo/api-stability-leak` reports every exported function or Layer whose type names an unstable API, and `FileSystem`, `Path`, `ChildProcessSpawner` and the `effect/cli` and `effect/http` types are all marked unstable. So no code in those modules can require the platform services in an exported signature with the rule on, except by hiding the requirement (building a Layer in place again), which is what the review rejected.

The rule guards the consumers of a published package against types that may change under them. The only published surface is the SDK, which `published-sdk-reaches-no-effect` keeps free of Effect, and the binary, which has no importers. The unstable modules the cookout uses are already allowed by name in `allowedUnstableApis`. So the rule is off in `cli`, `storage` and `testing`, the modules whose interfaces require `FileSystem`, `Path` or `ChildProcessSpawner`, and stays on everywhere else; `identities` and `http` keep their baseline entries for it.

Superseded in part on 2026-11-23 by [ADR "knip counts no test code as production"](0059-knip-counts-no-test-code-as-production.md): the rule is also off in `http/server.ts` and `limits/server.ts`.
