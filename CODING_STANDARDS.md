# Coding standards

How code is written in the cookout. It applies to people and agents alike.
`pnpm check` enforces the rules it can; the rest are on you and on review.
The spec is mattpocock/cookout#1.

## The check

```
pnpm check            # typecheck + lint + boundary check + tests. Must exit 0.
pnpm typecheck        # tsc --build over every package, in dependency order
pnpm lint             # ESLint (no barrels, injected clocks, ids and timers)
pnpm lint:boundaries  # dependency-cruiser (package boundaries, see below)
pnpm test             # Vitest, every package plus tests/ at the root
pnpm -r test          # each package's own `test` script, one by one
pnpm --filter "*storage-sqlite" test   # one package (filter by name glob; names are scoped)
```

CI (`.github/workflows/check.yml`) runs `pnpm check` on every PR and on push
to `main`. Never weaken a rule, a tsconfig flag or a test to get it green. If a
rule is wrong, change it in its own commit and say why.

## Packages are deep modules

Each package in `packages/` is a **deep module**: a lot of behaviour behind a
small interface.

```
packages/<name>/
  package.json     name @ai-hero/cookout-<name>, private, "exports": "./src/index.ts"
  tsconfig.json    extends ../../tsconfig.base.json, references its dependencies
  src/index.ts     the ONE entry point (public)
  src/...          everything else: private, free to import each other
  tests/           tests and their helpers (private)
```

| Package          | npm name                          | What it is |
| ---------------- | --------------------------------- | ---------- |
| `protocol`       | `@ai-hero/cookout-protocol`       | Request/response types, runtime schemas, SSE event types, the storage adapter interface. No runtime dependencies beyond the schema library. |
| `server`         | `@ai-hero/cookout-server`         | HTTP + SSE server. Depends on `protocol` only and is given a storage adapter. |
| `storage-sqlite` | `@ai-hero/cookout-storage-sqlite` | The SQLite adapter. The only place a SQLite driver or SQL lives. |
| `storage-memory` | `@ai-hero/cookout-storage-memory` | The in-memory adapter. HTTP protocol tests run on it. |
| `storage-tests`  | `@ai-hero/cookout-storage-tests`  | The adapter contract suite (`testStorageAdapter`). Only adapter tests import it. |
| `client`         | `@ai-hero/cookout-client`         | The TypeScript SDK and the `cookout` CLI on top of it. |
| `web`            | `@ai-hero/cookout-web`            | The React + shadcn/ui app, built to static files the server serves. |
| `cookout`        | `@ai-hero/cookout`                | The one published package (bin `cookout`, SDK at `@ai-hero/cookout/sdk`). Bundles the rest. Wires `cookout serve` to SQLite. |

Only `@ai-hero/cookout` is published; every other package is `"private": true`.

A new package: copy an existing one, rename it, add it to the root
`tsconfig.json` references, add `"@ai-hero/cookout-<x>": "workspace:*"` to each
package that uses it, and add a tsconfig reference in each of those packages.

## Boundary rules

These live in `.dependency-cruiser.cjs` and fail `pnpm check`.
`tests/boundaries.test.ts` proves each one fires, by dropping probe files into
real packages.

- **`only-through-entry-points`**: a package reaches another package only
  through its entry point, never `src/<anything else>` or `tests/`.
- **`import-packages-by-name`**: import `@ai-hero/cookout-protocol`, never
  `../../protocol/src/index.ts`. Then the dependency shows in `package.json`
  and the tsconfig reference.
- **`tests-through-entry-points`**: a package's tests import their own package
  through `../src/index.ts` (and their own `tests/` helpers), never its internals.
- **`tests-folder-is-private`**: only tests import from a `tests/` folder.
- **`sqlite-only-in-storage-sqlite`**: no SQLite driver (`node:sqlite`,
  `better-sqlite3`, `sqlite3`, libsql, sql.js...) outside `storage-sqlite`.
- **`no-storage-outside-start-up`**: `server`, `client` and `web` never import
  a storage package. They receive an adapter. Exceptions: test files, the
  server's start-up entry point `packages/server/src/start.ts`, and the
  `cookout` package (`cookout serve`).
- **`no-server-in-client-or-web`**: `client` and `web` talk to the server over
  HTTP only. They don't import it, not even in tests. Spin a server up from a
  test helper that lives where the server is allowed.
- **`no-cycles`**: no dependency cycles, inside or between packages.

**Why dependency-cruiser and not ESLint `no-restricted-imports`:** the rules
depend on where a file is and what an import resolves to, not just the text
of the import. ESLint sees only the string, so it can't tell a relative path
into another package from a local one, and it can't find cycles.
dependency-cruiser resolves every import and is the prior art from
personal-wiki.

## No barrel files

Don't write files that only re-export other files (`export * from "./x"`, or an
`index.ts` that gathers a whole folder). ESLint bans `export *`. A barrel makes
the interface as wide as the implementation, which is the opposite of a deep
module. The entry point exports what callers need by name, and nothing more.
Inside a package, import the file that defines the thing.

## Test through the protocol, not internals

A test drives the cookout the way a caller does and checks what the caller
sees: through the SDK against a real server, the CLI as a process, the browser,
or the storage adapter interface. Never through internal functions or SQL. A
test must keep passing through a refactor that doesn't change behaviour.

- HTTP + SSE behaviour: SDK against a real server on port 0 with a fresh
  in-memory adapter and a fake clock. Nearly everything is tested here.
- Storage: the adapter contract suite, run against every adapter.
- CLI: a few tests of the binary (arguments, env vars, JSON output).
- Browser: Playwright.

### The protocol test helper

`packages/server/tests/test-server.ts`: `await startTestServer()` gives
`{ url, client, adminToken, clientFor, createIdentity, startSecondServer,
clock, storage, webhooks }`: a real server on port 0, a fresh in-memory
adapter, a fake clock (`clock.advance(ms)`; it starts at
2026-01-01T00:00:00.000Z), an SDK client using the first-boot admin token,
and a fake webhook receiver (`webhooks.calls`, `failNext(count, status)`,
`waitForCalls(count)`). `await createIdentity(name, { owner, admin })` makes an
identity as the admin and returns `{ identity, token, client }`, a client
for that identity. `clientFor(token)` (or `clientFor(undefined)`) is a
client with any token; each such client is a separate session for the
lease (`clientFor(token, { leaseId })` resumes one), and
`startTestServer({ leaseMilliseconds })` changes the lease length. `startSecondServer()` boots another server on the
same store, like a restart. Everything closes when the test ends
(`onTestFinished`), so tests need no `afterEach`. Extend this helper rather
than starting servers by hand.

`createIdentity(name, { admin: true })` makes a second admin (v1 has no route
for that) by writing it into the store with the server's own `hashToken`
(exported by `server`). Tests never write to `storage` or hash tokens by hand;
if a test needs state no route can make, add it to the helper.

### Process tests (CLI and `cookout serve`)

The `client` package can't start a server, even in tests, so tests that run
the `cookout` binary live in `packages/cookout/tests/`. `processes.ts` there
has `startServeProcess(databasePath)` (runs `cookout serve` on a free port
and returns its stdout JSON lines and `url`) and `runCookout(args, env)` (runs
the binary with only the env vars you give, plus `PATH` and the like, and
returns `{ exitCode, stdout, stderr }`). The binary is `src/bin.ts` run by
Node's built-in TypeScript type stripping until the package is bundled (#12).
Keep these tests few: argument parsing, env vars, JSON output.

### The adapter contract suite

`packages/storage-tests/src/contract.ts` is one function,
`testStorageAdapter(adapterName, openFresh)`, and each adapter's
`tests/contract.test.ts` calls it with a factory for a fresh, empty store
(SQLite: a new file in a temp folder deleted when the test ends). A ticket
that adds an adapter operation:

1. adds the method to `StorageAdapter` in `protocol/src/storage.ts`,
2. adds its behaviour tests to the contract suite (same names for every
   adapter; never branch on the adapter name),
3. implements it in every adapter.

Only behaviour a single adapter has (SQLite keeping data across a reopen)
goes in that adapter's own tests. A future adapter (Postgres) gets the whole
suite by calling `testStorageAdapter` from its tests.

Write the failing test first, then the code (red, green). Vitest for
everything. Name tests as behaviour ("a reply to a reply joins the parent
thread"), not as functions.

## Runtime schemas at every boundary

Data that crosses a process or storage boundary is parsed with a runtime
schema before it is trusted: HTTP request and response bodies, SSE events,
webhook payloads, command data, CLI input files, and adapter results. The
schemas live in `protocol` and the types come from them (one source of truth).
Don't cast (`as`) untrusted data into a type.

- **zod** for cookout's own data (every schema in `protocol`, rows read back
  in `storage-sqlite`). **ajv** only for JSON Schemas that users register
  (command input).
- Each schema is exported as `<thing>Schema` with its type
  `type <Thing> = z.infer<typeof <thing>Schema>` next to it.
- Errors are `{ error: { code, message, details? } }` (`errorResponseSchema`).
  `code` is a stable snake_case string callers branch on (`not_found`,
  `storage_unavailable`, `bad_response`...); `message` is for people. The SDK
  throws `CookoutError` with `status`, `code`, `message` and `details`, and
  uses `bad_response` when the server's answer doesn't match the protocol.
- Each route's path is a constant in `protocol` (`healthPath`), shared by the
  server and the SDK. Paths with a parameter are functions
  (`identityPath(name)`).
- Request bodies are parsed by the server only: the SDK sends what it is
  given, and a bad body comes back as 400 `invalid_request` with the zod
  issues in `details` (400 `invalid_json` if it isn't JSON).

## Tokens and auth

- Every route except `GET /v1/health` needs `Authorization: Bearer <token>`.
  The server checks the route exists first (unknown routes are 404 without a
  token), then the token: 401 `token_missing`, `token_unknown` (never issued)
  or `token_revoked` (rotated away, or its identity was deleted). An admin-only
  action from a non-admin is 403 `admin_only`. Deleting the last admin is
  409 `last_admin` (checked inside the adapter's `deleteIdentity`, so it is
  atomic). Any future way to drop the admin flag must keep the same rule.
- Tokens are `cookout_` plus 32 random bytes in base64url, made by the
  injected `newToken` (`randomToken` from `server` at start-up). The server
  hands the store only `sha256(token)` in hex; no adapter ever sees a token.
- **Admin** is a flag on an identity (approved: wiki
  `decision-spec-defaults.md`, 2026-11-22, answer 2). On first boot, a store with no identities gets an `admin`
  identity; `startServer` returns its token as `adminToken` and `cookout
  serve` prints it once as a JSON line on stdout. Later boots print nothing.
- Identity names: 1-64 lowercase letters, digits or `-` (`identityNameSchema`).

## Channels, messages and threads

- Any identity creates, lists and reads channels and posts anywhere (spec
  answer 12; wiki `decision-spec-defaults.md`, 2026-11-22, answer 8). Channel
  names are 1-80 lowercase letters, digits or `-`, unique (409
  `channel_exists`). That rule is a working default from #5, kept in one
  place: `channelNameSchema` in `protocol/src/channels.ts`.
- Threads are one level deep. A message is a `TopLevelMessage` (with
  `replyCount` and `latestReplyId`, `null` when there are no replies) or a
  `Reply` (with `replyTo`, always the top-level message). A `replyTo` that
  points at a reply is moved to that reply's parent, not refused (wiki
  `decision-spec-defaults.md`, answer 7). Replying across channels is 400
  `reply_in_other_channel`. There is no "also send to channel" and no
  `@channel`/`@here` (wiki `decision-cookout-v1-scope.md`, 2026-11-22).
- `appendMessage` is the one atomic adapter step for posting: it checks the
  channel and the message replied to, takes the next ID from the same
  sequence as `nextMessageId`, and stores the message. Mentions and follows
  (#7) go inside it, not in extra calls from the server.
- A message's `author` (`{ name, owner? }`) is copied when it is posted, so
  messages outlive a deleted identity. `data` is any JSON value; absent means
  none was sent, which is different from `null`.
- Paging: `GET /v1/channels/<name>/messages?before=<id>&limit=<n>` returns the
  newest `limit` (default 50, max 200) top-level messages below `before`,
  oldest first, and `hasMore`. Page back with the first message's ID. Query
  strings are parsed with a schema (`listMessagesQuerySchema`) like bodies.
- `GET /v1/messages/<id>/thread` works from any message in the thread.
- In the server, `parseRequest(schema, input)` is how a body or query becomes
  typed data (400 `invalid_request` with the zod issues otherwise).
- Routes with a path parameter match through `matchPath(pattern, path)`,
  which returns the segments percent-decoded. Never call
  `decodeURIComponent` on a segment yourself: a malformed one (`%E0`) must be
  400 `invalid_path`, not a 500.

## The identity lease

- `POST /v1/lease` `{ as, force? }` is join, `DELETE /v1/lease` is leave.
  `as` must be the token's own identity (403 `not_your_identity`): a check,
  not a switch. The lease lasts `leaseMilliseconds` (default 60 s,
  `defaultLeaseMilliseconds`) after the last request carrying it (wiki
  `decision-spec-defaults.md`, 2026-11-22, answer 1). It ends *at*
  `expiresAt`. Lease IDs come from the injected `newLeaseId`
  (`randomLeaseId` at start-up); time from the injected clock only.
- A session sends its lease ID in the `cookout-lease` header (`leaseHeader`).
  Any request carrying the identity's live lease ID renews it. A stale one
  (taken over, expired, released) renews nothing and doesn't block the
  request: only routes that need the lease refuse it (chief-of-staff,
  2026-11-22). Requests without the header never renew anything.
- Only **ack and watch** need the lease (chief-of-staff decision on
  cookout#6, 2026-11-22), and leave. Posting and reading don't, and the web
  UI never takes one. A route that needs the lease calls the exported
  `requireLease(storage, caller, leaseIdSent, now)` in `server.ts`: 409
  `lease_required` when no lease ID was sent, 409 `lease_lost` when it isn't
  the live one (how `watch`, #8, learns it lost the identity and exits
  loudly). Recorded for #7, not built yet: without a lease ID, ack and watch
  are allowed only while nobody holds a live lease on the identity (that is
  how the web UI acks); with one, it must match.
- Lease errors are all 409 with `details: { heldUntil }`
  (`leaseConflictDetailsSchema`): `lease_held` (join while another session
  holds it), `lease_required`, `lease_lost`. `heldUntil` is the live lease's
  end, or `null` when nobody holds the identity.
- Adapters: `takeLease`, `renewLease`, `releaseLease`, `findLease`, each one
  atomic step, given `now` as an ISO string. Deleting an identity drops its
  lease.
- The SDK client remembers the lease ID after `join` and sends it on every
  request until `leave`, and drops it on a `lease_lost`. `createCookoutClient`
  takes `leaseId` to resume one.
- The CLI keeps the lease in `<state dir>/leases/<hash of url and token>.json`.
  The state dir is `COOKOUT_STATE_DIR`, else `$XDG_STATE_HOME/cookout`, else
  `~/.local/state/cookout`. Two sessions on one machine with the same token
  share a lease unless their `COOKOUT_STATE_DIR` differs. `leave` deletes
  the file; on any `lease_lost` the CLI deletes it too and says (on stderr)
  to run `cookout join` again. Process tests get a fresh state dir per `runCookout` call
  unless they pass `COOKOUT_STATE_DIR`. CLI errors print the server's
  `details` too.
- "Lease ID" is used as the spec and #6 use it; the term itself is still
  proposed (see Plain words in names).

## The CLI

- `runCli(args, io)` in `client` runs every verb except `serve`. It prints
  the server's JSON answer on stdout and exits 0; on failure it prints
  `{ error: { code, message, status? } }` on stderr and exits 1 (`usage` for
  bad arguments, `url_missing` when `COOKOUT_URL` is unset).
- Verbs are `<noun> <verb>` (`identity create`, `channel list`, `message
  post`, `thread get`), each one entry in the `verbs` table in `cli.ts` with
  its positional count and the options it allows (`join` and `leave` are
  single words, as the spec names them). Any other option is a
  usage error. Numbers (`--reply-to`, `--before`, `--limit`) are checked
  as whole numbers; `--data` must be JSON.
- The SDK and CLI read `COOKOUT_URL` and `COOKOUT_TOKEN` (`createCookoutClient`
  takes an `env` option; tests pass `env: {}` so the developer's shell can't
  leak in).
- `packages/cookout/src/bin.ts` is the binary: `serve` goes to `serve.ts`
  (loaded lazily, so other verbs never open SQLite), everything else to
  `runCli`. `serve.ts` is the one start-up path that wires the real clock,
  token source and SQLite. There is no `server/src/start.ts` yet.

## Inject every clock, ID source and timer

Code never reads the time, makes a random ID or sets a timer on its own. It
takes a clock, an ID source or a scheduler as an argument, so leases, expiry
and retries are tested by moving a fake clock forward, never by sleeping. Only
the start-up entry points wire in the real ones, with an `eslint-disable`
comment that says why. Outside tests, ESLint bans `Date.now()`, `new Date()`
with no argument, `Math.random()`, `crypto.randomUUID()`, `setTimeout` and
`setInterval`.

The clock is `Clock = { now(): Date }` (exported by `server`). Timestamps on
the wire are ISO 8601 UTC strings (`date.toISOString()`).

## No SQL outside the adapter

SQL strings, migrations and driver calls live in `storage-sqlite` only. The
adapter interface in `protocol` speaks in domain operations ("append a
message", "take a lease"), never in rows or queries. Operations that must be
atomic are one adapter method each, so each adapter decides how to do the
transaction. Adapter methods return promises, even where SQLite is
synchronous, so a networked adapter (Postgres) fits the same interface.

- **Driver:** `node:sqlite` (`DatabaseSync`, built into Node >= 22.13, no
  native build). On open the adapter sets `journal_mode = WAL`,
  `synchronous = NORMAL`, `busy_timeout = 5000`, `foreign_keys = ON`.
- **Migrations** are an append-only list in `storage-sqlite/src/migrations.ts`;
  `PRAGMA user_version` records how many have run. Never edit or reorder a
  shipped migration; add a new one at the end. They run inside
  `openSqliteStorage`, which is called at server start, never during a build
  (the data volume isn't there at build time). Use `STRICT` tables.

## Plain words in names

Name things with plain words a newcomer understands. Use the domain words the
spec already uses: channel, message, thread, reply, identity, owner, token,
inbox, ack, read position, follow, subscribe, mention, command, webhook,
handler, lease, adapter, session. **A new domain term is checked with Matt
first.** Only Matt approves a term, and a term counts as approved here only
with a dated decision in the wiki (`~/repos/matt/personal-wiki/chief-of-staff/cookout/`)
cited next to it. Of the spec's "proposed terms", admin is approved (wiki
`decision-spec-defaults.md`, 2026-11-22, answer 2); command token, lease ID,
call ID, inbox reason and contract suite are not yet. Don't coin a word to
save typing; don't use two words for one thing.

## TypeScript

- `tsconfig.base.json` is strict (`strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noImplicitOverride`, `verbatimModuleSyntax`,
  `isolatedModules` and more). A package never loosens it.
- ESM only. Relative imports name the file with its `.ts` extension.
- Type-only imports use `import type` (enforced).
- No `any`, no non-null `!`, no `@ts-ignore`. Use `@ts-expect-error` with a
  reason if you must.
- Packages ship TypeScript source. `tsc` only type-checks (and emits
  declarations into `dist/`, which is ignored); bundling is the `cookout`
  package's job.
