import { DONE, git, stop } from "./merge-steps.ts";
import type { Step } from "./merge-steps.ts";
import { migrationsInserted } from "./migrations-append-only.ts";
import path from "node:path";
import { readFileSync } from "node:fs";

interface MigrationOptions {
  readonly cwd: string;
  readonly migrationsBase: string;
  readonly rules: { readonly appendOnly: readonly string[] };
  readonly ticket: number;
}

interface Refusal {
  readonly file: string;
  readonly reasons: readonly string[];
}

const NONE = 0;

function insertedMigrations(options: MigrationOptions, file: string): readonly string[] {
  const base = git(options, "show", `${options.migrationsBase}:${file}`);
  if (!base.ok) {
    return [];
  }
  const head = readFileSync(path.join(options.cwd, file), "utf8");
  return migrationsInserted({ base: base.output, baseName: options.migrationsBase, file, head });
}

function appendOnlyMigrations(options: MigrationOptions): Step {
  const refused = options.rules.appendOnly.map(
    (file): Refusal => ({ file, reasons: insertedMigrations(options, file) }),
  );
  const inserted = refused.filter((refusal: Readonly<Refusal>) => refusal.reasons.length > NONE);
  if (inserted.length === NONE) {
    return DONE;
  }
  const reasons = inserted.flatMap((refusal: Readonly<Refusal>) => refusal.reasons).join("\n");
  return stop(
    `${reasons}\nNothing was pushed. The merge is on merge-ticket-${options.ticket}: move the new migrations to the end of the list and commit, then run pnpm merge-ticket ${options.ticket} --continue.`,
    ...inserted.map((refusal: Readonly<Refusal>) => refusal.file),
  );
}

export { appendOnlyMigrations };
