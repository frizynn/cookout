import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { Context, Effect, Layer, Option, Path, Schema, Stream, pipe } from "effect";
import { cliResult, parseLine } from "./cli.ts";
import type { CliResult } from "./cli.ts";
import { NodeServices } from "@effect/platform-node";
import type { Scope } from "effect";

interface BinaryRun {
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>>;
}

interface InterruptedDev {
  readonly database: string;
  readonly exitCode: number;
}

const MAIN = new URL("../../../../main.ts", import.meta.url);
const DEV = new URL("../../../../dev.ts", import.meta.url);
const isDevRunning = Schema.is(Schema.Struct({ database: Schema.String }));

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

function databaseIn(line: string): Option.Option<string> {
  return pipe(
    Option.liftPredicate(parseLine(line), isDevRunning),
    Option.map(({ database }) => database),
  );
}

function interruptDevBinary(): Effect.Effect<InterruptedDev, never, Scope.Scope> {
  return Effect.gen(function* spawnDev() {
    const node = yield* Layer.build(NodeServices.layer);
    const dev = yield* Context.get(node, Path.Path).fromFileUrl(DEV);
    const spawner = Context.get(node, ChildProcessSpawner.ChildProcessSpawner);
    const handle = yield* spawner.spawn(ChildProcess.make(process.execPath, [dev, "start"], { extendEnv: true }));
    const lines = pipe(handle.stdout, Stream.decodeText(), Stream.splitLines, Stream.map(databaseIn));
    const found = yield* Stream.runHead(Stream.filter(lines, Option.isSome));
    yield* handle.kill({ killSignal: "SIGINT" });
    const exitCode = yield* handle.exitCode;
    return { database: Option.getOrElse(Option.flatten(found), () => ""), exitCode };
  }).pipe(Effect.orDie);
}

export { type InterruptedDev, interruptDevBinary, runCookoutBinary };
