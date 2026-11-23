import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { expect, it, onTestFinished } from "vitest";
import { holdMachineLock } from "../lib/machine-lock.ts";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { tmpdir } from "node:os";

const POLL_MS = 10;
const LATER_MS = 50;
const NO_SUCH_PID = 2_147_483_646;

function lockFile(): string {
  const folder = mkdtempSync(path.join(tmpdir(), "machine-lock-"));
  onTestFinished(() => {
    rmSync(folder, { force: true, recursive: true });
  });
  return path.join(folder, "check.lock");
}

interface Recorder {
  readonly note: (line: string) => void;
  readonly order: readonly string[];
}

function recorder(): Recorder {
  const order: string[] = [];
  return {
    note: (line): void => {
      order.push(line);
    },
    order,
  };
}

async function hold(file: string, note: (line: string) => void): Promise<() => void> {
  const release = await holdMachineLock({
    file,
    onWait: (holder) => {
      note(`waits on ${String(holder)}`);
    },
    pollMs: POLL_MS,
  });
  return release;
}

async function holdThenRelease(file: string, note: (line: string) => void): Promise<void> {
  const release = await hold(file, note);
  note("second holds it");
  release();
}

it("a second holder waits until the first releases the lock", { timeout: 2000 }, async () => {
  expect.hasAssertions();

  const file = lockFile();
  const { note, order } = recorder();
  const release = await hold(file, note);
  const waiting = holdThenRelease(file, note);
  await sleep(LATER_MS);
  note("first releases it");
  release();
  await waiting;

  expect([order, existsSync(file)]).toStrictEqual([
    [`waits on ${String(process.pid)}`, "first releases it", "second holds it"],
    false,
  ]);
});

it("takes over a lock whose holder has exited", { timeout: 2000 }, async () => {
  expect.hasAssertions();

  const file = lockFile();
  writeFileSync(file, String(NO_SUCH_PID));
  const waitedOn: number[] = [];

  const release = await holdMachineLock({
    file,
    onWait: (holder) => {
      waitedOn.push(holder);
    },
    pollMs: POLL_MS,
  });
  release();

  expect([waitedOn, existsSync(file)]).toStrictEqual([[], false]);
});
