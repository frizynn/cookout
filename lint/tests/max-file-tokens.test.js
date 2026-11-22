import rule from "../rules/max-file-tokens.js";
import { ruleTester } from "./rule-tester.js";

const sized = (characters) => `export const a = "${"x".repeat(characters - 22)}";`;

ruleTester.run("max-file-tokens", rule, {
  invalid: [{ code: sized(404), errors: [{ messageId: "tooLong" }], options: [{ max: 100 }] }],
  valid: [{ code: sized(400), options: [{ max: 100 }] }],
});
