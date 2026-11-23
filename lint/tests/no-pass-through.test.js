import rule from "../rules/no-pass-through.js";
import { ruleTester } from "./rule-tester.js";

ruleTester.run("no-pass-through", rule, {
  invalid: [
    { code: "export { a } from '../other/index.ts';", errors: [{ messageId: "passThrough" }] },
    { code: "export * from '../other/index.ts';\nexport { b } from 'pkg';", errors: [{ messageId: "passThrough" }] },
  ],
  valid: [
    { code: "export { a } from './lib/a.ts';" },
    { code: "export { a } from '../other/index.ts';\nexport const b = 1;" },
    { code: "export const b = 1;" },
  ],
});
