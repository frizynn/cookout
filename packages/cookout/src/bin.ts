#!/usr/bin/env node
// The `cookout` binary. `serve` starts the server on SQLite; every other verb
// is the CLI from @ai-hero/cookout-client.
import { parseArgs } from "node:util";
import { runCli } from "@ai-hero/cookout-client";

function printLine(line: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(line)}\n`);
}

async function runServe(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    strict: true,
    options: { port: { type: "string" }, host: { type: "string" }, db: { type: "string" } },
  });
  const port = Number(values.port ?? process.env["PORT"] ?? "3000");
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`Bad port: ${values.port ?? process.env["PORT"]}`);
  // Loaded only for `serve`, so other verbs never open SQLite (or print its warning).
  const { serve } = await import("./serve.ts");
  const running = await serve({
    databasePath: values.db ?? process.env["COOKOUT_DB"] ?? "cookout.db",
    port,
    host: values.host ?? process.env["COOKOUT_HOST"] ?? "0.0.0.0",
    print: printLine,
  });
  const stop = (): void => {
    running.close().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

const [verb, ...rest] = process.argv.slice(2);
if (verb === "serve") {
  runServe(rest).catch((error: unknown) => {
    process.stderr.write(
      `${JSON.stringify({ error: { code: "serve_failed", message: error instanceof Error ? error.message : String(error) } })}\n`,
    );
    process.exit(1);
  });
} else {
  process.exitCode = await runCli(process.argv.slice(2), {
    env: process.env,
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  });
}
