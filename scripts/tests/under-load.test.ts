import { expect, it } from "vitest";
import { failingOnlyUnderLoad, failureList, filesOf, playwrightFailures, vitestFailures } from "../lib/under-load.ts";

const ROOT = "/repo";

const vitestReport = {
  testResults: [
    {
      assertionResults: [
        { fullName: "a thread opens", status: "passed" },
        { fullName: "a reply shows", status: "failed" },
      ],
      name: `${ROOT}/app/thread.test.tsx`,
      status: "failed",
    },
    { assertionResults: [], name: `${ROOT}/app/broken.test.tsx`, status: "failed" },
    { assertionResults: [{ fullName: "skipped", status: "skipped" }], name: `${ROOT}/app/ok.test.tsx` },
  ],
};

const playwrightReport = {
  suites: [
    {
      file: "menu.browser.test.ts",
      specs: [
        { file: "menu.browser.test.ts", tests: [{ status: "unexpected" }], title: "the menu opens" },
        { file: "menu.browser.test.ts", tests: [{ status: "expected" }], title: "the menu closes" },
      ],
      suites: [
        {
          file: "menu.browser.test.ts",
          specs: [{ file: "menu.browser.test.ts", tests: [{ status: "flaky" }], title: "retried" }],
          suites: [],
          title: "copy",
        },
      ],
      title: "menu.browser.test.ts",
    },
  ],
};

it("a Vitest report's failed tests are listed by file, and a file that failed outside a test is listed too", {
  timeout: 10_000,
}, () => {
  expect.hasAssertions();
  expect(vitestFailures({ base: ROOT, report: vitestReport })).toStrictEqual([
    { file: "app/thread.test.tsx", name: "a reply shows" },
    { file: "app/broken.test.tsx", name: "(the file failed outside any test)" },
  ]);
});

it("a Playwright report's failed tests are listed under the test directory, with their describe titles", {
  timeout: 10_000,
}, () => {
  expect.hasAssertions();
  expect(playwrightFailures({ base: "browser", report: playwrightReport })).toStrictEqual([
    { file: "browser/menu.browser.test.ts", name: "the menu opens" },
  ]);
});

it("a missing report lists no failures", { timeout: 10_000 }, () => {
  expect.hasAssertions();
  expect([
    ...vitestFailures({ base: ROOT, report: null }),
    ...playwrightFailures({ base: ROOT, report: {} }),
  ]).toStrictEqual([]);
});

it("a test that also failed alone is not a load failure, and one failing in two places is listed once", {
  timeout: 10_000,
}, () => {
  expect.hasAssertions();

  const thread = { file: "a.test.tsx", name: "opens" };
  const menu = { file: "b.test.tsx", name: "closes" };
  const onlyUnderLoad = failingOnlyUnderLoad({ alone: [{ ...thread }], underLoad: [thread, menu, menu] });

  expect(onlyUnderLoad).toStrictEqual([menu]);
  expect(filesOf([menu, thread, menu])).toStrictEqual(["a.test.tsx", "b.test.tsx"]);
  expect(failureList([thread])).toBe("  a.test.tsx > opens");
});
