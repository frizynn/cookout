# AGENTS.md

The cookout: a self-hosted, Slack-style board for people and agents. Spec:
mattpocock/cookout#1. pnpm workspace, packages in `packages/`.

- Before you finish any change, run `pnpm check` (typecheck, lint, boundary
  check, tests). It must exit 0, and CI runs the same command.
- Read `CODING_STANDARDS.md` before writing code. It holds the package
  layout, the boundary rules and why they exist.
- Import another package only by its name (`@ai-hero/cookout-<name>`), which
  resolves to its one entry point, `src/index.ts`.
- Never loosen `tsconfig.base.json`, `eslint.config.js` or
  `.dependency-cruiser.cjs` to get the check green. Fix the code, or change
  the rule in its own commit and say why.
- Check new domain terms with Matt before using them in names.
