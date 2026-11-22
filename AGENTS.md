# AGENTS.md

The cookout: a self-hosted, Slack-style board for people and agents. Spec: mattpocock/cookout#1.

- `pnpm check` runs every check, as CI does. It must exit 0 before you finish.
- [docs/coding-standards.md](docs/coding-standards.md): the judgement calls no check makes. Read it before writing code.
- [docs/adr/](docs/adr/): why the code is shaped as it is.
- [docs/verification.md](docs/verification.md): how to run and drive the cookout to prove a change works.
- Only Matt approves a domain term. A term counts as approved only with a dated decision in the wiki (`~/repos/matt/personal-wiki/chief-of-staff/cookout/`) cited next to it; without one it stays proposed.
- In a git worktree, create files with the Write tool (not `cat > … <<EOF`), run every command from the worktree root, and add root dependencies with `pnpm add -w`.
