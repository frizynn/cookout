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

interface Rewrite {
  readonly before: string;
  readonly changed: readonly string[];
  readonly renames: readonly Rename[];
}

function rewriteAddedLines(options: AdrOptions, { before, changed, renames }: Rewrite): readonly string[] {
  return changed
    .filter((file) => !TEST_FOLDER.test(file))
    .filter((file) => {
      const filePath = path.join(options.cwd, file);
      const source = readFileSync(filePath, "utf8").split("\n");
      const old = linesAt(options, before, file);
      const added = new Set(source.filter((line) => !old.has(line)));
      const rewritten = source.map((line) => rewriteLine(line, added, renames));
      if (rewritten.every((line, index) => line === source[index])) {
        return false;
      }
      writeFileSync(filePath, rewritten.join("\n"));
      return true;
    });
}

function renamesAgainst(options: AdrOptions, v1: string, added: readonly string[]): readonly Rename[] {
  const renames = renumbering({
    added,
    v1: lines(git(options, "ls-tree", "--name-only", v1, "--", `${options.adrs}/`).output),
  });
  if (renames.length > NONE) {
    const listed = renames.map((rename) => `${rename.from.file} -> ${rename.to.file}`).join(", ");
    options.log(`Renumbering ADRs past v1's highest: ${listed}`);
  }
  return renames;
}

function moves(options: AdrOptions, renames: readonly Rename[]): readonly (() => Step)[] {
  return renames.map(
    (rename) => (): Step => stepOf({ ran: git(options, "mv", rename.from.file, rename.to.file), what: "git mv" }),
  );
}

function renumberAdrs(options: AdrOptions): Step {
  const added = lines(
    git(options, "diff", "--name-only", "--no-renames", "--diff-filter=A", V1, "HEAD", "--", options.adrs).output,
  );
  const renames = renamesAgainst(options, V1, added);
  if (renames.length === NONE) {
    return DONE;
  }
  const changed = lines(git(options, "diff", "--name-only", "--no-renames", "--diff-filter=d", V1, "HEAD").output);
  rewriteAddedLines(options, { before: V1, changed, renames });
  return firstStop([
    ...moves(options, renames),
    (): Step => stepOf({ ran: git(options, "add", "-u"), what: "git add -u" }),
    (): Step =>
      stepOf({ ran: git(options, "commit", "-q", "--amend", "--no-edit"), what: "Committing the renumbered ADRs" }),
  ]);
}

function staged(options: AdrOptions, renames: readonly Rename[], rewritten: readonly string[]): readonly string[] {
  const conflicted = new Set(lines(git(options, "diff", "--name-only", "--diff-filter=U").output));
  const moved = new Set(renames.map((rename) => rename.from.file));
  return [
    ...rewritten.filter((file) => !conflicted.has(file) && !moved.has(file)),
    ...renames.map((rename) => rename.to.file),
  ];
}

function renumberOpenMerge(options: AdrOptions): Step {
  const added = lines(
    git(options, "diff", "--cached", "--name-only", "--no-renames", "--diff-filter=A", "HEAD", "--", options.adrs)
      .output,
  );
  const renames = renamesAgainst(options, "HEAD", added);
  if (renames.length === NONE) {
    return DONE;
  }
  const changed = lines(git(options, "diff", "--name-only", "--no-renames", "--diff-filter=d", "HEAD").output);
  const toStage = staged(options, renames, rewriteAddedLines(options, { before: "HEAD", changed, renames }));
  return firstStop([
    ...moves(options, renames),
    (): Step => stepOf({ ran: git(options, "add", "--", ...toStage), what: "git add" }),
  ]);
}

export { renumberAdrs, renumberOpenMerge };
