import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

interface MachineLock {
  readonly file: string;
  readonly onWait: (holder: number) => void;
  readonly pollMs: number;
}

type Claim = { readonly held: true } | { readonly held: false; readonly holder: number };

const NO_HOLDER = 0;

function codeOf(error: unknown): unknown {
  if (error instanceof Error && "code" in error) {
    return error.code;
  }
  return "";
}

function isAlive(pid: number): boolean {
  if (pid === NO_HOLDER) {
    return false;
  }
  try {
    process.kill(pid, NO_HOLDER);
    return true;
  } catch (error) {
    return codeOf(error) === "EPERM";
  }
}

function holderOf(file: string): number {
  try {
    return Math.trunc(Number(readFileSync(file, "utf8"))) || NO_HOLDER;
  } catch {
    return NO_HOLDER;
  }
}

function claim(file: string): Claim {
  try {
    writeFileSync(file, String(process.pid), { flag: "wx" });
    return { held: true };
  } catch (error) {
    if (codeOf(error) !== "EEXIST") {
      throw error;
    }
    const holder = holderOf(file);
    if (isAlive(holder)) {
      return { held: false, holder };
    }
    rmSync(file, { force: true });
    return claim(file);
  }
}

async function waitFor(lock: MachineLock, warned: boolean): Promise<void> {
  const claimed = claim(lock.file);
  if (claimed.held) {
    return;
  }
  if (!warned) {
    lock.onWait(claimed.holder);
  }
  await sleep(lock.pollMs);
  await waitFor(lock, true);
}

async function holdMachineLock(lock: MachineLock): Promise<() => void> {
  await waitFor(lock, false);
  return (): void => {
    rmSync(lock.file, { force: true });
  };
}

export { holdMachineLock };
