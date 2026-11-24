import { expect, it } from "vitest";
import type { Diagnostic } from "../lib/tools.ts";
import { grownReport } from "../lib/lint-report.ts";

const diagnostics: readonly Diagnostic[] = [
  { code: "eslint(no-console)", filename: "app/a.ts", line: 3, message: "Unexpected console statement." },
  { code: "eslint(no-console)", filename: "app/a.ts", line: 9, message: "Unexpected console statement." },
  { code: "eslint(no-var)", filename: "app/b.ts", line: 1, message: "Unexpected var." },
  { code: "eslint(no-var)", filename: "app/old.ts", line: 4, message: "Unexpected var." },
];

it("prints each new violation once, then one summary line", { timeout: 1000 }, () => {
  expect.hasAssertions();
  expect(grownReport({ baseline: { "app/old.ts eslint(no-var)": 1 }, diagnostics, withCounts: false })).toStrictEqual([
    "app/a.ts:3 eslint(no-console) Unexpected console statement.",
    "app/a.ts:9 eslint(no-console) Unexpected console statement.",
    "app/b.ts:1 eslint(no-var) Unexpected var.",
    "3 new violations in 2 files",
  ]);
});

it("marks a violation in a count the baseline already allows some of", { timeout: 1000 }, () => {
  expect.hasAssertions();

  const baseline = { "app/a.ts eslint(no-console)": 1, "app/b.ts eslint(no-var)": 1, "app/old.ts eslint(no-var)": 1 };

  expect(grownReport({ baseline, diagnostics, withCounts: false })).toStrictEqual([
    "app/a.ts:3 eslint(no-console) Unexpected console statement. (one of 2; the baseline allows 1)",
    "app/a.ts:9 eslint(no-console) Unexpected console statement. (one of 2; the baseline allows 1)",
    "1 new violation in 1 file",
  ]);
});

it("adds the per-file count against the baseline only when asked", { timeout: 1000 }, () => {
  expect.hasAssertions();
  expect(grownReport({ baseline: { "app/old.ts eslint(no-var)": 1 }, diagnostics, withCounts: true })).toStrictEqual([
    "app/a.ts:3 eslint(no-console) Unexpected console statement.",
    "app/a.ts:9 eslint(no-console) Unexpected console statement.",
    "app/b.ts:1 eslint(no-var) Unexpected var.",
    "app/a.ts eslint(no-console): 2, baseline 0",
    "app/b.ts eslint(no-var): 1, baseline 0",
    "3 new violations in 2 files",
  ]);
});

it("prints nothing when no count grew", { timeout: 1000 }, () => {
  expect.hasAssertions();

  const baseline = { "app/a.ts eslint(no-console)": 2, "app/b.ts eslint(no-var)": 1, "app/old.ts eslint(no-var)": 1 };

  expect(grownReport({ baseline, diagnostics, withCounts: false })).toStrictEqual([]);
});
