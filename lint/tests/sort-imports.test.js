import { ruleTester } from "./rule-tester.js";
import { sortImports } from "../rules/sort-imports.js";

const sorted =
  'import "./side.ts";\nimport * as ns from "./ns.ts";\nimport { a, b } from "./x.ts";\nimport def from "./d.ts";';

ruleTester.run("sort-imports", sortImports, {
  invalid: [
    {
      code: 'import { b } from "./b.ts";\nimport { a } from "./a.ts";',
      errors: [{ messageId: "declarationOrder" }],
      output: 'import { a } from "./a.ts";\nimport { b } from "./b.ts";',
    },
    {
      code: 'import { a } from "./a.ts";\n\nimport type { B, C } from "./b.ts";',
      errors: [{ data: { current: "Multiple", previous: "Single" }, messageId: "syntaxOrder" }],
      output: 'import type { B, C } from "./b.ts";\n\nimport { a } from "./a.ts";',
    },
    {
      code: 'import { Z } from "./z.ts";\nimport { a } from "./a.ts";\nimport { B } from "./b.ts";',
      errors: [{ messageId: "declarationOrder" }],
      output: 'import { B } from "./b.ts";\nimport { Z } from "./z.ts";\nimport { a } from "./a.ts";',
    },
    {
      code: 'import def from "./d.ts";\nimport { a, b } from "./x.ts";\nimport * as ns from "./ns.ts";\nimport "./side.ts";',
      errors: [{ messageId: "syntaxOrder" }, { messageId: "syntaxOrder" }, { messageId: "syntaxOrder" }],
      output: sorted,
    },
    {
      code: 'import { c, a, b } from "./x.ts";',
      errors: [{ data: { member: "a" }, messageId: "memberOrder" }],
      output: 'import { a, b, c } from "./x.ts";',
    },
    {
      code: 'import d, {\n  type C,\n  type A,\n} from "./x.ts";',
      errors: [{ messageId: "memberOrder" }],
      output: 'import d, {\n  type A,\n  type C,\n} from "./x.ts";',
    },
    {
      code: 'import { b } from "./b.ts";\nconst x = 1;\nimport { a } from "./a.ts";',
      errors: [{ messageId: "declarationOrder" }],
    },
    {
      code: 'import { b } from "./b.ts";\n// why\nimport { a } from "./a.ts";',
      errors: [{ messageId: "declarationOrder" }],
    },
    { code: 'import { c, /* why */ a } from "./x.ts";', errors: [{ messageId: "memberOrder" }] },
  ],
  valid: [
    { code: "export const x = 1;" },
    { code: sorted },
    { code: 'import { a } from "./a.ts";\nimport { b } from "./b.ts";' },
    { code: 'import "./z.ts";\nimport "./a.ts";' },
    { code: 'import { B } from "./b.ts";\nimport { a } from "./a.ts";' },
    { code: 'import { a } from "./a.ts";\nexport const x = 1;\nimport { b } from "./b.ts";' },
  ],
});
