# The design system is hand-written and shadcn-styled

2026-11-23 (mattpocock/cookout#90). Proposed, pending Matt.

mattpocock/cookout#54 and story 60 of the spec (mattpocock/cookout#1) ask for shadcn/ui components. The design system in `app/modules/design-system/` is instead a small set of hand-written Tailwind components that borrow shadcn/ui's token names (`bg-background`, `text-muted-foreground`, …) and the look of its card; there is no `components.json` and no Radix or cva dependency. The end-of-run review of 2026-11-23 found that the module's JSDoc still called them "shadcn/ui's components". _Assumption:_ the chief of staff chose, under Matt's 2026-11-23 instruction to choose the best answer and record it, to keep the components hand-written and shadcn-styled, and the JSDoc now says so.

## Considered options

- Generate the components with the shadcn CLI: not now. It would add Radix, cva and their transitive dependencies for the dozen plain elements the views use, and change every component's markup and its tests' accessible roles, for no change a person at the board sees.

## Consequences

- If Matt wants real shadcn/ui components, generating them is its own ticket; the views only import from `design-system/index.tsx`, so the swap stays inside that module.
