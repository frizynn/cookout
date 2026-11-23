import { noInternalTag } from "./rules/no-internal-tag.js";

const exportRules = {
  meta: { name: "export-rules" },
  rules: {
    "no-internal-tag": noInternalTag,
  },
};

export { exportRules as default };
