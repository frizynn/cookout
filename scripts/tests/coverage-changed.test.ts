import { expect, it } from "vitest";
import { parseJson } from "../lib/json.ts";
import { readFileSync } from "node:fs";
import { uncoveredLines } from "../lib/coverage-changed.ts";

const ROOT = "/repo";
const coverage = parseJson(readFileSync(new URL("fixtures/coverage-final.json", import.meta.url), "utf8"));

it("lists each uncovered line and branch in the changed files, once per line", { timeout: 1000 }, () => {
  expect.hasAssertions();

  const found = uncoveredLines({ changed: ["app/changed.ts", "app/covered.ts"], coverage, root: ROOT });

  expect(found).toStrictEqual(["app/changed.ts:2 uncovered line", "app/changed.ts:6 uncovered line and branch"]);
});

it("lists nothing when every changed line is covered", { timeout: 1000 }, () => {
  expect.hasAssertions();

  expect(uncoveredLines({ changed: ["app/covered.ts", "README.md"], coverage, root: ROOT })).toStrictEqual([]);
});
