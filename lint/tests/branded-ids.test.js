import rule from "../rules/branded-ids.js";
import { ruleTester } from "./rule-tester.js";

ruleTester.run("branded-ids", rule, {
  valid: [
    { code: "type T = { readonly messageId: MessageId };" },
    { code: "class A { leaseId: LeaseId = lease(); }" },
    { code: "function f(id: ChannelName) {}" },
    { code: "type T = { readonly identity: string };" },
  ],
  invalid: [
    { code: "type T = { readonly leaseId: string };", errors: [{ messageId: "bare" }] },
    { code: "class A { id: number = 1; }", errors: [{ messageId: "bare" }] },
    { code: "function f(messageId: number) {}", errors: [{ messageId: "bare" }] },
  ],
});
