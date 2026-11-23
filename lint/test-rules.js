import { regionLookups } from "./rules/region-lookups.js";

const testRules = {
  meta: { name: "test-rules" },
  rules: {
    "region-lookups": regionLookups,
  },
};

export { testRules as default };
