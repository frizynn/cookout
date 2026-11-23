import rule from "../rules/allowed-directives.js";
import { ruleTester } from "./rule-tester.js";

const options = [{ allowlist: "lint/tests/fixtures/allowed-directives.json" }];
const inRepo = (path) => new URL(`../../${path}`, import.meta.url).pathname;
const filename = inRepo("app/modules/storage/lib/server/adapters/sqlite.ts");
const errors = [{ messageId: "directive" }];

ruleTester.run("allowed-directives", rule, {
  invalid: [
    {
      code: "// oxlint-disable-next-line no-debugger\ndebugger;",
      errors,
      filename: inRepo("app/modules/http/server.ts"),
      options,
      output: "debugger;",
    },
    {
      code: "// eslint-disable-next-line no-console\nconst a = 1;",
      errors,
      filename,
      options,
      output: "const a = 1;",
    },
    { code: "// @ts-expect-error\nconst a: string = 1;", errors, filename, options, output: "const a: string = 1;" },
    {
      code: "const a = 1;\n  // biome-ignore lint: no\r\nconst b = 2;",
      errors,
      filename,
      options,
      output: "const a = 1;\nconst b = 2;",
    },
    {
      code: "debugger; // oxlint-disable-line no-debugger\nconst a = 1;",
      errors,
      filename,
      options,
      output: "debugger;\nconst a = 1;",
    },
    {
      code: "/* @ts-expect-error */ const a: string = 1;",
      errors,
      filename,
      options,
      output: "const a: string = 1;",
    },
    { code: "const a = /* @ts-expect-error */ 1;", errors, filename, options, output: "const a = 1;" },
  ],
  valid: [
    { code: "// oxlint-disable-next-line no-debugger\ndebugger;", filename, options },
    { code: "// a plain comment\nconst a = 1;", filename, options },
  ],
});
