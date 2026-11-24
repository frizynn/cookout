import { field, list, text } from "./json.ts";
import path from "node:path";

interface FailedTest {
  readonly file: string;
  readonly name: string;
}

interface Report {
  readonly base: string;
  readonly report: unknown;
}

const NONE = 0;
const PASSING = new Set(["passed", "skipped", "pending", "todo", "expected", "flaky"]);

function vitestFileFailures(result: unknown, root: string): readonly FailedTest[] {
  const file = path.relative(root, text(field(result, "name")) ?? "");
  const failed = (list(field(result, "assertionResults")) ?? []).flatMap((assertion) => {
    if (PASSING.has(text(field(assertion, "status")) ?? "")) {
      return [];
    }
    return [{ file, name: text(field(assertion, "fullName")) ?? "" }];
  });
  if (failed.length === NONE && text(field(result, "status")) === "failed") {
    return [{ file, name: "(the file failed outside any test)" }];
  }
  return failed;
}

function vitestFailures({ base, report }: Report): readonly FailedTest[] {
  return (list(field(report, "testResults")) ?? []).flatMap((result) => vitestFileFailures(result, base));
}

function playwrightSpecFailures(spec: unknown, prefix: readonly string[]): readonly FailedTest[] {
  const file = text(field(spec, "file")) ?? "";
  const name = [...prefix, text(field(spec, "title")) ?? ""].join(" > ");
  const failed = (list(field(spec, "tests")) ?? []).some((test) => !PASSING.has(text(field(test, "status")) ?? ""));
  if (!failed) {
    return [];
  }
  return [{ file, name }];
}

function playwrightSuiteFailures(suite: unknown, prefix: readonly string[]): readonly FailedTest[] {
  const title = text(field(suite, "title")) ?? "";
  let inner = [...prefix, title];
  if (text(field(suite, "file")) === title) {
    inner = [...prefix];
  }
  const specs = (list(field(suite, "specs")) ?? []).flatMap((spec) => playwrightSpecFailures(spec, inner));
  const suites = (list(field(suite, "suites")) ?? []).flatMap((child) => playwrightSuiteFailures(child, inner));
  return [...specs, ...suites];
}

function playwrightFailures({ base, report }: Report): readonly FailedTest[] {
  return (list(field(report, "suites")) ?? [])
    .flatMap((suite) => playwrightSuiteFailures(suite, []))
    .map((failure) => ({ file: path.join(base, failure.file), name: failure.name }));
}

function keyOf(test: FailedTest): string {
  return `${test.file} > ${test.name}`;
}

interface Runs {
  readonly alone: readonly FailedTest[];
  readonly underLoad: readonly FailedTest[];
}

function failingOnlyUnderLoad({ alone, underLoad }: Runs): readonly FailedTest[] {
  const failedAlone = new Set(alone.map((test) => keyOf(test)));
  const unique = new Map(underLoad.map((test) => [keyOf(test), test]));
  return [...unique.values()].filter((test) => !failedAlone.has(keyOf(test)));
}

function filesOf(tests: readonly FailedTest[]): readonly string[] {
  return [...new Set(tests.map((test) => test.file))].toSorted();
}

function failureList(tests: readonly FailedTest[]): string {
  return tests.map((test) => `  ${keyOf(test)}`).join("\n");
}

export type { FailedTest };
export { failingOnlyUnderLoad, failureList, filesOf, playwrightFailures, vitestFailures };
