import { changesetMissing, packageShips, shippedSources } from "../lib/changesets.ts";
import { expect, it } from "vitest";

const SHIPPED: ReadonlySet<string> = new Set(["app/main.ts", "docs/agents.md"]);
function ships(file: string): boolean {
  return SHIPPED.has(file);
}

it("fails a package change with no changeset, naming the changed files", { timeout: 1000 }, () => {
  expect.hasAssertions();

  const changes = [
    { file: "app/main.ts", status: "M" },
    { file: "docs/agents.md", status: "A" },
    { file: "README.md", status: "M" },
  ];

  expect(changesetMissing({ changes, ships })).toStrictEqual([
    "this changes files that ship in @ai-hero/cookout (app/main.ts, docs/agents.md), but adds no changeset since its merge base with v1. Add one with pnpm changeset, or pnpm changeset --empty for a change users never see, and commit it.",
  ]);
});

it("passes a package change with a changeset", { timeout: 1000 }, () => {
  expect.hasAssertions();

  const changes = [
    { file: "app/main.ts", status: "M" },
    { file: ".changeset/brave-dogs-sing.md", status: "A" },
  ];

  expect(changesetMissing({ changes, ships })).toStrictEqual([]);
});

it("passes a package change with an empty changeset", { timeout: 1000 }, () => {
  expect.hasAssertions();

  const changes = [
    { file: "app/main.ts", status: "M" },
    { file: ".changeset/quiet-cats-nap.md", status: "A" },
  ];

  expect(changesetMissing({ changes, ships })).toStrictEqual([]);
});

it("passes a change outside the package with no changeset", { timeout: 1000 }, () => {
  expect.hasAssertions();

  const changes = [
    { file: "scripts/check.ts", status: "M" },
    { file: "app/modules/sdk/tests/server/sdk.test.ts", status: "A" },
  ];

  expect(changesetMissing({ changes, ships })).toStrictEqual([]);
});

it("doesn't count an edit to an existing changeset or the folder's README as a new changeset", {
  timeout: 1000,
}, () => {
  expect.hasAssertions();

  const changes = [
    { file: "app/main.ts", status: "M" },
    { file: ".changeset/README.md", status: "A" },
    { file: ".changeset/old-news.md", status: "M" },
  ];

  expect(changesetMissing({ changes, ships })).toStrictEqual([
    "this changes files that ship in @ai-hero/cookout (app/main.ts), but adds no changeset since its merge base with v1. Add one with pnpm changeset, or pnpm changeset --empty for a change users never see, and commit it.",
  ]);
});

it("passes a release, which consumes changesets, with no new one", { timeout: 1000 }, () => {
  expect.hasAssertions();

  const changes = [
    { file: ".changeset/old-news.md", status: "D" },
    { file: "app/main.ts", status: "M" },
  ];

  expect(changesetMissing({ changes, ships })).toStrictEqual([]);
});

it("ships every file the build entries reach through relative imports, and the web page's assets", {
  timeout: 1000,
}, () => {
  expect.hasAssertions();

  const files: ReadonlyMap<string, string> = new Map([
    ["app/main.ts", 'import { run } from "./modules/cli/server.ts";\nimport { Effect } from "effect";'],
    ["app/modules/cli/server.ts", 'export * from "../sdk/index.ts";\nconst lazy = () => import("./lazy.ts");'],
    ["app/modules/cli/lazy.ts", 'import pkg from "../../../package.json" with { type: "json" };'],
    ["app/modules/sdk/index.ts", "export const sdk = 1;"],
    ["app/modules/cli/tests/server/cli.test.ts", 'import "../../server.ts";'],
    ["package.json", "{}"],
    ["index.html", '<script src="/assets/theme.js"></script><script type="module" src="/app/web.tsx"></script>'],
    ["public/assets/theme.js", ""],
    ["app/web.tsx", 'import { sdk } from "./modules/sdk/index.ts";'],
  ]);

  const shipped = shippedSources({ entries: ["app/main.ts", "index.html"], read: (file) => files.get(file) });

  expect([...shipped].toSorted()).toStrictEqual([
    "app/main.ts",
    "app/modules/cli/lazy.ts",
    "app/modules/cli/server.ts",
    "app/modules/sdk/index.ts",
    "app/web.tsx",
    "index.html",
    "package.json",
    "public/assets/theme.js",
  ]);
});

it("ships the package's CLI, SDK, web UI, listed files and API report, and not its tests or dev tools", {
  timeout: 5000,
}, async () => {
  expect.hasAssertions();

  const shipsInThePackage = await packageShips();

  expect(
    [
      "app/main.ts",
      "app/modules/sdk/index.ts",
      "app/web.tsx",
      "api/sdk.api.md",
      "docs/agents.md",
      "skills/cookout/SKILL.md",
      "app/dev.ts",
      "app/modules/sdk/tests/server/sdk.test.ts",
      "scripts/check.ts",
    ].map((file) => shipsInThePackage(file)),
  ).toStrictEqual([true, true, true, true, true, true, false, false, false]);
});
