import rule from "../rules/no-comments.js";
import { ruleTester } from "./rule-tester.js";

const interfaceJsDoc = [{ allowInterfaceJsDoc: true }];

ruleTester.run("no-comments", rule, {
  valid: [
    { code: "export const a = 1;" },
    { code: "// oxlint-disable-next-line no-debugger\ndebugger;" },
    { code: "/** The module. */\nexport const a = 1;", options: interfaceJsDoc },
    { code: "/** The module. */\n\n/** What a does. */\nexport function a() {}", options: interfaceJsDoc },
    { code: "export type T = {\n  /** The name. */\n  readonly name: string;\n};", options: interfaceJsDoc },
    { code: "#!/usr/bin/env node\n/** The program. */\nexport {};", options: interfaceJsDoc },
  ],
  invalid: [
    { code: "// a note\nexport const a = 1;", errors: [{ messageId: "comment" }] },
    { code: "/** The module. */\nexport const a = 1;", errors: [{ messageId: "comment" }] },
    { code: "export const a = 1; // a note", options: interfaceJsDoc, errors: [{ messageId: "comment" }] },
    {
      code: "export const a = 1;\n/* block */\nconst b = 2;",
      options: interfaceJsDoc,
      errors: [{ messageId: "comment" }],
    },
    {
      code: "export const a = 1;\n/** not on an export */\nconst b = 2;",
      options: interfaceJsDoc,
      errors: [{ messageId: "comment" }],
    },
  ],
});
