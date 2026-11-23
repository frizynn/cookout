# AGENTS.md

The cookout: a self-hosted, Slack-style board for people and agents. Spec: mattpocock/cookout#1.

- [GLOSSARY.md](GLOSSARY.md): the domain language. Names in code use its terms.
- `pnpm check` runs every check, as CI does. Run it once before you finish; it must exit 0. It waits while another `pnpm check` runs on the machine ([ADR 0036](docs/adr/0036-one-pnpm-check-at-a-time-per-machine.md)).
- `pnpm coverage:changed` runs the tests and lists, as `file:line`, every uncovered line or branch in files changed against v1. Run it before `pnpm check` to catch a coverage gap early.
- `pnpm merge-ticket <N>` merges ticket-N into v1. If it stops on a conflict, resolve it and commit on merge-ticket-N, then run `pnpm merge-ticket <N> --continue`: it checks and pushes, and merges again (reusing your resolution) if v1 moved.
- Don't run fix, format or lint commands yourself. Commit, and the pre-commit hook fixes and formats what you staged; then fix by hand only what it prints as left over.
- [docs/coding-standards.md](docs/coding-standards.md): the judgement calls no check makes. Read it before writing code.
- [docs/adr/](docs/adr/): why the code is shaped as it is.
- [docs/lint-opt-outs.md](docs/lint-opt-outs.md): every lint rule that is off or loosened, and why.
- `node_modules/effect/AGENTS.md` and `node_modules/effect/ai-docs/src/`: Effect's docs for the installed version. Read them before guessing an Effect v4 API.
- [docs/verification.md](docs/verification.md): how to run and drive the cookout to prove a change works.
- Only Matt approves a domain term. A term counts as approved only with a dated decision of Matt's cited next to it, in an ADR under `docs/adr/` or a comment on a mattpocock/cookout issue; without one it stays proposed.
- In a git worktree, create files with the Write tool (not `cat > … <<EOF`), run every command from the worktree root, and add root dependencies with `pnpm add -w`.
