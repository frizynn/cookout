import { ownClock as rule } from "../rules/own-clock.js";
import { ruleTester } from "./rule-tester.js";

ruleTester.run("own-clock", rule, {
  invalid: [
    { code: "await moveClockForward({ clockUrl, days: 3 });", errors: [{ messageId: "sharedClock" }] },
    { code: "await testing.moveClockForward({ clockUrl, days: 3 });", errors: [{ messageId: "sharedClock" }] },
  ],
  valid: [
    { code: "await cookout.daysPass(3);" },
    { code: "await moveClock(3);" },
    { code: "const move = moveClockForward;" },
  ],
});
