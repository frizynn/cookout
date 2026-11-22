import { Array as Arr, ConfigProvider, Console, Deferred, Effect, Fiber, Layer, Option, Schema, pipe } from "effect";
import { memoryStorage, sqliteStorage } from "../../../storage/server.ts";
import { secretsLive, secretsTest } from "../../../secrets/server.ts";
import { NodeServices } from "@effect/platform-node";
import type { Scope } from "effect";
import type { ServeLayers } from "../../../cli/server.ts";
import { TestConsole } from "effect/testing";
import { runCookout as runCommandLine } from "../../../cli/server.ts";

interface CliResult {
  readonly exitCode: number;
  readonly stderr: string;
  readonly stderrJson: unknown;
  readonly stdout: string;
  readonly stdoutJson: unknown;
}

interface ServeProcess {
  readonly lines: readonly unknown[];
  readonly stdout: string;
  readonly stop: Effect.Effect<void>;
  readonly url: string;
}

interface CommandLine {
  readonly args: readonly string[];
  readonly console: Console.Console;
  readonly env: Readonly<Record<string, string>>;
  readonly layers: ServeLayers;
}

const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;
const verbLayers: ServeLayers = { secrets: secretsTest, storage: () => memoryStorage };
const serveLayers: ServeLayers = { secrets: secretsLive, storage: sqliteStorage };
const isListening = Schema.is(Schema.Struct({ listening: Schema.String }));
const parseJson = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Unknown));

function parseLine(line: unknown): unknown {
  return Option.getOrElse(parseJson(String(line)), () => line);
}

function textOf(lines: readonly unknown[]): string {
  return Arr.join(Arr.map(lines, String), "\n");
}

function cliResult({ exitCode, stderr, stdout }: Pick<CliResult, "exitCode" | "stderr" | "stdout">): CliResult {
  return { exitCode, stderr, stderrJson: parseLine(stderr), stdout, stdoutJson: parseLine(stdout) };
}

function failed(): number {
  return EXIT_FAILURE;
}

function succeeded(): number {
  return EXIT_SUCCESS;
}

function exitCodeOf({ args, console, env, layers }: CommandLine): Effect.Effect<number, never, Scope.Scope> {
  return Effect.gen(function* runInProcess() {
    const node = yield* Layer.build(NodeServices.layer);
    return yield* runCommandLine(args, layers).pipe(
      Effect.provideService(Console.Console, console),
      Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env })),
      Effect.provideContext(node),
      Effect.matchCause({ onFailure: failed, onSuccess: succeeded }),
    );
  });
}

function runCookout({ args, env }: Pick<CommandLine, "args" | "env">): Effect.Effect<CliResult, never, Scope.Scope> {
  return Effect.gen(function* runCookoutInProcess() {
    const console = yield* TestConsole.make;
    const exitCode = yield* exitCodeOf({ args, console, env, layers: verbLayers });
    const stdout = yield* console.logLines;
    const stderr = yield* console.errorLines;
    return cliResult({ exitCode, stderr: textOf(stderr), stdout: textOf(stdout) });
  });
}

function startServe(database: string): Effect.Effect<ServeProcess, never, Scope.Scope> {
  return Effect.gen(function* startServeInProcess() {
    const captured = yield* TestConsole.make;
    const listening = yield* Deferred.make<string>();
    const console: Console.Console = {
      ...captured,
      log: (...line: readonly unknown[]): void => {
        captured.log(...line);
        const found = pipe(line, Arr.map(parseLine), Arr.findFirst(isListening));
        if (Option.isSome(found)) {
          Deferred.doneUnsafe(listening, Effect.succeed(found.value.listening));
        }
      },
    };
    const args = ["serve", "--port", "0", "--host", "127.0.0.1", "--db", database];
    const server = yield* Effect.forkScoped(exitCodeOf({ args, console, env: {}, layers: serveLayers }));
    const stopped = Effect.andThen(
      Fiber.join(server),
      Effect.die(new Error("cookout serve stopped before listening.")),
    );
    const url = yield* Effect.raceFirst(Deferred.await(listening), stopped);
    const lines = yield* captured.logLines;
    return { lines: Arr.map(lines, parseLine), stdout: textOf(lines), stop: Fiber.interrupt(server), url };
  });
}

export { type CliResult, type ServeProcess, cliResult, runCookout, startServe };
