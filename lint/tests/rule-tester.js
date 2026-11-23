import { describe, it } from "vitest";
import { RuleTester } from "oxlint/plugins-dev";

RuleTester.describe = describe;
RuleTester.it = it;

export const ruleTester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });
