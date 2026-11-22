// Test helper for the boundary rules: writes throwaway files into real
// packages and runs the boundary check (`pnpm lint:boundaries`) over them.
import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const written: string[] = [];

export type Violation = { rule: string; to: string };

/**
 * `exitCode` is what `pnpm lint:boundaries` (and so `pnpm check`) exits with.
 * `violations` are the ones that start from a probe file, sorted.
 */
export type BoundaryResult = { exitCode: number; violations: Violation[] };

type CruiseOutput = {
  summary: {
    violations: { rule: { name: string }; from: string; to: string }[];
  };
};

/**
 * Writes `packages/<pkg>/<file>` with one side-effect import per specifier,
 * then runs the boundary check over every package.
 */
export async function probeImports(
  pkg: string,
  file: string,
  specifiers: string[],
): Promise<BoundaryResult> {
  const path = join(repoRoot, "packages", pkg, file);
  await mkdir(dirname(path), { recursive: true });
  const body = specifiers.map((s) => `import ${JSON.stringify(s)};\n`).join("");
  await writeFile(path, `${body}export {};\n`);
  written.push(path);

  // The JSON reporter always exits 0, so run the plain command for the exit
  // code and the JSON reporter for the details.
  const [check, json] = await Promise.all([
    run([]),
    run(["--output-type", "json"]),
  ]);
  let output: CruiseOutput;
  try {
    output = JSON.parse(json.stdout) as CruiseOutput;
  } catch {
    throw new Error(`dependency-cruiser printed no JSON:\n${json.stdout}`);
  }
  const probes = new Set(written.map((p) => p.slice(repoRoot.length + 1)));
  const violations = output.summary.violations
    .filter((v) => probes.has(v.from))
    .map((v) => ({ rule: v.rule.name, to: v.to }))
    .sort((a, b) => `${a.rule} ${a.to}`.localeCompare(`${b.rule} ${b.to}`));
  return { exitCode: check.exitCode, violations };
}

/** Deletes every file `probeImports` wrote. Call it after each test. */
export async function removeProbes(): Promise<void> {
  await Promise.all(written.splice(0).map((path) => rm(path, { force: true })));
}

/**
 * Runs the same command as the `lint:boundaries` script, without the pnpm
 * wrapper (faster). Keep the arguments in step with package.json.
 */
function run(args: string[]): Promise<{ exitCode: number; stdout: string }> {
  return new Promise((resolve) => {
    execFile(
      join(repoRoot, "node_modules", ".bin", "depcruise"),
      ["packages", ...args],
      { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 },
      (error, stdout) => {
        const exitCode =
          error === null ? 0 : typeof error.code === "number" ? error.code : 1;
        resolve({ exitCode, stdout });
      },
    );
  });
}
