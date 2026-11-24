interface Block {
  readonly end: (line: string) => boolean;
  readonly start: (line: string) => boolean;
  readonly startAfter: boolean;
}

const MAX_LINES = 20;
const NOT_FOUND = -1;
const NEXT = 1;
const FIRST = 0;

const ESCAPE_CODE = 27;
const ESCAPE = String.fromCodePoint(ESCAPE_CODE);
const ANSI = new RegExp(`${ESCAPE}\\[[\\d;]*m`, "gu");

const blocks: readonly Block[] = [
  {
    end: (line) => /^⎯{3}/u.test(line),
    start: (line) => /^⎯+ (?:Failed Tests|Failed Suites|Unhandled Errors?)\b/u.test(line),
    startAfter: true,
  },
  {
    end: (line) => /^\s+(?:2\) \[|\d+ failed$)/u.test(line),
    start: (line) => /^\s+1\) \[/u.test(line),
    startAfter: false,
  },
  { end: (line) => line.trim() === "", start: (line) => /^\s*(?:[A-Z]\w*)?Error\b/u.test(line), startAfter: false },
];

function withoutTrailingBlanks(lines: readonly string[]): readonly string[] {
  const last = lines.findLastIndex((line) => line.trim() !== "");
  return lines.slice(FIRST, last + NEXT);
}

function firstNonBlank(lines: readonly string[], from: number): number {
  const found = lines.slice(from).findIndex((line) => line.trim() !== "");
  if (found === NOT_FOUND) {
    return lines.length;
  }
  return from + found;
}

function excerpt(lines: readonly string[], block: Block): readonly string[] {
  const header = lines.findIndex((line) => block.start(line));
  if (header === NOT_FOUND) {
    return [];
  }
  if (!block.startAfter) {
    return lines.slice(header);
  }
  return lines.slice(firstNonBlank(lines, header + NEXT));
}

function upToEnd(lines: readonly string[], block: Block): readonly string[] {
  const stop = lines.findIndex((line, index) => index > FIRST && block.end(line));
  if (stop === NOT_FOUND) {
    return lines;
  }
  return lines.slice(FIRST, stop);
}

function firstError(output: string): readonly string[] {
  const lines = output.replaceAll(ANSI, "").split("\n");
  for (const block of blocks) {
    const found = excerpt(lines, block);
    if (found.length > FIRST) {
      return withoutTrailingBlanks(upToEnd(found, block).slice(FIRST, MAX_LINES));
    }
  }
  return [];
}

export { firstError };
