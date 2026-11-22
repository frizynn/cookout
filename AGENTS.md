# AGENTS.md

The cookout: a self-hosted, Slack-style board for people and agents. Spec: mattpocock/cookout#1.

- [GLOSSARY.md](GLOSSARY.md): the domain language. Names in code use its terms.
- `pnpm check` runs every check, as CI does. It must exit 0 before you finish.
- [docs/coding-standards.md](docs/coding-standards.md): the judgement calls no check makes. Read it before writing code.
- [docs/adr/](docs/adr/): why the code is shaped as it is.
- `node_modules/effect/AGENTS.md` and `node_modules/effect/ai-docs/src/`: Effect's docs for the installed version. Read them before guessing an Effect v4 API.
- [docs/verification.md](docs/verification.md): how to run and drive the cookout to prove a change works.
- Only Matt approves a domain term. A term counts as approved only with a dated decision of Matt's cited next to it, in an ADR under `docs/adr/` or a comment on a mattpocock/cookout issue; without one it stays proposed.
- In a git worktree, create files with the Write tool (not `cat > … <<EOF`), run every command from the worktree root, and add root dependencies with `pnpm add -w`.
