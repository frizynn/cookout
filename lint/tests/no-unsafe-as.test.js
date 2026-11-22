import rule from "../rules/no-unsafe-as.js";
import { ruleTester } from "./rule-tester.js";

ruleTester.run("no-unsafe-as", rule, {
  valid: [
    { code: "const a = [1, 2] as const;" },
    { code: "const a = { b: 1 } satisfies Record<string, number>;" },
    { code: "function brand<T>(value: string) { return value as T; }" },
    { code: "const brand = <T,>(value: string) => value as T;" },
  ],
  invalid: [
    { code: "const a = b as string;", errors: [{ messageId: "assertion" }] },
    { code: "const a = <string>b;", errors: [{ messageId: "assertion" }] },
    { code: "function f(value: unknown) { return value as string; }", errors: [{ messageId: "assertion" }] },
  ],
});
