import { NodeServices } from "@effect/platform-node";
import { Effect, Path, Schema, type Scope, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

export type CliResult = { readonly exitCode: number; readonly stdout: string; readonly stderr: string };

const collect = (stream: Stream.Stream<Uint8Array, unknown>) => stream.pipe(Stream.decodeText(), Stream.mkString);

const mainPath = Effect.gen(function* () {
  const path = yield* Path.Path;
  return yield* path.fromFileUrl(new URL("../../../../main.ts", import.meta.url));
});

const spawnCookout = (args: ReadonlyArray<string>, env: Readonly<Record<string, string>>) =>
  Effect.gen(function* () {
    const main = yield* mainPath;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    return yield* spawner.spawn(
      ChildProcess.make(process.execPath, [main, ...args], { env: { ...env }, extendEnv: false }),
    );
  });

export const runCookout = (args: ReadonlyArray<string>, env: Readonly<Record<string, string>> = {}) =>
  Effect.gen(function* () {
    const handle = yield* spawnCookout(args, env);
    const [stdout, stderr, exitCode] = yield* Effect.all(
      [collect(handle.stdout), collect(handle.stderr), handle.exitCode],
      {
        concurrency: "unbounded",
      },
    );
    const result: CliResult = { exitCode, stdout, stderr };
    return result;
  }).pipe(Effect.scoped, Effect.orDie, Effect.provide(NodeServices.layer));

export type ServeProcess = {
  readonly url: string;
  readonly lines: ReadonlyArray<unknown>;
  readonly stop: Effect.Effect<void>;
};

const isListening = Schema.is(Schema.Struct({ listening: Schema.String }));

const parseLine = (line: string): unknown => JSON.parse(line);

export const startServe = (database: string): Effect.Effect<ServeProcess, never, Scope.Scope> =>
  Effect.gen(function* () {
    const handle = yield* spawnCookout(["serve", "--port", "0", "--host", "127.0.0.1", "--db", database], {});
    const lines = yield* handle.stdout.pipe(
      Stream.decodeText(),
      Stream.splitLines,
      Stream.map(parseLine),
      Stream.takeUntil(isListening),
      Stream.runCollect,
    );
    const listening = lines.find(isListening);
    if (listening === undefined) return yield* Effect.die(new Error("cookout serve exited before listening."));
    const stop = handle.kill().pipe(Effect.andThen(handle.exitCode), Effect.asVoid, Effect.orDie);
    return { url: listening.listening, lines, stop };
  }).pipe(Effect.orDie, Effect.provide(NodeServices.layer));
