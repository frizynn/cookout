import rule from "../rules/no-overloads.js";
import { ruleTester } from "./rule-tester.js";

ruleTester.run("no-overloads", rule, {
  valid: [
    { code: "function f(a: string | number) { return a; }" },
    { code: "declare function f(a: string): void;" },
    { code: "abstract class A { abstract f(): void; }" },
  ],
  invalid: [
    {
      code: "function f(a: string): string;\nfunction f(a: number): number;\nfunction f(a: unknown) { return a; }",
      errors: [{ messageId: "overload" }, { messageId: "overload" }],
    },
    {
      code: "class A { f(a: string): void;\nf(a: unknown) {} }",
      errors: [{ messageId: "overload" }],
    },
  ],
});
