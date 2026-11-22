import rule from "../rules/allowed-directives.js";
import { ruleTester } from "./rule-tester.js";

const options = [{ allowlist: "lint/tests/fixtures/allowed-directives.json" }];
const inRepo = (path) => new URL(`../../${path}`, import.meta.url).pathname;
const filename = inRepo("app/modules/storage/lib/server/adapters/sqlite.ts");

ruleTester.run("allowed-directives", rule, {
  valid: [
    { code: "// oxlint-disable-next-line no-debugger\ndebugger;", options, filename },
    { code: "// a plain comment\nconst a = 1;", options, filename },
  ],
  invalid: [
    {
      code: "// oxlint-disable-next-line no-debugger\ndebugger;",
      options,
      filename: inRepo("app/modules/http/server.ts"),
      errors: [{ messageId: "directive" }],
    },
    {
      code: "// eslint-disable-next-line no-console\nconst a = 1;",
      options,
      filename,
      errors: [{ messageId: "directive" }],
    },
    { code: "// @ts-expect-error\nconst a: string = 1;", options, filename, errors: [{ messageId: "directive" }] },
    { code: "// biome-ignore lint: no\nconst a = 1;", options, filename, errors: [{ messageId: "directive" }] },
  ],
});
