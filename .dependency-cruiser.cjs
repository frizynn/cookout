// @ts-check
// Boundary rules for the cookout workspace, run by `pnpm lint:boundaries`
// (part of `pnpm check`). tests/boundaries.test.ts proves each rule fires.
//
// Layout: packages/<name>/src/index.ts is a package's ONE entry point. Every
// other file in a package is private. Other packages reach it only by its
// package name (`@ai-hero/cookout-<name>`), which resolves to that entry point.
// Tests live in packages/<name>/tests/ and use the entry point too.
//
// Why dependency-cruiser and not ESLint `no-restricted-imports`: these rules
// are about where a file IS and what an import RESOLVES TO (a file in another
// package, a cycle). ESLint only sees the import string, so it cannot tell a
// relative path into another package's internals from a local one, and it
// cannot find cycles.

const PKG = "^packages/([^/]+)/";
const ENTRY = "^packages/[^/]+/src/index\\.ts$";
const TEST_FILE = "^packages/[^/]+/tests/";

/** Any SQLite driver, by module name (resolved or not) or node_modules path. */
const SQLITE_DRIVERS = [
  "^(node:)?sqlite$",
  "^better-sqlite3$",
  "^sqlite3$",
  "^sqlite$",
  "^@libsql/",
  "^libsql$",
  "^bun:sqlite$",
  "^sql\\.js$",
  "(^|/)node_modules/(better-sqlite3|sqlite3|sqlite|libsql|@libsql/[^/]+|sql\\.js)/",
].join("|");

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "sqlite-only-in-storage-sqlite",
      comment:
        "Only packages/storage-sqlite may import a SQLite driver. Everything else talks to storage through the adapter interface in protocol.",
      severity: "error",
      from: { pathNot: "^packages/storage-sqlite/" },
      to: { path: SQLITE_DRIVERS },
    },
    {
      name: "no-storage-outside-start-up",
      comment:
        "server, client and web never import a concrete storage adapter; they receive one. Exceptions: test files, the server's start-up entry point (packages/server/src/start.ts) and the published cookout package (`cookout serve`).",
      severity: "error",
      from: {
        path: "^packages/(server|client|web)/",
        pathNot: [TEST_FILE, "^packages/server/src/start\\.ts$"],
      },
      // The second pattern catches the import even before the package is a
      // dependency (it then does not resolve to a path).
      to: {
        path: ["^packages/storage-(sqlite|memory)/", "^@ai-hero/cookout-storage-(sqlite|memory)(/|$)"],
      },
    },
    {
      name: "no-server-in-client-or-web",
      comment:
        "client and web talk to the server over HTTP only. They never import it, not even in tests.",
      severity: "error",
      from: { path: "^packages/(client|web)/" },
      to: { path: ["^packages/server/", "^@ai-hero/cookout-server(/|$)"] },
    },
    {
      name: "only-through-entry-points",
      comment:
        "A package reaches another package only through its entry point (src/index.ts), never its internal files.",
      severity: "error",
      from: { path: PKG },
      to: {
        // Also a deep import by package name, e.g. `@ai-hero/cookout-protocol/src/x.ts`.
        path: ["^packages/", "^@ai-hero/cookout[a-z-]*/."],
        pathNot: ["^packages/$1/", ENTRY],
      },
    },
    {
      name: "import-packages-by-name",
      comment:
        "Import another package by its name (`@ai-hero/cookout-<name>`), not by a relative path to its entry file, so package.json dependencies and tsconfig references stay true.",
      severity: "error",
      from: { path: PKG },
      to: {
        path: ENTRY,
        pathNot: "^packages/$1/",
        dependencyTypes: ["local"],
      },
    },
    {
      name: "tests-through-entry-points",
      comment:
        "A package's tests use it the way a caller does: through its entry point (and their own tests/ helpers), never its internal files.",
      severity: "error",
      from: { path: "^packages/([^/]+)/tests/" },
      to: {
        path: "^packages/$1/",
        pathNot: ["^packages/$1/tests/", ENTRY],
      },
    },
    {
      name: "tests-folder-is-private",
      comment: "Only tests import from a tests/ folder.",
      severity: "error",
      from: { pathNot: TEST_FILE },
      to: { path: TEST_FILE },
    },
    {
      name: "no-cycles",
      comment: "No dependency cycles, inside a package or between packages.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)(dist|node_modules)/" },
    tsConfig: { fileName: "tsconfig.base.json" },
    // Count imports as TypeScript writes them, so a type-only import of an
    // internal file is caught too.
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"],
    },
  },
};
