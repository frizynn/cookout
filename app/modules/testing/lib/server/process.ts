import { NodeServices } from "@effect/platform-node";
import { Effect, Path, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import type { CliResult } from "./cli.ts";

const collect = (stream: Stream.Stream<Uint8Array, unknown>) => stream.pipe(Stream.decodeText(), Stream.mkString);

const mainPath = Effect.gen(function* () {
  const path = yield* Path.Path;
  return yield* path.fromFileUrl(new URL("../../../../main.ts", import.meta.url));
});

export const runCookoutBinary = (args: ReadonlyArray<string>, env: Readonly<Record<string, string>> = {}) =>
  Effect.gen(function* () {
    const main = yield* mainPath;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const handle = yield* spawner.spawn(
      ChildProcess.make(process.execPath, [main, ...args], { env: { ...env }, extendEnv: false }),
    );
    const [stdout, stderr, exitCode] = yield* Effect.all(
      [collect(handle.stdout), collect(handle.stderr), handle.exitCode],
      { concurrency: "unbounded" },
    );
    const result: CliResult = { exitCode, stdout, stderr };
    return result;
  }).pipe(Effect.scoped, Effect.orDie, Effect.provide(NodeServices.layer));
