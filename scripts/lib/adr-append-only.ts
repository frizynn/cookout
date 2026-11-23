interface AdrDiff {
  readonly diff: string;
  readonly originals: ReadonlyMap<string, readonly string[]>;
}

interface Change {
  readonly file: string;
  readonly lines: readonly string[];
  readonly original: ReadonlySet<string>;
}

const ADR_LINK = String.raw`\[ADR \d{4}\]\(\d{4}-[^)]+\.md\)`;
const DATE = String.raw`\d{4}-\d{2}-\d{2}`;
const DATED_NOTE = new RegExp(
  [
    String.raw`^_?Superseded\b`,
    `^_?Confirmed by Matt on ${DATE}`,
    String.raw`^${DATE}: Matt confirmed\b`,
    String.raw`: ${ADR_LINK}\.$`,
    `^${ADR_LINK} `,
  ].join("|"),
  "u",
);
const HOW =
  'Write a new ADR and add a dated line here, such as "Superseded in part on YYYY-MM-DD by [ADR NNNN](…): …".';
const FILE_START = /^diff --git a\/.+ b\//mu;
const HUNK = "@@";
const ADDED = "+";
const REMOVED = "-";
const NOT_FOUND = -1;
const AFTER_HEADER = 1;

function isDatedNote(line: string): boolean {
  return line.trim() === "" || DATED_NOTE.test(line);
}

function hunkLines(lines: readonly string[]): readonly string[] {
  const first = lines.findIndex((line) => line.startsWith(HUNK));
  if (first === NOT_FOUND) {
    return [];
  }
  return lines.slice(first).filter((line) => !line.startsWith(HUNK));
}

function contentOf(lines: readonly string[], sign: string): readonly string[] {
  return lines.filter((line) => line.startsWith(sign)).map((line) => line.slice(sign.length));
}

function editsOf({ file, lines, original }: Change): readonly string[] {
  if (lines.some((line) => line.startsWith("new file mode"))) {
    return [];
  }
  if (lines.some((line) => line.startsWith("deleted file mode"))) {
    return [
      `${file} is append-only, but this change deletes it. Restore it, and mark it superseded with a dated line instead.`,
    ];
  }
  const hunks = hunkLines(lines);
  const removed = contentOf(hunks, REMOVED).filter((line) => original.has(line) || isDatedNote(line));
  const added = contentOf(hunks, ADDED).filter((line) => !original.has(line) && !isDatedNote(line));
  return [
    ...removed.map((line) => `${file} is append-only, but this change removes the line "${line}". ${HOW}`),
    ...added.map(
      (line) => `${file} is append-only, but this change adds the line "${line}", which is not a dated note. ${HOW}`,
    ),
  ];
}

function adrEdits({ diff, originals }: AdrDiff): readonly string[] {
  return diff
    .split(FILE_START)
    .slice(AFTER_HEADER)
    .flatMap((chunk) => {
      const lines = chunk.split("\n");
      const [file = ""] = lines;
      return editsOf({ file, lines: lines.slice(AFTER_HEADER), original: new Set(originals.get(file)) });
    });
}

export { adrEdits };
