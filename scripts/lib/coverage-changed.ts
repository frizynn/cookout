import { field, list } from "./json.ts";
import path from "node:path";

interface Inputs {
  readonly changed: readonly string[];
  readonly coverage: unknown;
  readonly root: string;
}

interface Gap {
  readonly kind: "branch" | "line";
  readonly line: number;
}

const NOT_RUN = 0;

function gapAt(kind: Gap["kind"], count: unknown, location: unknown): readonly Gap[] {
  const line = field(field(location, "start"), "line");
  if (count === NOT_RUN && typeof line === "number") {
    return [{ kind, line }];
  }
  return [];
}

function entries(value: unknown): readonly (readonly [string, unknown])[] {
  if (typeof value !== "object" || value === null) {
    return [];
  }
  return Object.entries(value);
}

function statementGaps(file: unknown): readonly Gap[] {
  const statements = field(file, "statementMap");
  return entries(field(file, "s")).flatMap(([id, count]) => gapAt("line", count, field(statements, id)));
}

function branchGaps(file: unknown): readonly Gap[] {
  const branches = field(file, "branchMap");
  return entries(field(file, "b")).flatMap(([id, counts]) => {
    const locations = list(field(field(branches, id), "locations")) ?? [];
    return (list(counts) ?? []).flatMap((count, index) => gapAt("branch", count, locations[index]));
  });
}

function describe(gaps: readonly Gap[], line: number): string {
  const kinds = new Set(gaps.filter((gap) => gap.line === line).map((gap) => gap.kind));
  return [...kinds].toSorted().toReversed().join(" and ");
}

function inFile(name: string, file: unknown): readonly string[] {
  const gaps = [...statementGaps(file), ...branchGaps(file)];
  const lines = [...new Set(gaps.map((gap) => gap.line))].toSorted((left, right) => left - right);
  return lines.map((line) => `${name}:${String(line)} uncovered ${describe(gaps, line)}`);
}

function uncoveredLines(inputs: Inputs): readonly string[] {
  const changed = new Set(inputs.changed);
  return entries(inputs.coverage)
    .map(([file, data]) => [path.relative(inputs.root, file), data] as const)
    .filter(([name]) => changed.has(name))
    .toSorted(([left], [right]) => left.localeCompare(right))
    .flatMap(([name, data]) => inFile(name, data));
}

export { uncoveredLines };
