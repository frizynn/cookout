import allowedDirectives from "./rules/allowed-directives.js";
import brandedIds from "./rules/branded-ids.js";
import effectErrors from "./rules/effect-errors.js";
import maxFileTokens from "./rules/max-file-tokens.js";
import noComments from "./rules/no-comments.js";
import noOverloads from "./rules/no-overloads.js";
import noPassThrough from "./rules/no-pass-through.js";
import noUnsafeAs from "./rules/no-unsafe-as.js";

export default {
  meta: { name: "local" },
  rules: {
    "allowed-directives": allowedDirectives,
    "branded-ids": brandedIds,
    "effect-errors": effectErrors,
    "max-file-tokens": maxFileTokens,
    "no-comments": noComments,
    "no-overloads": noOverloads,
    "no-pass-through": noPassThrough,
    "no-unsafe-as": noUnsafeAs,
  },
};
