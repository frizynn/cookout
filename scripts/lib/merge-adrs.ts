import { DONE, firstStop, git, lines, stepOf } from "./merge-steps.ts";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { renumbering, rewriteReferences } from "./adr-numbers.ts";
import type { Rename } from "./adr-numbers.ts";
import type { Step } from "./merge-steps.ts";
import path from "node:path";

interface AdrOptions {
  readonly adrs: string;
  readonly cwd: string;
  readonly log: (line: string) => void;
}

interface Rewrite {
  readonly base: string;
  readonly options: AdrOptions;
  readonly renames: readonly Rename[];
}

const NONE = 0;

function linesAt(options: AdrOptions, revision: string, file: string): ReadonlySet<string> {
  const shown = git(options, "show", `${revision}:${file}`);
  if (!shown.ok) {
    return new Set();
  }
  return new Set(shown.output.split("\n"));
}

function rewriteLine(line: string, added: ReadonlySet<string>, renames: readonly Rename[]): string {
  if (added.has(line)) {
    return rewriteReferences({ renames, text: line });
  }
  return line;
}

function rewriteAddedLines({ base, options, renames }: Rewrite): void {
  const changed = lines(git(options, "diff", "--name-only", "--diff-filter=d", base, "HEAD^2").output);
  for (const file of changed) {
    const filePath = path.join(options.cwd, file);
    const before = linesAt(options, base, file);
    const added = new Set([...linesAt(options, "HEAD^2", file)].filter((line) => !before.has(line)));
    if (existsSync(filePath) && added.size > NONE) {
      const source = readFileSync(filePath, "utf8").split("\n");
      writeFileSync(filePath, source.map((line) => rewriteLine(line, added, renames)).join("\n"));
    }
  }
}

function renumberAdrs(options: AdrOptions): Step {
  const base = git(options, "merge-base", "HEAD^1", "HEAD^2").output;
  const v1 = lines(git(options, "ls-tree", "--name-only", "HEAD^1", "--", `${options.adrs}/`).output);
  const added = lines(
    git(options, "diff", "--name-only", "--diff-filter=A", base, "HEAD^2", "--", options.adrs).output,
  ).filter((file) => existsSync(path.join(options.cwd, file)));
  const renames = renumbering({ added, v1 });
  if (renames.length === NONE) {
    return DONE;
  }
  const listed = renames.map((rename) => `${rename.from.file} -> ${rename.to.file}`).join(", ");
  options.log(`Renumbering ADRs past v1's highest: ${listed}`);
  rewriteAddedLines({ base, options, renames });
  return firstStop([
    ...renames.map(
      (rename) => (): Step => stepOf({ ran: git(options, "mv", rename.from.file, rename.to.file), what: "git mv" }),
    ),
    (): Step => stepOf({ ran: git(options, "add", "-u"), what: "git add -u" }),
    (): Step =>
      stepOf({ ran: git(options, "commit", "-q", "--amend", "--no-edit"), what: "Committing the renumbered ADRs" }),
  ]);
}

export { renumberAdrs };
