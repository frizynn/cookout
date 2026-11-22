import { execFile, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { onTestFinished } from "vitest";
import { z } from "zod";

/** The `cookout` binary (package.json `bin`), run by this Node. */
export const cookoutBin = fileURLToPath(new URL("../src/bin.ts", import.meta.url));

/** A folder deleted when the test ends. */
export async function freshFolder(): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), "cookout-serve-"));
  onTestFinished(() => rm(folder, { recursive: true, force: true }));
  return folder;
}

const listeningLine = z.object({ listening: z.string() });

export type ServeProcess = {
  url: string;
  /** Every JSON line printed on stdout up to and including the `listening` line. */
  lines: unknown[];
  /** Sends SIGTERM and waits for the process to exit. */
  stop(): Promise<void>;
};

/** Runs `cookout serve` on a free port with the given database, until the test ends. */
export async function startServeProcess(databasePath: string): Promise<ServeProcess> {
  const child = spawn(process.execPath, [cookoutBin, "serve", "--port", "0", "--host", "127.0.0.1", "--db", databasePath], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  const stop = async (): Promise<void> => {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
    await exited;
  };
  onTestFinished(stop);

  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));

  const lines: unknown[] = [];
  const url = await new Promise<string>((resolve, reject) => {
    let buffered = "";
    child.stdout.on("data", (chunk: Buffer) => {
      buffered += chunk.toString();
      let newline = buffered.indexOf("\n");
      while (newline !== -1) {
        const line: unknown = JSON.parse(buffered.slice(0, newline));
        buffered = buffered.slice(newline + 1);
        lines.push(line);
        const listening = listeningLine.safeParse(line);
        if (listening.success) resolve(listening.data.listening);
        newline = buffered.indexOf("\n");
      }
    });
    child.once("exit", (code) => reject(new Error(`cookout serve exited (${code}) before listening:\n${stderr}`)));
  });
  return { url, lines, stop };
}

export type CliResult = { exitCode: number; stdout: string; stderr: string };

/**
 * Runs the `cookout` binary as a process with only the given environment
 * variables added. Without `COOKOUT_STATE_DIR` each run gets a fresh state
 * folder (a session of its own), so tests never touch the real home folder.
 * Pass the same `COOKOUT_STATE_DIR` to runs that are one session.
 */
export async function runCookout(args: string[], env: Record<string, string>): Promise<CliResult> {
  const cleanEnv: Record<string, string | undefined> = {
    ...process.env,
    COOKOUT_URL: undefined,
    COOKOUT_TOKEN: undefined,
    COOKOUT_STATE_DIR: env["COOKOUT_STATE_DIR"] ?? (await freshFolder()),
    ...env,
  };
  try {
    const { stdout, stderr } = await promisify(execFile)(process.execPath, [cookoutBin, ...args], { env: cleanEnv });
    return { exitCode: 0, stdout, stderr };
  } catch (error) {
    const failed = z.object({ code: z.number(), stdout: z.string(), stderr: z.string() }).parse(error);
    return { exitCode: failed.code, stdout: failed.stdout, stderr: failed.stderr };
  }
}
