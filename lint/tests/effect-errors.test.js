import rule from "../rules/effect-errors.js";
import { ruleTester } from "./rule-tester.js";

ruleTester.run("effect-errors", rule, {
  valid: [{ code: "const a = Effect.fail(new Refused());" }, { code: "const a = Effect.try({ try: f, catch: g });" }],
  invalid: [
    { code: "throw new Error('no');", errors: [{ messageId: "throw" }] },
    { code: "try { f(); } catch { g(); }", errors: [{ messageId: "try" }] },
  ],
});
