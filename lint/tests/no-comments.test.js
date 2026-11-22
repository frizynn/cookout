import rule from "../rules/no-comments.js";
import { ruleTester } from "./rule-tester.js";

const interfaceJsDoc = [{ allowInterfaceJsDoc: true }];
function deleting(output) {
  return [{ messageId: "comment", suggestions: [{ messageId: "remove", output }] }];
}

ruleTester.run("no-comments", rule, {
  invalid: [
    { code: "// a note\nexport const a = 1;", errors: deleting("export const a = 1;") },
    { code: "/** The module. */\nexport const a = 1;", errors: deleting("export const a = 1;") },
    { code: "export const a = 1; // a note", errors: deleting("export const a = 1;"), options: interfaceJsDoc },
    {
      code: "export const a = 1;\n/* block */\nconst b = 2;",
      errors: deleting("export const a = 1;\nconst b = 2;"),
      options: interfaceJsDoc,
    },
    {
      code: "export const a = 1;\n/** not on an export */\nconst b = 2;",
      errors: deleting("export const a = 1;\nconst b = 2;"),
      options: interfaceJsDoc,
    },
    { code: "const a = /* why */ 1;", errors: deleting("const a = 1;") },
  ],
  valid: [
    { code: "export const a = 1;" },
    { code: "// oxlint-disable-next-line no-debugger\ndebugger;" },
    { code: "/** The module. */\nexport const a = 1;", options: interfaceJsDoc },
    { code: "/** The module. */\n\n/** What a does. */\nexport function a() {}", options: interfaceJsDoc },
    { code: "export type T = {\n  /** The name. */\n  readonly name: string;\n};", options: interfaceJsDoc },
    { code: "#!/usr/bin/env node\n/** The program. */\nexport {};", options: interfaceJsDoc },
  ],
});
