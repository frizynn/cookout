import { DONE, git, stop } from "./merge-steps.ts";
import type { Step } from "./merge-steps.ts";
import { oxlintFindings } from "./merge-lint-config.ts";
import { parseJson } from "./json.ts";

interface LintOptions {
  readonly approved?: string;
  readonly cwd: string;
  readonly log: (line: string) => void;
  readonly ticket: number;
}

interface Report {
  readonly file: string;
  readonly hunks: readonly string[];
  readonly what: string;
}

interface Diff {
  readonly base: string;
  readonly file: string;
  readonly options: LintOptions;
}

type Guard = (diff: Diff, hunks: readonly string[]) => readonly Report[];

const NONE = 0;
const HEADER_LINE = 1;
const HUNK_START = "@@";
const ADDED_ENTRY = "+- ";
const REMOVED_ENTRY = "-- ";

function ticketOf(options: LintOptions): string {
  return `ticket-${options.ticket}`;
}

function hunksOf(diff: Diff): readonly string[] {
  return git(diff.options, "diff", diff.base, ticketOf(diff.options), "--", diff.file)
    .output.split(/\n(?=@@)/u)
    .filter((chunk) => chunk.startsWith(HUNK_START));
}

function changedLines(hunk: string): readonly string[] {
  return hunk
    .split("\n")
    .slice(HEADER_LINE)
    .filter((line) => line.startsWith("+") || line.startsWith("-"));
}

function hunksNaming(hunks: readonly string[], subject: string): readonly string[] {
  const named = hunks.filter((hunk) => subject !== "" && changedLines(hunk).some((line) => line.includes(subject)));
  if (named.length === NONE) {
    return hunks;
  }
  return named;
}

function contentAt(diff: Diff, revision: string): unknown {
  return parseJson(git(diff.options, "show", `${revision}:${diff.file}`).output);
}

function oxlintReports(diff: Diff, hunks: readonly string[]): readonly Report[] {
  const sides = { base: contentAt(diff, diff.base), head: contentAt(diff, ticketOf(diff.options)) };
  return oxlintFindings(sides).map((finding) => ({
    file: diff.file,
    hunks: hunksNaming(hunks, finding.subject),
    what: finding.what,
  }));
}

function addsAnEntry(hunk: string): boolean {
  const changed = changedLines(hunk);
  const added = changed.filter((line) => line.startsWith(ADDED_ENTRY)).length;
  return added > changed.filter((line) => line.startsWith(REMOVED_ENTRY)).length;
}

function optOutReports(diff: Diff, hunks: readonly string[]): readonly Report[] {
  return hunks
    .filter((hunk) => addsAnEntry(hunk))
    .map((hunk) => ({ file: diff.file, hunks: [hunk], what: "adds an entry" }));
}

function cruiserReports(diff: Diff, hunks: readonly string[]): readonly Report[] {
  return [{ file: diff.file, hunks, what: "changes, and any change to it needs approval" }];
}

const GUARDS: readonly (readonly [string, Guard])[] = [
  [".oxlintrc.json", oxlintReports],
  ["docs/lint-opt-outs.md", optOutReports],
  [".dependency-cruiser.cjs", cruiserReports],
];

function reportsOf(options: LintOptions, base: string): readonly Report[] {
  return GUARDS.flatMap(([file, guard]) => {
    const diff = { base, file, options };
    const hunks = hunksOf(diff);
    if (hunks.length === NONE) {
      return [];
    }
    return guard(diff, hunks);
  });
}

function refusal(options: LintOptions, reports: readonly Report[]): Step {
  const listed = reports.map((report) => `${report.file}: ${report.what}, in the hunk:\n${report.hunks.join("\n")}`);
  return stop(
    [
      `${ticketOf(options)} loosens the lint config, which needs Matt's approval:`,
      ...listed,
      `Nothing was pushed. If Matt approved it on the board, run pnpm merge-ticket ${options.ticket} --approved=<board msg id>.`,
    ].join("\n"),
    ...new Set(reports.map((report) => report.file)),
  );
}

function loosenings(options: LintOptions): Step {
  const base = git(options, "merge-base", ticketOf(options), "origin/v1");
  if (!base.ok) {
    return stop(`Could not find ${ticketOf(options)}'s merge base with origin/v1.\n${base.output}`);
  }
  const reports = reportsOf(options, base.output);
  if (reports.length === NONE) {
    return DONE;
  }
  return refusal(options, reports);
}

function lintApproval(options: LintOptions): Step {
  const approved = options.approved ?? "";
  if (approved === "") {
    return loosenings(options);
  }
  options.log(`--approved=${approved}: the merge records Lint-approved-by: board msg ${approved}`);
  return DONE;
}

function approvalTrailer(approved: string): string {
  if (approved === "") {
    return "";
  }
  return `\n\nLint-approved-by: board msg ${approved}`;
}

export { approvalTrailer, lintApproval };
