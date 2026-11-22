import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { Context, Effect, Layer, Path, Stream } from "effect";
import type { CliResult } from "./cli.ts";
import { NodeServices } from "@effect/platform-node";
import type { Scope } from "effect";
import { cliResult } from "./cli.ts";

interface BinaryRun {
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>>;
}

const MAIN = new URL("../../../../main.ts", import.meta.url);

function collect<Failure>(stream: Stream.Stream<Uint8Array, Failure>): Effect.Effect<string, Failure> {
  return stream.pipe(Stream.decodeText(), Stream.mkString);
}

function runCookoutBinary({ args, env }: BinaryRun): Effect.Effect<CliResult, never, Scope.Scope> {
  return Effect.gen(function* spawnCookout() {
    const node = yield* Layer.build(NodeServices.layer);
    const main = yield* Context.get(node, Path.Path).fromFileUrl(MAIN);
    const spawner = Context.get(node, ChildProcessSpawner.ChildProcessSpawner);
    const handle = yield* spawner.spawn(
      ChildProcess.make(process.execPath, [main, ...args], { env: { ...env }, extendEnv: false }),
    );
    const [stdout, stderr, exitCode] = yield* Effect.all(
      [collect(handle.stdout), collect(handle.stderr), handle.exitCode],
      { concurrency: "unbounded" },
    );
    return cliResult({ exitCode, stderr, stdout });
  }).pipe(Effect.orDie);
}

export { runCookoutBinary };
