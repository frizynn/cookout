import { DONE, firstStop, git, lines, stepOf } from "./merge-steps.ts";
import { readFileSync, writeFileSync } from "node:fs";
import { renumbering, rewriteReferences } from "./adr-numbers.ts";
import type { Rename } from "./adr-numbers.ts";
import type { Step } from "./merge-steps.ts";
import path from "node:path";

interface AdrOptions {
  readonly adrs: string;
  readonly cwd: string;
  readonly log: (line: string) => void;
}

const NONE = 0;
const TEST_FOLDER = /(?:^|\/)tests\//u;
const V1 = "HEAD^1";

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

function rewriteAddedLines(options: AdrOptions, renames: readonly Rename[]): void {
  const changed = lines(
    git(options, "diff", "--name-only", "--no-renames", "--diff-filter=d", V1, "HEAD").output,
  ).filter((file) => !TEST_FOLDER.test(file));
  for (const file of changed) {
    const filePath = path.join(options.cwd, file);
    const before = linesAt(options, V1, file);
    const added = new Set([...linesAt(options, "HEAD", file)].filter((line) => !before.has(line)));
    if (added.size > NONE) {
      const source = readFileSync(filePath, "utf8").split("\n");
      writeFileSync(filePath, source.map((line) => rewriteLine(line, added, renames)).join("\n"));
    }
  }
}

function renumberAdrs(options: AdrOptions): Step {
  const v1 = lines(git(options, "ls-tree", "--name-only", V1, "--", `${options.adrs}/`).output);
  const added = lines(
    git(options, "diff", "--name-only", "--no-renames", "--diff-filter=A", V1, "HEAD", "--", options.adrs).output,
  );
  const renames = renumbering({ added, v1 });
  if (renames.length === NONE) {
    return DONE;
  }
  const listed = renames.map((rename) => `${rename.from.file} -> ${rename.to.file}`).join(", ");
  options.log(`Renumbering ADRs past v1's highest: ${listed}`);
  rewriteAddedLines(options, renames);
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
