# Tests sit at the fewest tested interfaces

2026-11-22 (mattpocock/cookout#33, part of mattpocock/cookout#17). Supersedes the `it.layer` wording of [ADR 0010](0010-tests-run-effects-with-effect-vitest.md); its choice of `@effect/vitest` stands. These are the chief of staff's choices on #33, pending Matt's review.

A test pins in place the structure behind the interface it drives, so only the interfaces in `TESTED_INTERFACES` in `.dependency-cruiser.cjs` may have tests, and `tests-only-at-tested-interfaces` fails a test file anywhere else. The SDK is the one tested interface: it drives the whole server headlessly, over HTTP against a real server, and fast. The other entries each have a reason and a way off the list:

- `cli`: the binary's own wiring, which the SDK can't reach (argv to the right call, JSON on stdout, a refusal as JSON on stderr with exit code 1, `url_missing`, usage errors, `serve`'s first-boot token, a database file holding no token). Its tests check only that, and only one spawns the binary; `no-restricted-imports` bans `node:child_process`, `effect/process` and `runCookoutBinary` in every other test. Off the list if the CLI, run in process, becomes the single interface and the SDK's tests fold into it, which is Matt's call.
- `storage`: ADR 0007's one contract suite for every `Storage` Layer, kept for a future adapter (mattpocock/cookout#1 story 71). Off the list only if the SDK's suite runs on both Layers, which reverses ADR 0007.
- `webhook-fake`: a fake with its own tests, which a fake earns. Off the list once the command tests use it through the SDK and its own tests go.
- `secrets`: its lease-ID test only, until join covers the lease ID through the SDK (mattpocock/cookout#28).

The web UI will add one entry for its external stores, which no headless interface reaches.

Tests are flat: no `describe`, no `before*`/`after*` hook, no `it.layer` and no top-level `layer(...)`. Each test is a top-level `it.effect` that provides its own Layer, so a reader sees all of a test's setup inside it. A test that runs on several Layers is one `it.effect.each` over them, named with each Layer and never branching on which one. Backend tests live in a module's `tests/server/`, the only test folder where Effect may be imported; a test of plain-TS code stays in `tests/` on plain `vitest`.
