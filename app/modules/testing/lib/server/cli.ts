import { NodeServices } from "@effect/platform-node";
import { ConfigProvider, Console, Deferred, Effect, Exit, Fiber, Layer, Schema, type Scope } from "effect";
import { TestConsole } from "effect/testing";
import { runCookout as runCommandLine, type ServeLayers } from "../../../cli/server.ts";
import { secretsLive, secretsTest } from "../../../secrets/server.ts";
import { memoryStorage, sqliteStorage } from "../../../storage/server.ts";

export type CliResult = { readonly exitCode: number; readonly stdout: string; readonly stderr: string };

export type ServeProcess = {
  readonly url: string;
  readonly lines: ReadonlyArray<unknown>;
  readonly stop: Effect.Effect<void>;
};

const verbLayers: ServeLayers = { storage: () => memoryStorage, secrets: secretsTest };

const serveLayers: ServeLayers = { storage: sqliteStorage, secrets: secretsLive };

const textOf = (lines: ReadonlyArray<unknown>) => lines.map(String).join("\n");

const commandLine = (
  args: ReadonlyArray<string>,
  env: Readonly<Record<string, string>>,
  layers: ServeLayers,
  console: Console.Console,
) =>
  runCommandLine(args, layers).pipe(
    Effect.provideService(Console.Console, console),
    Effect.provide(
      Layer.mergeAll(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { ...env } })), NodeServices.layer),
    ),
  );

export const runCookout = (args: ReadonlyArray<string>, env: Readonly<Record<string, string>> = {}) =>
  Effect.gen(function* () {
    const console = yield* TestConsole.make;
    const exit = yield* Effect.exit(commandLine(args, env, verbLayers, console));
    const result: CliResult = {
      exitCode: Exit.isSuccess(exit) ? 0 : 1,
      stdout: textOf(yield* console.logLines),
      stderr: textOf(yield* console.errorLines),
    };
    return result;
  });

const isListening = Schema.is(Schema.Struct({ listening: Schema.String }));

const parseLine = (line: unknown): unknown => JSON.parse(String(line));

export const startServe = (database: string): Effect.Effect<ServeProcess, never, Scope.Scope> =>
  Effect.gen(function* () {
    const captured = yield* TestConsole.make;
    const listening = yield* Deferred.make<string>();
    const console: Console.Console = {
      ...captured,
      log: (...line: ReadonlyArray<unknown>) => {
        captured.log(...line);
        const parsed = line.map(parseLine).find(isListening);
        if (parsed !== undefined) Deferred.doneUnsafe(listening, Effect.succeed(parsed.listening));
      },
    };
    const args = ["serve", "--port", "0", "--host", "127.0.0.1", "--db", database];
    const server = yield* Effect.forkScoped(commandLine(args, {}, serveLayers, console));
    const url = yield* Deferred.await(listening).pipe(
      Effect.raceFirst(
        Fiber.join(server).pipe(Effect.andThen(Effect.die(new Error("cookout serve stopped before listening.")))),
      ),
      Effect.orDie,
    );
    const lines = (yield* captured.logLines).map(parseLine);
    return { url, lines, stop: Fiber.interrupt(server) };
  });
