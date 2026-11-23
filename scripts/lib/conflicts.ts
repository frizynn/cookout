type HunkResolve = "append" | "lower";

interface Hunk {
  readonly base: string;
  readonly ours: string;
  readonly theirs: string;
}

interface Threshold {
  readonly indent: string;
  readonly key: string;
  readonly value: number;
}

interface Piece {
  readonly end: number;
  readonly start: number;
  readonly text: string;
}

type Resolution = { readonly ok: false } | { readonly ok: true; readonly text: string };

const NONE = 0;
const LAST = -1;
const FIRST = 1;
const UNRESOLVED: Resolution = { ok: false };
const KEY = /^\w+$/u;
const VALUE = /^\d+(?:\.\d+)?,$/u;
const CONFLICT =
  /^<<<<<<< [^\n]*\n(?<ours>[\s\S]*?)^\|{7} [^\n]*\n(?<base>[\s\S]*?)^={7}\n(?<theirs>[\s\S]*?)^>>>>>>> [^\n]*(?:\n|$)/gmu;

function lines(section: string): readonly string[] {
  return section.split("\n").filter((line) => line.length > NONE);
}

function appended({ base, ours, theirs }: Hunk): Resolution {
  if (base !== "") {
    return UNRESOLVED;
  }
  return { ok: true, text: `${ours}${theirs}` };
}

function parseThreshold(line: string): readonly Threshold[] {
  const [key = "", value = ""] = line.trim().split(": ");
  if (!KEY.test(key) || !VALUE.test(value)) {
    return [];
  }
  return [
    { indent: line.slice(NONE, line.length - line.trimStart().length), key, value: Number(value.slice(NONE, LAST)) },
  ];
}

function thresholds(section: string): readonly Threshold[] | false {
  const sectionLines = lines(section);
  const parsed = sectionLines.flatMap((line) => parseThreshold(line));
  return parsed.length === sectionLines.length && parsed;
}

function lowest(mine: Threshold, theirs: readonly Threshold[]): string {
  const values = theirs.filter(({ key }) => key === mine.key).map(({ value }) => value);
  return `${mine.indent}${mine.key}: ${Math.min(mine.value, ...values)},\n`;
}

function sameKeys(mine: readonly Threshold[], theirs: readonly Threshold[]): boolean {
  return mine.length === theirs.length && mine.every(({ key }) => theirs.some((other) => other.key === key));
}

function lowered({ base, ours, theirs }: Hunk): Resolution {
  const mine = thresholds(ours);
  const their = thresholds(theirs);
  if (mine === false || their === false || thresholds(base) === false || !sameKeys(mine, their)) {
    return UNRESOLVED;
  }
  return { ok: true, text: mine.map((threshold) => lowest(threshold, their)).join("") };
}

const resolvers = { append: appended, lower: lowered };

function pieces(source: string, resolve: HunkResolve): { readonly all: number; readonly resolved: readonly Piece[] } {
  const resolved: Piece[] = [];
  let all = NONE;
  for (const match of source.matchAll(CONFLICT)) {
    all += FIRST;
    const resolution = resolvers[resolve]({ base: "", ours: "", theirs: "", ...match.groups });
    if (resolution.ok) {
      resolved.push({ end: match.index + match[NONE].length, start: match.index, text: resolution.text });
    }
  }
  return { all, resolved };
}

function resolveHunks({ resolve, source }: { readonly resolve: HunkResolve; readonly source: string }): Resolution {
  const { all, resolved } = pieces(source, resolve);
  if (resolved.length !== all || all === NONE) {
    return UNRESOLVED;
  }
  let text = "";
  let at = NONE;
  for (const piece of resolved) {
    text = `${text}${source.slice(at, piece.start)}${piece.text}`;
    at = piece.end;
  }
  return { ok: true, text: `${text}${source.slice(at)}` };
}

export type { HunkResolve };
export { resolveHunks };
