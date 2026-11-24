import { expect, it } from "vitest";
import { firstError } from "../lib/first-error.ts";
import path from "node:path";
import { readFileSync } from "node:fs";

const MAX_LINES = 20;

function fixture(name: string): string {
  return readFileSync(path.join("scripts/tests/fixtures", name), "utf8");
}

it("finds the first failed test's assertion in vitest's output", { timeout: 1000 }, () => {
  expect.hasAssertions();

  const excerpt = firstError(fixture("vitest-failure.txt"));

  const [header, error] = excerpt;

  expect(header).toBe(" FAIL  |server| scripts/tests/zz-sample.test.ts > fails on an assertion");
  expect(error).toBe("AssertionError: expected { a: 1, b: [ 1, 2 ] } to strictly equal { a: 2, b: [ 1, 2 ] }");
  expect(excerpt.join("\n")).not.toContain("fails on a throw");
  expect(excerpt.length).toBeLessThanOrEqual(MAX_LINES);
});

it("finds the first failed browser test's error in playwright's output", { timeout: 1000 }, () => {
  expect.hasAssertions();

  const excerpt = firstError(fixture("playwright-failure.txt"));
  const [header] = excerpt;

  expect(header).toBe(
    "  1) [chromium] › login.browser.test.ts:5:1 › a person logs in with a token ────────────────────────",
  );
  expect(excerpt).toContain("    Error: expect(locator).toBeVisible() failed");
  expect(excerpt.join("\n")).not.toContain("a reply opens the thread");
  expect(excerpt).toHaveLength(MAX_LINES);
});

it("finds a server's error, up to its first blank line, when no test ran", { timeout: 1000 }, () => {
  expect.hasAssertions();

  expect(firstError(fixture("server-failure.txt"))).toStrictEqual([
    "Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'left-pad' imported from /repo/app/modules/http/server.ts",
    "    at packageResolve (node:internal/modules/esm/resolve:873:9)",
    "    at moduleResolve (node:internal/modules/esm/resolve:946:18) {",
    "  code: 'ERR_MODULE_NOT_FOUND'",
    "}",
  ]);
});

it("finds nothing in output with no error in it", { timeout: 1000 }, () => {
  expect.hasAssertions();

  expect(firstError("format: 2 files would change\n")).toStrictEqual([]);
});

it("drops colour codes from the excerpt", { timeout: 1000 }, () => {
  expect.hasAssertions();

  expect(firstError("\u001B[31mTypeError: boom\u001B[39m\n")).toStrictEqual(["TypeError: boom"]);
});
