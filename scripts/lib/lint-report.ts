import type { Diagnostic } from "./tools.ts";
import { describe } from "./tools.ts";

type Counts = Readonly<Record<string, number>>;
type Count = readonly [string, number];

interface Limit {
  readonly current: Counts;
  readonly limit: Counts;
}

interface Report {
  readonly baseline: Counts;
  readonly diagnostics: readonly Diagnostic[];
  readonly withCounts: boolean;
}

interface Grown {
  readonly baseline: Counts;
  readonly current: Counts;
  readonly diagnostic: Diagnostic;
}

interface Counted {
  readonly baseline: Counts;
  readonly grown: readonly Count[];
  readonly withCounts: boolean;
}

const NONE = 0;
const ONE = 1;

function keyOf(diagnostic: Readonly<Diagnostic>): string {
  return `${diagnostic.filename} ${diagnostic.code}`;
}

function byKey([left]: Count, [right]: Count): number {
  return left.localeCompare(right);
}

function tally(diagnostics: readonly Diagnostic[]): Counts {
  const totals = new Map<string, number>();
  for (const diagnostic of diagnostics) {
    totals.set(keyOf(diagnostic), (totals.get(keyOf(diagnostic)) ?? NONE) + ONE);
  }
  return Object.fromEntries([...totals].toSorted(byKey));
}

function above({ current, limit }: Limit): readonly Count[] {
  return Object.entries(current).filter(([key, count]: Count) => count > (limit[key] ?? NONE));
}

function plural(count: number, word: string): string {
  if (count === ONE) {
    return `${String(count)} ${word}`;
  }
  return `${String(count)} ${word}s`;
}

function lineOf({ baseline, current, diagnostic }: Grown): string {
  const allowed = baseline[keyOf(diagnostic)] ?? NONE;
  if (allowed === NONE) {
    return describe(diagnostic);
  }
  return `${describe(diagnostic)} (one of ${String(current[keyOf(diagnostic)])}; the baseline allows ${String(allowed)})`;
}

function countLines({ baseline, grown, withCounts }: Counted): readonly string[] {
  if (!withCounts) {
    return [];
  }
  return grown.map(([key, count]) => `${key}: ${String(count)}, baseline ${String(baseline[key] ?? NONE)}`);
}

function grownReport({ baseline, diagnostics, withCounts }: Report): readonly string[] {
  const current = tally(diagnostics);
  const grown = above({ current, limit: baseline });
  if (grown.length === NONE) {
    return [];
  }
  const grownKeys = new Set(grown.map(([key]) => key));
  const shown = diagnostics.filter((diagnostic) => grownKeys.has(keyOf(diagnostic)));
  const added = grown.reduce((sum, [key, count]) => sum + count - (baseline[key] ?? NONE), NONE);
  const files = new Set(shown.map((diagnostic) => diagnostic.filename)).size;
  return [
    ...shown.map((diagnostic) => lineOf({ baseline, current, diagnostic })),
    ...countLines({ baseline, grown, withCounts }),
    `${plural(added, "new violation")} in ${plural(files, "file")}`,
  ];
}

export type { Counts };
export { above, grownReport, tally };
