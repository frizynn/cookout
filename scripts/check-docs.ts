import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

const walk = (dir: string, keep: (path: string) => boolean): ReadonlyArray<string> =>
  readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .filter(keep);

const docs = [
  ...["AGENTS.md", "CLAUDE.md"].filter((path) => existsSync(path)),
  ...walk("docs", (path) => path.endsWith(".md") && !path.startsWith("docs/adr/")),
];
const source = walk("app", (path) => /\.tsx?$/u.test(path))
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");
const slug = (term: string) => term.toLowerCase().replace(/[^a-z0-9]+/gu, "-");
const glossary = existsSync("GLOSSARY.md") ? readFileSync("GLOSSARY.md", "utf8") : "";
const terms = new Set([...glossary.matchAll(/^\*\*(.+?)\*\*:/gmu)].map((match) => slug(match[1] ?? "")));

const namesNoTerm = (resolved: string, anchor: string | undefined) =>
  anchor !== undefined && resolved.endsWith("GLOSSARY.md") && !terms.has(anchor);

const resolve = (doc: string, path: string | undefined) => (path ? join(dirname(doc), path) : doc);

const linkFailure = (doc: string, target: string): string | undefined => {
  if (/^[a-z]+:/u.test(target)) return undefined;
  const [path, anchor] = target.split("#");
  const resolved = resolve(doc, path);
  if (!existsSync(resolved)) return `${doc}: link to missing ${target}`;
  return namesNoTerm(resolved, anchor) ? `${doc}: ${target} names no GLOSSARY.md term` : undefined;
};

const isSymbol = (code: string) => /^[A-Za-z_$][\w$]*$/u.test(code) && /[a-z][A-Z]|^[A-Z][a-z]/u.test(code);

const codeFailure = (doc: string, code: string): string | undefined => {
  if (/^[\w.-]+\/[\w./-]*$/u.test(code)) return existsSync(code) ? undefined : `${doc}: missing path ${code}`;
  return isSymbol(code) && !source.includes(code) ? `${doc}: missing symbol ${code}` : undefined;
};

const failuresIn = (doc: string): ReadonlyArray<string | undefined> => {
  const text = readFileSync(doc, "utf8");
  return [
    ...[...text.matchAll(/\]\(([^)\s]+)\)/gu)].map((match) => linkFailure(doc, match[1] ?? "")),
    ...[...text.matchAll(/`([^`\s]+)`/gu)].map((match) => codeFailure(doc, match[1] ?? "")),
  ];
};

const failures = docs.flatMap(failuresIn).filter((failure) => failure !== undefined);
for (const failure of failures) console.error(failure);
process.exitCode = failures.length === 0 ? 0 : 1;
