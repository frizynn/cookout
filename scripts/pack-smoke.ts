import { type ChildProcessByStdio, type SpawnSyncReturns, spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import type { Readable } from "node:stream";
import { field, parseJson, text } from "./lib/json.ts";
import { fail } from "./lib/tools.ts";

type Server = { readonly url: string; readonly lines: ReadonlyArray<unknown>; readonly stop: () => Promise<number> };

const SCRIPT = "pack-smoke";
const root = mkdtempSync(join(tmpdir(), "cookout-pack-"));
const install = join(root, "install");
const database = join(root, "data", "cookout.db");
const bin = join(install, "node_modules", ".bin", "cookout");
const servers = new Set<ChildProcessByStdio<null, Readable, null>>();
process.on("exit", () => {
  for (const server of servers) server.kill("SIGKILL");
  rmSync(root, { recursive: true, force: true });
});

const withEnv = (variables: Readonly<Record<string, string>>, command: string, args: ReadonlyArray<string>) => [
  ...Object.entries(variables).map(([name, value]) => `${name}=${value}`),
  command,
  ...args,
];

const failureOf = (result: SpawnSyncReturns<string>) =>
  result.error?.message ?? (result.status === 0 ? undefined : `exit ${result.status}`);

const run = (command: string, args: ReadonlyArray<string>, cwd = ".") => {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 1 << 26, cwd });
  const failure = failureOf(result);
  if (failure !== undefined)
    fail(SCRIPT, `${command} ${args.join(" ")} failed (${failure}):\n${result.stdout}${result.stderr}`);
  return result.stdout;
};

const check = (ok: boolean, message: string) => {
  if (!ok) fail(SCRIPT, message);
  console.log(`ok   ${message}`);
};

const adminTokenIn = (line: unknown) =>
  field(line, "identity") === "admin" ? text(field(line, "adminToken")) : undefined;

const exitOf = (child: ChildProcessByStdio<null, Readable, null>) =>
  new Promise<number>((done) => child.on("close", (code) => done(code ?? 1)));

const serve = async (): Promise<Server> => {
  const args = withEnv({ COOKOUT_DB: database }, bin, ["serve", "--port", "0", "--host", "127.0.0.1"]);
  const child = spawn("env", args, { cwd: install, stdio: ["ignore", "pipe", "inherit"] });
  servers.add(child);
  const exited = exitOf(child);
  const lines: Array<unknown> = [];
  for await (const line of createInterface({ input: child.stdout })) {
    const parsed = parseJson(line);
    lines.push(parsed);
    const url = text(field(parsed, "listening"));
    if (url !== undefined) {
      const stop = () => (child.kill("SIGTERM"), exited);
      return { url, lines, stop };
    }
  }
  return fail(SCRIPT, `cookout serve exited (${await exited}) before listening. Output: ${JSON.stringify(lines)}`);
};

const health = (url: string) => run("curl", ["-fsS", `${url}/v1/health`]);

const whoami = (url: string, token: string) =>
  run("env", withEnv({ COOKOUT_URL: url, COOKOUT_TOKEN: token }, bin, ["whoami"]), install);

run("pnpm", ["run", "--silent", "build"]);
run("pnpm", ["pack", "--pack-destination", root]);
const tarball = readdirSync(root).find((file) => file.endsWith(".tgz"));
if (tarball === undefined) fail(SCRIPT, `pnpm pack wrote no tarball to ${root}.`);
mkdirSync(join(root, "data"));
mkdirSync(install);
writeFileSync(join(install, "package.json"), JSON.stringify({ private: true, type: "module" }));
run("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error", resolve(root, tarball ?? "")], install);

const first = await serve();
const adminToken = first.lines.map(adminTokenIn).find((token) => token !== undefined);
check(adminToken !== undefined, "the first boot prints the admin token on stdout");
check(parseJson(health(first.url)) !== undefined, `curl -fsS ${first.url}/v1/health succeeds`);
check((await first.stop()) === 0, "cookout serve exits 0 on SIGTERM");

const second = await serve();
check(
  second.lines.every((line) => adminTokenIn(line) === undefined),
  "a restart on the same COOKOUT_DB prints no token",
);
const identity = field(field(parseJson(whoami(second.url, adminToken ?? "")), "identity"), "name");
check(identity === "admin", "the first boot's token still passes cookout whoami");
await second.stop();

const keys = run(
  "node",
  ["-e", "import('@ai-hero/cookout/sdk').then(m => console.log(JSON.stringify(Object.keys(m))))"],
  install,
);
check(keys.includes("createCookoutClient"), `@ai-hero/cookout/sdk imports in Node with exports ${keys.trim()}`);
