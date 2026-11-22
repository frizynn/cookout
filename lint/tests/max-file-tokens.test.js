import rule from "../rules/max-file-tokens.js";
import { ruleTester } from "./rule-tester.js";

const sized = (characters) => `export const a = "${"x".repeat(characters - 22)}";`;

ruleTester.run("max-file-tokens", rule, {
  valid: [{ code: sized(400), options: [{ max: 100 }] }],
  invalid: [{ code: sized(404), options: [{ max: 100 }], errors: [{ messageId: "tooLong" }] }],
});
