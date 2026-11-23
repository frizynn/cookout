import { existsSync, readFileSync } from "node:fs";
import type { SpawnSyncReturns } from "node:child_process";
import { duplicateNumbers } from "./lib/adr-numbers.ts";
import { spawnSync } from "node:child_process";

const SELF = "scripts/hygiene.ts";
const WIKI = "personal-wiki";

const failed = (run: SpawnSyncReturns<string>) => run.error !== undefined || run.status === null || run.status > 1;

const git = (args: readonly string[]) => {
  const run = spawnSync("git", args, { encoding: "utf8", maxBuffer: 1 << 26 });
  if (failed(run)) {
    console.error(`hygiene: git ${args.join(" ")} failed: ${run.stderr}`);
    process.exit(1);
  }
  return run.stdout.split("\n").filter((line) => line.length > 0);
};

const gitlinks = () =>
  git(["ls-files", "-s"])
    .filter((line) => line.startsWith("160000 "))
    .map((line) => `${line.split("\t")[1] ?? line} is a gitlink (a nested repo or worktree). Unstage it.`);

const workspaceFile = () =>
  existsSync("pnpm-workspace.yaml") && git(["ls-files", "pnpm-workspace.yaml"]).length > 0
    ? []
    : ["pnpm-workspace.yaml is missing from the repo root. Without it, pnpm in a worktree writes to another checkout."];

const VARIABLE = /["'`]([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)["'`]|\benv\.([A-Z][A-Z0-9_]*)/g;

const configReads = () => {
  const files = git(["ls-files", "app/modules/config"]).filter((file) => !file.includes("/tests/"));
  const source = files.map((file) => readFileSync(file, "utf8")).join("\n");
  return new Set([...source.matchAll(VARIABLE)].map(([, quoted, member]) => quoted ?? member ?? ""));
};

const exampleLines = () =>
  new Set(
    readFileSync(".env.example", "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"))
      .map((line) => line.split("=")[0] ?? line),
  );

const envExample = () => {
  if (!existsSync(".env.example")) {
    return [".env.example is missing."];
  }
  const read = configReads();
  const listed = exampleLines();
  return [
    ...[...read]
      .filter((name) => !listed.has(name))
      .map((name) => `config reads ${name}, but .env.example has no line for it.`),
    ...[...listed]
      .filter((name) => !read.has(name))
      .map((name) => `.env.example lists ${name}, but config never reads it.`),
  ];
};

function readmeSettings(): readonly string[] {
  if (!existsSync("README.md")) {
    return ["README.md is missing."];
  }
  const readme = readFileSync("README.md", "utf8");
  return [...configReads()]
    .filter((name) => !readme.includes(`\n- \`${name}\` (`))
    .map(
      (name) =>
        `config reads ${name}, but the README's Settings section has no line for it, such as "- \`${name}\` (default …): …".`,
    );
}

const wikiCitations = () =>
  git(["grep", "-l", "-F", WIKI, "--", ".", `:!${SELF}`]).map(
    (file) => `${file} names the ${WIKI}. Cite a GitHub issue or PR instead.`,
  );

function adrNumbers(): readonly string[] {
  return duplicateNumbers(git(["ls-files", "docs/adr"]));
}

const failures = [
  ...gitlinks(),
  ...workspaceFile(),
  ...envExample(),
  ...readmeSettings(),
  ...wikiCitations(),
  ...adrNumbers(),
];
for (const failure of failures) {
  console.error(`hygiene: ${failure}`);
}
process.exitCode = failures.length > 0 ? 1 : 0;
