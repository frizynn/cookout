const R = "app/modules";
const INTERNALS = `^${R}/[^/]+/[^/]+/`;
const TESTS = `^${R}/[^/]+/tests/`;
const BACKEND = `^${R}/[^/]+/(server\\.ts$|lib/server/)`;
const ENTRIES = "^app/(main\\.ts|web\\.tsx)$";
const WEB = `^app/web\\.tsx$|^${R}/(design-system|session|board|unread|composer|live|routes|format|views)/`;
const PUBLISHED_ENTRIES = ["app/main.ts", `${R}/sdk/index.ts`];
const PUBLISHED_SDK = `${R}/sdk/index.ts`;
const exactly = (file) => `^${file.replaceAll(".", "\\.")}$`;

module.exports = {
  forbidden: [
    {
      name: "published-entries-ship-no-test-code",
      severity: "error",
      from: { path: PUBLISHED_ENTRIES.map(exactly) },
      to: { path: `^${R}/(testing|webhook-fake)/`, reachable: true },
    },
    {
      name: "published-sdk-reaches-no-effect",
      severity: "error",
      from: { path: exactly(PUBLISHED_SDK) },
      to: { path: "(^|/)node_modules/(effect|@effect/[^/]+)/", reachable: true },
    },
    {
      name: "entry-points-only-from-app",
      severity: "error",
      from: { pathNot: `^${R}/` },
      to: { path: INTERNALS },
    },
    {
      name: "entry-points-only-across-modules",
      severity: "error",
      from: { path: `^${R}/([^/]+)/`, pathNot: TESTS },
      to: { path: INTERNALS, pathNot: `^${R}/$1/` },
    },
    {
      name: "tests-through-entry-points",
      severity: "error",
      from: { path: `^${R}/([^/]+)/tests/` },
      to: { path: INTERNALS, pathNot: `^${R}/$1/tests/` },
    },
    {
      name: "tests-folder-is-private",
      severity: "error",
      from: { pathNot: TESTS },
      to: { path: TESTS },
    },
    {
      name: "server-code-only-from-server",
      severity: "error",
      from: { pathNot: BACKEND },
      to: { path: `^${R}/[^/]+/lib/server/` },
    },
    {
      name: "testing-only-from-tests",
      severity: "error",
      from: { pathNot: [TESTS, `^${R}/testing/`] },
      to: { path: `^${R}/testing/` },
    },
    {
      name: "webhook-fake-only-from-tests-and-dev",
      severity: "error",
      from: { pathNot: [TESTS, `^${R}/testing/`, `^${R}/webhook-fake/`, "^scripts/dev\\."] },
      to: { path: `^${R}/webhook-fake/` },
    },
    {
      name: "no-node-builtins-in-client",
      severity: "error",
      from: { path: "^app/", pathNot: [BACKEND, ENTRIES, TESTS] },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "client-never-imports-server",
      severity: "error",
      from: { path: "^app/", pathNot: [BACKEND, "^app/main\\.ts$", TESTS] },
      to: { path: `^${R}/[^/]+/server\\.ts$` },
    },
    {
      name: "sdk-imports-only-client-entry-points",
      severity: "error",
      from: { path: `^${R}/sdk/`, pathNot: `^${R}/sdk/tests/` },
      to: { path: `^${R}/(?!sdk/)[^/]+/`, pathNot: `^${R}/[^/]+/(index|client)\\.ts$` },
    },
    {
      name: "web-never-imports-backend-modules",
      severity: "error",
      from: { path: WEB },
      to: { path: `^${R}/(cli|storage|secrets)/|^${R}/config/server\\.ts$` },
    },
    {
      name: "sqlite-only-in-storage-adapter",
      severity: "error",
      from: { pathNot: `^${R}/storage/lib/server/adapters/sqlite\\.ts$` },
      to: { path: "^(node:)?sqlite$" },
    },
    {
      name: "no-undeclared-dependencies",
      severity: "error",
      from: {},
      to: { dependencyTypes: ["npm-no-pkg", "npm-unknown", "unknown", "undetermined"] },
    },
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    parser: "swc",
    doNotFollow: { path: "node_modules" },
    exclude: { path: "^app/modules/sdk/lib/generated/validators\\.d\\.ts$" },
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
    },
  },
};
