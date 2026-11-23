import { mkdtempSync, rmSync } from "node:fs";
import type { TestProject } from "vitest/node";
import { createInterface } from "node:readline";
import { once } from "node:events";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

interface TestCookout {
  readonly adminToken: string;
  readonly url: string;
}

declare module "vitest" {
  export interface ProvidedContext {
    readonly cookout: TestCookout;
  }
}

function fieldsOf(line: string): Readonly<Record<string, unknown>> {
  try {
    const parsed: unknown = JSON.parse(line);
    return Object.fromEntries(Object.entries(parsed ?? {}));
  } catch {
    return {};
  }
}

async function startLines(lines: AsyncIterable<string>): Promise<TestCookout> {
  const found = new Map<string, unknown>();
  for await (const line of lines) {
    for (const [name, value] of Object.entries(fieldsOf(line))) {
      found.set(name, value);
    }
    const adminToken = found.get("adminToken");
    const url = found.get("listening");
    if (typeof adminToken === "string" && typeof url === "string") {
      return { adminToken, url };
    }
  }
  throw new Error("cookout serve stopped before printing its admin token and address");
}

export async function setup(project: TestProject): Promise<() => Promise<void>> {
  const folder = mkdtempSync(path.join(os.tmpdir(), "cookout-web-test-"));
  const server = spawn(
    process.execPath,
    ["app/main.ts", "serve", "--port", "0", "--host", "127.0.0.1", "--db", path.join(folder, "cookout.db")],
    { stdio: ["ignore", "pipe", "ignore"] },
  );
  project.provide("cookout", await startLines(createInterface({ input: server.stdout })));
  return async () => {
    server.kill("SIGINT");
    await once(server, "exit");
    rmSync(folder, { force: true, recursive: true });
  };
}
