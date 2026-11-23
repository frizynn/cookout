import { noInternalTag } from "../rules/no-internal-tag.js";
import { ruleTester } from "./rule-tester.js";

const errors = [{ messageId: "internal" }];

ruleTester.run("no-internal-tag", noInternalTag, {
  invalid: [
    { code: "/** @internal */\nexport const routes = [];", errors },
    { code: "/**\n * The routes.\n * @internal\n */\nexport const routes = [];", errors },
    { code: "/** The routes. @internal */\nfunction routes() {}", errors },
  ],
  valid: [
    { code: "/** The routes. */\nexport const routes = [];" },
    { code: "/** Reads `@internals` and `@internal-ish`, not the tag. */\nexport const routes = [];" },
    { code: "// @internal\nexport const routes = [];" },
  ],
});
