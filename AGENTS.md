# AGENTS.md

The cookout: a self-hosted, Slack-style board for people and agents. Spec: mattpocock/cookout#1.

- [GLOSSARY.md](GLOSSARY.md): the domain language. Names in code use its terms.
- `pnpm check` runs every check, as CI does. Run it once before you finish; it must exit 0. It waits while another `pnpm check` runs on the machine ([ADR 0036](docs/adr/0036-one-pnpm-check-at-a-time-per-machine.md)).
- `pnpm coverage:changed` runs the tests and lists, as `file:line`, every uncovered line or branch in files changed against v1. Run it before `pnpm check` to catch a coverage gap early.
- `pnpm merge-ticket <N>` merges ticket-N into v1. If it stops on a conflict, resolve it and commit on merge-ticket-N, then run `pnpm merge-ticket <N> --continue`: it checks and pushes. If v1 moved, either run merges the new v1 into your merge, keeping your fixes, and stops only if that merge conflicts. Before its check, it runs `pnpm install --frozen-lockfile` if the merged `pnpm-lock.yaml` differs from ticket-N's. It refuses to merge while v1's latest Check run or ticket-N's has a job that is not green, waiting for a run still in progress; only the ticket that fixes a red v1 passes `--fixes-red-v1`. After it pushes, it waits for the Check run of the merge on v1 and fails if any job is red.
- `pnpm ci:wait` waits for the Check push run of HEAD, polling every 30 s, prints each job's conclusion and each failed job's failed steps and last 20 log lines, and exits 0 only if every job passed (a job that failed only on a time budget warns). `pnpm ci:wait --sha <sha> --branch v1` watches a merge on v1. Use it to wait for CI; never hand-write `gh run watch`, and never pipe a watch, since a pipe hides its exit code.
- Don't run fix, format or lint commands yourself. Commit, and the pre-commit hook fixes and formats what you staged; then fix by hand only what it prints as left over: each new violation once, as `file:line rule message`, then "N new violations in M files". Commit with `scripts/commit.sh`, which takes `git commit`'s arguments: lefthook skips the whole hook when nothing is staged, so it fails then with "nothing staged: run git add first".
- [docs/coding-standards.md](docs/coding-standards.md): the judgement calls no check makes. Read it before writing code.
- [docs/adr/](docs/adr/): why the code is shaped as it is.
- [docs/lint-opt-outs.md](docs/lint-opt-outs.md): every lint rule that is off or loosened, and why.
- `node_modules/effect/AGENTS.md` and `node_modules/effect/ai-docs/src/`: Effect's docs for the installed version. Read them before guessing an Effect v4 API.
- [docs/verification.md](docs/verification.md): how to run and drive the cookout to prove a change works.
- [docs/web-components.md](docs/web-components.md): the React component shape the UI lint rules accept. Read it before writing or changing a `.tsx` file. `pnpm screenshots` takes the standard screens in both themes.
- Only Matt approves a domain term. A term counts as approved only with a dated decision of Matt's cited next to it, in an ADR under `docs/adr/` or a comment on a mattpocock/cookout issue; without one it stays proposed.
- In a git worktree, create files with the Write tool (not `cat > … <<EOF`), run every command from the worktree root, and add root dependencies with `pnpm add -w`.
