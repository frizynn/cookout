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

async function listeningUrl(lines: AsyncIterable<string>): Promise<string> {
  for await (const line of lines) {
    const url = fieldsOf(line)["listening"];
    if (typeof url === "string") {
      return url;
    }
  }
  throw new Error("cookout serve stopped before printing its address");
}

export async function setup(project: TestProject): Promise<() => Promise<void>> {
  const folder = mkdtempSync(path.join(os.tmpdir(), "cookout-web-test-"));
  const adminToken = "web-test-admin-token-0123456789abcdef0123456789";
  const database = path.join(folder, "cookout.db");
  const server = spawn(
    "env",
    [
      `COOKOUT_ADMIN_TOKEN=${adminToken}`,
      process.execPath,
      "app/main.ts",
      "serve",
      "--port",
      "0",
      "--host",
      "127.0.0.1",
      "--db",
      database,
    ],
    { stdio: ["ignore", "pipe", "ignore"] },
  );
  const url = await listeningUrl(createInterface({ input: server.stdout }));
  project.provide("cookout", { adminToken, url });
  return async () => {
    server.kill("SIGINT");
    await once(server, "exit");
    rmSync(folder, { force: true, recursive: true });
  };
}
