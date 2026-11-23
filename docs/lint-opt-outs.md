# Lint opt-outs

Every Oxlint category is `"error"` in `.oxlintrc.json`, and every Oxlint plugin for the stack is on ([ADR 0012](adr/0012-lint-opt-outs.md)). A rule is off or loosened only for a contradiction: two rules that can't both pass, a rule that fights the cookout's layout, or a false positive on a library's documented API. A rule that is only harsh stays on. This file lists every opt-out with its reason ([ADR 0044](adr/0044-the-lint-opt-out-list-lives-outside-the-adrs.md)). A commit that turns a rule off or loosens it adds its entry here, with the reason, in the same commit.

## Off everywhere

- `import/no-named-export`, `import/prefer-default-export`: contradict `import/no-default-export`. Entry points use named exports.
- `import/group-exports`: one export statement per file leaves no place for the JSDoc block on each exported function that `local/no-comments` allows.
- `import/no-relative-parent-imports`: `tests/` and `lib/` reach their module's entry points through `../`. dependency-cruiser owns import shape.
- `vitest/no-importing-vitest-globals`: contradicts `vitest/prefer-importing-vitest-globals`, and `@effect/vitest` must be imported.
- `vitest/require-top-level-describe`: contradicts the `describe` ban (`vitest/max-nested-describe` at `max: 0`).
- `react/react-in-jsx-scope`: obsolete under the automatic JSX runtime (`jsx: react-jsx`).
- `unicorn/throw-new-error`: fires on Effect's `Schema.TaggedError<Self>()(...)` class factory, whose instances `effecttsgo/new-schema-class` says to build with `make`.
- `jsdoc/require-param-type`, `jsdoc/require-property-type`, `jsdoc/require-returns-type`: types live in TypeScript. `eslint-plugin-jsdoc`'s own `recommended-typescript` config turns these off.
- `no-undef`, `no-redeclare`: `tsc` checks both, and typescript-eslint's `eslint-recommended` config turns them off. `no-redeclare` also fires on a value and a type sharing a name, which is Effect's `Schema` idiom.

## Off in some files

- The 15 `effecttsgo` rules that name a global or a Node API (`async-function`, `crypto-random-uuid`, `extends-native-error`, `global-console`, `global-date`, `global-fetch`, `global-json`, `global-random`, `global-timers`, `new-promise`, `node-builtin-import`, `prefer-effect-array`, `prefer-effect-record`, `prefer-effect-string`, `process-env`), in every `app/` file outside backend code (`server.ts`, `lib/server/`, `tests/`) and in `app/web.tsx`. They point at Effect APIs, which those files may not import. The `no-restricted-globals` owners still apply there.
- `no-restricted-globals` lets `app/modules/format/` use `Date` and `setInterval`: it is the web UI's one reader of the time and its one clock, which ticks a time shown as how long ago (mattpocock/cookout#153). Every other web module reads the time and ticks only through it.
- `effecttsgo/node-builtin-import` and `import/no-nodejs-modules`, in the owner adapters of a Node API: `http`'s server (`node:http`), the storage SQLite adapter (`node:sqlite`) and the secrets Layer (`node:crypto`). Each one is the single owner of that API, and the other files stay banned from it by `no-restricted-imports`.
- `no-restricted-globals` lets `app/modules/format/` read `Date` ([#134](https://github.com/mattpocock/cookout/issues/134)): the web UI writes message times in the person's own time zone, which needs `Date` in the browser, and Effect's Clock is for the backend. Every other file stays banned from it. Confirmed by Matt, 2026-11-23.
- `effecttsgo/node-builtin-import` and `import/no-nodejs-modules`, in `app/modules/cli/lib/server/adapters/machine.ts` ([#117](https://github.com/mattpocock/cookout/issues/117)): it imports `node:os` for the machine's name, as the one owner of that API. Confirmed by Matt, 2026-11-23.
- `effecttsgo/process-env` and `node/no-process-env`, in `config`: it is the one reader of `process.env`.
- `effecttsgo/strict-effect-provide`, in `app/main.ts`, where the live Layers are provided. Also in tests: each test is its own application root and provides its own Layer.
- `vitest/require-hook`, outside `*.test.*` files: it flags every top-level statement, which is a false positive in a program entry or a script that runs at the top level. In tests it stays on and bans a top-level `layer(...)`.
- `import/no-default-export`, in `vitest.config.ts` and `tsdown.config.ts`: Vitest and tsdown read their config from the file's default export. Also in `scripts/web-test-environment.ts`, since Vitest reads a custom environment from its default export, and in `lint/test-rules.js` and `lint/web-rules.js`, since oxlint reads a JS plugin from its default export.
- `typescript/no-unsafe-*`, in `lint/**/*.js` and `*.cjs`: they are untyped JavaScript (the Oxlint JS plugin API and dependency-cruiser's config format), so every value is `any`.
- `scripts/`, `lint/`, `*.cjs`, `vitest.config.ts` and `tsdown.config.ts` are Node tooling outside `app/`, not backend code. In them the same 15 `effecttsgo` rules are off, plus `import/no-nodejs-modules` and `no-console`. The local rules in `lint/rules/` run inside Oxlint's JS plugin host, which calls plain synchronous visitors, so Effect can't be their implementation. The scripts run directly under `node` from Lefthook and CI. Written in Effect, each one would have to run its own effects, which `no-restricted-properties` bans outside `app/main.ts`. Their job is to print a report and spawn tools, as the existing override that lifts `no-restricted-globals` and `no-restricted-imports` there already says. Every other rule still applies to them, ratcheted like the rest.

## Loosened

- `func-style`: `"declaration"`, to agree with `react/function-component-definition`.
- `no-duplicate-imports`: `allowSeparateTypeImports`, to agree with `import/consistent-type-specifier-style`.
- `new-cap`: `properties: false`, since Effect's API is capitalized namespace functions (`Schema.Struct`, `Context.Service`).
- `react/jsx-filename-extension`: `.tsx` only, the extension the layout uses.
- `vitest/no-standalone-expect`: `@effect/vitest`'s `it.effect`, `it.live` and `it.prop` count as test blocks.
- `vitest/consistent-test-it`: `it`, inside and outside `describe`. `@effect/vitest` exports `it` (with `it.effect`) and no `test`. The default (`test`) has a fix that renames `it` to `test` without an import, which breaks `tsc`.
- `typescript/prefer-readonly-parameter-types`: allows `@effect/vitest`'s `Methods` and `MethodsNonLive`, the mutable `it` its callbacks receive.
- `typescript/prefer-readonly-parameter-types`: allows React's `KeyboardEvent` and `MouseEvent`, which a handler receives as React makes them and can't mark readonly (`SidebarBody` reads a click's target, #144).
- `effecttsgo/unstable-api-usage`: `allowedUnstableApis` in the `@effect/language-service` entry of `tsconfig.json` holds `@effect/vitest`, which the tests use, and the unstable Effect 4 modules the cookout is built on: `effect/cli`, `effect/http`, `effect/process`, `effect/FileSystem`, `effect/Path`, `effect/ByteSize`, `effect/Stdio` (which `cookout login --token` reads the token from, #115), `@effect/platform-node`, and `@effect/platform-node-shared/NodeSocket`, which `@effect/platform-node`'s `NodeSocket` re-exports and the reporter names in its place (a test opens a raw TCP connection with it, #130).
- `effecttsgo/deterministic-keys`: `keyPatterns` skips the leading `app/modules/` of a file path, so a key derives from the module path.

## Recorded in their own ADRs

- [ADR 0014](adr/0014-more-lint-opt-outs-for-contradictions.md): nine more contradictions found when new and moved files went to 0 baseline entries.
- [ADR 0016](adr/0016-null-is-allowed-because-the-protocol-uses-it.md): `unicorn/no-null` is off, because the wire protocol and SQLite need `null`.
- [ADR 0018](adr/0018-api-stability-leak-off-where-the-platform-is-a-requirement.md): `effecttsgo/api-stability-leak` is off where the platform is a requirement.
- [ADR 0019](adr/0019-a-datetime-counts-as-a-readonly-parameter.md): a `DateTime` counts as a readonly parameter.
- [ADR 0022](adr/0022-the-rule-tester-may-run-at-the-top-level.md): the rule tester may run at the top level.
