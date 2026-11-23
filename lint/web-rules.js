import { pageTitleOwner } from "./rules/page-title-owner.js";

const webRules = {
  meta: { name: "web-rules" },
  rules: {
    "page-title-owner": pageTitleOwner,
  },
};

export { webRules as default };
