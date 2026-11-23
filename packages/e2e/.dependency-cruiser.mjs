const MODULES = "packages/e2e/app/modules";
const INTERNALS = `^${MODULES}/[^/]+/[^/]+/`;
const TESTS = `^${MODULES}/[^/]+/tests/`;
const TESTED_INTERFACES = ["cookout"];
const SDK = String.raw`^app/modules/sdk/index\.ts$`;

const config = {
  forbidden: [
    {
      from: { pathNot: `^${MODULES}/` },
      name: "entry-points-only-from-app",
      severity: "error",
      to: { path: INTERNALS },
    },
    {
      from: { path: `^${MODULES}/([^/]+)/`, pathNot: TESTS },
      name: "entry-points-only-across-modules",
      severity: "error",
      to: { path: INTERNALS, pathNot: `^${MODULES}/$1/` },
    },
    {
      from: { path: `^${MODULES}/([^/]+)/tests/` },
      name: "tests-through-entry-points",
      severity: "error",
      to: { path: INTERNALS, pathNot: `^${MODULES}/$1/tests/` },
    },
    {
      from: {
        path: String.raw`\.test\.tsx?$`,
        pathNot: `^${MODULES}/(${TESTED_INTERFACES.join("|")})/tests/`,
      },
      name: "tests-only-at-tested-interfaces",
      severity: "error",
      to: {},
    },
    {
      from: { pathNot: TESTS },
      name: "tests-folder-is-private",
      severity: "error",
      to: { path: TESTS },
    },
    {
      from: { path: `^${MODULES}/` },
      name: "e2e-drives-only-the-published-surface",
      severity: "error",
      to: { path: "^app/", pathNot: SDK },
    },
    {
      from: {},
      name: "no-undeclared-dependencies",
      severity: "error",
      to: { dependencyTypes: ["npm-no-pkg", "npm-unknown", "unknown", "undetermined"], pathNot: SDK },
    },
    {
      from: {},
      name: "no-circular",
      severity: "error",
      to: { circular: true },
    },
  ],
  options: {
    combinedDependencies: true,
    doNotFollow: { path: "node_modules" },
    enhancedResolveOptions: {
      conditionNames: ["import", "require", "node", "default", "types"],
      exportsFields: ["exports"],
    },
    parser: "swc",
    tsConfig: { fileName: "tsconfig.json" },
  },
};

export default config;
