import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { identityNameSchema, leaseIdSchema } from "@ai-hero/cookout-protocol";

/** What the CLI keeps between processes about the lease it took with `join`. */
const leaseStateSchema = z.object({
  identity: identityNameSchema,
  url: z.string(),
  leaseId: leaseIdSchema,
  expiresAt: z.iso.datetime(),
});
export type LeaseState = z.infer<typeof leaseStateSchema>;

export type LeaseStateFile = {
  /** The saved lease, or `undefined` if this session hasn't joined (or left). */
  read(): LeaseState | undefined;
  write(state: LeaseState): void;
  remove(): void;
};

/**
 * The folder the CLI keeps session state in: `COOKOUT_STATE_DIR`, else
 * `$XDG_STATE_HOME/cookout`, else `~/.local/state/cookout`. Two sessions on
 * one machine that want separate leases need separate folders.
 */
export function stateDirectory(env: Record<string, string | undefined>): string {
  const explicit = env["COOKOUT_STATE_DIR"];
  if (explicit !== undefined && explicit !== "") return explicit;
  const xdg = env["XDG_STATE_HOME"];
  const base = xdg !== undefined && xdg !== "" ? xdg : join(env["HOME"] ?? homedir(), ".local", "state");
  return join(base, "cookout");
}

/**
 * The lease state file for one server and token, so one identity: the token
 * is the only thing a later CLI call knows about who it is. The file name is
 * a hash, so the token is never written to disk.
 */
export function leaseStateFile(directory: string, url: string, token: string): LeaseStateFile {
  const key = createHash("sha256").update(`${url}\n${token}`).digest("hex").slice(0, 32);
  const path = join(directory, "leases", `${key}.json`);
  return {
    read() {
      let text: string;
      try {
        text = readFileSync(path, "utf8");
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
        throw error;
      }
      const parsed = leaseStateSchema.safeParse(JSON.parse(text));
      if (!parsed.success) throw new Error(`The lease state file ${path} is damaged. Delete it and join again.`);
      return parsed.data;
    },
    write(state) {
      mkdirSync(join(directory, "leases"), { recursive: true, mode: 0o700 });
      // Write then rename, so a crash never leaves half a file.
      const temporary = `${path}.${process.pid}.tmp`;
      writeFileSync(temporary, `${JSON.stringify(leaseStateSchema.parse(state), null, 2)}\n`, { mode: 0o600 });
      renameSync(temporary, path);
    },
    remove() {
      rmSync(path, { force: true });
    },
  };
}
