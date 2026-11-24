import { clearTimeout, setTimeout } from "node:timers";
import { field, parseJson } from "./json.ts";
import { createInterface } from "node:readline";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { text } from "node:stream/consumers";

interface Watch {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly noteTimeoutMs: number;
  readonly onConnected: () => void;
}

interface Noted {
  readonly connected: boolean;
  readonly notes: string;
}

interface Watched extends Noted {
  readonly output: string;
  readonly status: number | null;
  readonly stdout: string;
}

function isWatching(line: string): boolean {
  return typeof field(parseJson(line), "watching") === "string";
}

async function noted(lines: AsyncIterable<string>, onConnected: () => void): Promise<Noted> {
  const notes: string[] = [];
  let connected = false;
  for await (const line of lines) {
    notes.push(line);
    if (!connected && isWatching(line)) {
      connected = true;
      onConnected();
    }
  }
  return { connected, notes: notes.join("\n") };
}

async function exitStatus(exit: Promise<readonly unknown[]>): Promise<number | null> {
  const [status] = await exit;
  if (typeof status === "number") {
    return status;
  }
  return null;
}

async function watchConnected({ argv, cwd, noteTimeoutMs, onConnected }: Watch): Promise<Watched> {
  const [command = "", ...args] = argv;
  const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
  const status = exitStatus(once(child, "exit"));
  const stdout = text(child.stdout);
  const deadline = setTimeout(() => {
    child.kill();
  }, noteTimeoutMs);
  const heard = await noted(createInterface({ input: child.stderr }), () => {
    clearTimeout(deadline);
    onConnected();
  });
  clearTimeout(deadline);
  const printed = await stdout;
  return { ...heard, output: `${printed}${heard.notes}`, status: await status, stdout: printed };
}

export { watchConnected };
