import { Array as Arr, ConfigProvider, Console, Deferred, Effect, Fiber, Layer, Option, Schema, pipe } from "effect";
import { memoryStorage, sqliteStorage } from "../../../storage/server.ts";
import { secretsLive, secretsTest } from "../../../secrets/server.ts";
import { NodeServices } from "@effect/platform-node";
import type { Scope } from "effect";
import type { ServeLayers } from "../../../cli/server.ts";
import { TestConsole } from "effect/testing";
import { devCommandLine } from "./dev.ts";
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

interface DevProcess {
  readonly adminToken: string;
  readonly database: string;
  readonly stop: Effect.Effect<void>;
  readonly url: string;
  readonly webhookFakeUrl: string;
}

interface Invocation {
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>>;
}

interface CommandLine {
  readonly console: Console.Console;
  readonly env: Readonly<Record<string, string>>;
  readonly program: Effect.Effect<number, never, NodeServices.NodeServices>;
}

interface Started<Line> {
  readonly line: Line;
  readonly lines: readonly unknown[];
  readonly stdout: string;
  readonly stop: Effect.Effect<void>;
}

const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;
const verbLayers: ServeLayers = { secrets: secretsTest, storage: () => memoryStorage };
const serveLayers: ServeLayers = { secrets: secretsLive, storage: sqliteStorage };
const isListening = Schema.is(Schema.Struct({ listening: Schema.String }));
const isDevRunning = Schema.is(
  Schema.Struct({
    adminToken: Schema.String,
    database: Schema.String,
    url: Schema.String,
    webhookFakeUrl: Schema.String,
  }),
);
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

function exitCodeAfter<Failure>(
  command: Effect.Effect<void, Failure, NodeServices.NodeServices>,
): Effect.Effect<number, never, NodeServices.NodeServices> {
  return Effect.matchCause(command, { onFailure: failed, onSuccess: succeeded });
}

function exitCodeOf({ console, env, program }: CommandLine): Effect.Effect<number, never, Scope.Scope> {
  return Effect.gen(function* runInProcess() {
    const node = yield* Layer.build(NodeServices.layer);
    return yield* program.pipe(
      Effect.provideService(Console.Console, console),
      Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env })),
      Effect.provideContext(node),
    );
  });
}

function captured({ env, program }: Omit<CommandLine, "console">): Effect.Effect<CliResult, never, Scope.Scope> {
  return Effect.gen(function* runCaptured() {
    const console = yield* TestConsole.make;
    const exitCode = yield* exitCodeOf({ console, env, program });
    const stdout = yield* console.logLines;
    const stderr = yield* console.errorLines;
    return cliResult({ exitCode, stderr: textOf(stderr), stdout: textOf(stdout) });
  });
}

function runCookout({ args, env }: Invocation): Effect.Effect<CliResult, never, Scope.Scope> {
  return captured({ env, program: exitCodeAfter(runCommandLine(args, verbLayers)) });
}

function runDev({ args, env }: Invocation): Effect.Effect<CliResult, never, Scope.Scope> {
  return captured({ env, program: exitCodeAfter(devCommandLine(args)) });
}

function startUntil<Line>(
  program: Effect.Effect<number, never, NodeServices.NodeServices>,
  isReady: (line: unknown) => line is Line,
): Effect.Effect<Started<Line>, never, Scope.Scope> {
  return Effect.gen(function* startInProcess() {
    const output = yield* TestConsole.make;
    const ready = yield* Deferred.make<Line>();
    const console: Console.Console = {
      ...output,
      log: (...line: readonly unknown[]): void => {
        output.log(...line);
        const found = pipe(line, Arr.map(parseLine), Arr.findFirst(isReady));
        if (Option.isSome(found)) {
          Deferred.doneUnsafe(ready, Effect.succeed(found.value));
        }
      },
    };
    const server = yield* Effect.forkScoped(exitCodeOf({ console, env: {}, program }));
    const stopped = Effect.andThen(
      Fiber.join(server),
      Effect.die(new Error("The command stopped before it was ready.")),
    );
    const line = yield* Effect.raceFirst(Deferred.await(ready), stopped);
    const lines = yield* output.logLines;
    return {
      line,
      lines: Arr.map(lines, parseLine),
      stdout: textOf(lines),
      stop: Fiber.interrupt(server),
    } satisfies Started<Line>;
  });
}

function startServe(database: string): Effect.Effect<ServeProcess, never, Scope.Scope> {
  const args = ["serve", "--port", "0", "--host", "127.0.0.1", "--db", database];
  const serve = exitCodeAfter(runCommandLine(args, serveLayers));
  return Effect.map(startUntil(serve, isListening), ({ line, lines, stdout, stop }) => ({
    lines,
    stdout,
    stop,
    url: line.listening,
  }));
}

const devStart = exitCodeAfter(devCommandLine(["start"]));

const startDev: Effect.Effect<DevProcess, never, Scope.Scope> = Effect.map(
  startUntil(devStart, isDevRunning),
  ({ line, stop }) => ({ ...line, stop }),
);

export {
  type CliResult,
  type DevProcess,
  type ServeProcess,
  cliResult,
  parseLine,
  runCookout,
  runDev,
  startDev,
  startServe,
};
