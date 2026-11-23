# Agents rely on the pre-commit hook for fixes

2026-11-23 (mattpocock/cookout#40, part of mattpocock/cookout#1). Matt's decision, on 2026-11-23: "I want to make sure that the agent is not needing to run excessive commands itself. For instance, to format or fix lint rules. In other words, the agent can just rely on the precommit hook to handle all of that." This departs from the target's "run `pnpm fix` before reading any diagnostic".

The #7 implementer ran `pnpm fix` 26 times, while the pre-commit hook in `lefthook.yml` already runs the lint ratchet with `--fix` and Biome format on the staged files (`stage_fixed: true`), then types and seams. So AGENTS.md tells an agent not to run fix, format or lint commands, but to commit and fix by hand only what the hook prints as left over, and to run `pnpm check` once before finishing. For that to work, a blocked commit prints only the remaining diagnostics: `lefthook.yml` sets `output: [execution_out]`, which drops Lefthook's banner, job headers and summary, and `scripts/quiet.sh` keeps the format and seams jobs silent unless they fail. A lint diagnostic prints as `file:line rule message`. `pnpm fix` and `pnpm check` are unchanged, and CI never fixes.

## Considered Options

- **Keep "run `pnpm fix` before reading any diagnostic"**: rejected by Matt, because the hook already applies the same fixes on every commit, and the extra runs cost an agent tool calls.
- **Leave the hook's output as it was**: rejected, because a refused commit also printed Lefthook's banner, every job's header, Biome's and dependency-cruiser's success lines and a summary, which an agent has to read past to find the diagnostics.

## Consequences

The hook fixes only staged files, so an agent sees what is left only when it commits; a change it never commits is never fixed until `pnpm check` reports it. Each ticket's history carries the hook's fixes in the agent's own commits. A failing job also prints Lefthook's `exit status 1` line, which Lefthook gives no way to drop.
