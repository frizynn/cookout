import { createInterface } from "node:readline";
import { once } from "node:events";
import { spawn } from "node:child_process";

interface DevCookout {
  readonly adminToken: string;
  readonly webUrl: string;
}

function fieldsOf(line: string): Readonly<Record<string, unknown>> {
  try {
    const parsed: unknown = JSON.parse(line);
    return Object.fromEntries(Object.entries(parsed ?? {}));
  } catch {
    return {};
  }
}

async function startLine(lines: AsyncIterable<string>): Promise<DevCookout> {
  for await (const line of lines) {
    const { adminToken, webUrl } = fieldsOf(line);
    if (typeof adminToken === "string" && typeof webUrl === "string") {
      return { adminToken, webUrl };
    }
  }
  throw new Error("app/dev.ts start stopped before printing its start line");
}

async function setup(): Promise<() => Promise<void>> {
  const dev = spawn(process.execPath, ["app/dev.ts", "start"], { stdio: ["ignore", "pipe", "ignore"] });
  const cookout = await startLine(createInterface({ input: dev.stdout }));
  process.env["COOKOUT_TOKEN"] = cookout.adminToken;
  process.env["COOKOUT_URL"] = cookout.webUrl;
  return async () => {
    dev.kill("SIGINT");
    await once(dev, "exit");
  };
}

export default setup;
