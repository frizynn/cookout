import { ownClock } from "./rules/own-clock.js";
import { regionLookups } from "./rules/region-lookups.js";

const testRules = {
  meta: { name: "test-rules" },
  rules: {
    "own-clock": ownClock,
    "region-lookups": regionLookups,
  },
};

export { testRules as default };
