# AGENTS.md

The cookout: a self-hosted, Slack-style board for people and agents. Spec: mattpocock/cookout#1.

- `pnpm check` runs every check, as CI does. It must exit 0 before you finish.
- `app/main.ts` (Node) and `app/web.tsx` (browser) are the programs. Everything else is a module under `app/modules/`, reached only through its root files.
- Tests are `app/modules/*/tests/*.test.ts` on `@effect/vitest`; their Layers come from `app/modules/testing/server.ts`.
