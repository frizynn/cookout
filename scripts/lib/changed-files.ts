import type { Outcome } from "./tools.ts";
import { spawnSync } from "node:child_process";

interface Changes {
  readonly base: string;
  readonly cwd: string;
}

const EXIT_SUCCESS = 0;

function listed(cwd: string, args: readonly string[]): Outcome<readonly string[]> {
  const ran = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (ran.status !== EXIT_SUCCESS) {
    return { ok: false, reason: `git ${args.join(" ")} failed: ${ran.stderr.trim()}` };
  }
  return { ok: true, value: ran.stdout.split("\n").filter((file) => file !== "") };
}

function changedFiles({ base, cwd }: Changes): Outcome<readonly string[]> {
  const diffed = listed(cwd, ["diff", "--name-only", "--diff-filter=d", "--merge-base", base]);
  if (!diffed.ok) {
    return diffed;
  }
  const untracked = listed(cwd, ["ls-files", "--others", "--exclude-standard"]);
  if (!untracked.ok) {
    return untracked;
  }
  return { ok: true, value: [...new Set([...diffed.value, ...untracked.value])].toSorted() };
}

export { changedFiles };
