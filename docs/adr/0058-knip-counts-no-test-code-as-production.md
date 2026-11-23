# knip counts no test code as production

2026-11-23 (mattpocock/cookout#214, found by #187). Exports only tests use are banned (no concessions to tests), and `knip --production` is the check that catches one. Two gaps let a test-only export past it: knip skips every export tagged `@internal` in production mode, and `app/modules/testing/server.ts` was a production entry, so whatever the testing module imported or re-exported counted as a production use.

## Decision

- **No `@internal` tags.** `export-rules/no-internal-tag` fails on an `@internal` JSDoc tag. knip has no option to stop skipping them (the skip is hard-coded in its `util/tag.js`), so a lint rule is the only way to close the gap.
- **The testing module is outside knip's production view.** `knip.json` drops `app/modules/testing/server.ts` and `app/modules/testing/web.ts` from the entries and excludes `app/modules/testing/**` from the project, so nothing the testing module uses counts as used.
- **One exception: `app/modules/testing/lib/server/storage.ts`** stays a production entry, for `memoryStorage`. The in-memory store exists for fast tests, and Matt approved it as a second `Storage` adapter that passes the same adapter suite ([ADR "memory and SQLite share one adapter test suite"](0007-memory-and-sqlite-share-one-adapter-test-suite.md)), so it is the seam's own adapter, not a concession.

- **`effecttsgo/api-stability-leak` is off in `app/modules/http/server.ts` and `app/modules/limits/server.ts`.** The `@internal` tag had hidden `nodeHttpServer` and `withinRequestLimit` from it too. Both require `effect/http` types (`HttpServer`, `HttpServerRequest`), and `nodeHttpServer` the platform services, so they fall under [ADR "api-stability-leak is off where the platform is a requirement"](0018-api-stability-leak-off-where-the-platform-is-a-requirement.md) as `cli` and `storage` do, and the http baseline entry for the rule goes.

## Consequences

- knip no longer reports unused exports or files inside the testing module itself.
- The storage fixture file still counts its other imports (`Storage`, `sqliteStorage`, `tokenHash`) as used; each has production users today.
