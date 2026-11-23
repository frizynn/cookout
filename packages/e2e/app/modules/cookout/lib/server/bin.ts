import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { Effect, FileSystem, Option, Path, Schema, Stream } from "effect";
import type { MessageId } from "@ai-hero/cookout/sdk";
import type { Scope } from "effect";

interface BinRun {
  readonly args: readonly string[];
  readonly token: string;
  readonly stateFolder: string;
}

interface BinResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly stdoutJson: unknown;
  readonly stderrJson: unknown;
}

type BinNeeds = ChildProcessSpawner.ChildProcessSpawner | Path.Path | Scope.Scope;

const BIN = new URL("../../../../../node_modules/@ai-hero/cookout/dist/main.js", import.meta.url);
const parseJson = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Unknown));
const FIRST_MESSAGE_ID = 1;

function isMessageId(input: unknown): input is MessageId {
  return Number.isSafeInteger(input) && Number(input) >= FIRST_MESSAGE_ID;
}

const Posted = Schema.Struct({ message: Schema.Struct({ id: Schema.declare(isMessageId) }) });
const decodePosted = Schema.decodeUnknownEffect(Posted);

function collect<Failure>(stream: Stream.Stream<Uint8Array, Failure>): Effect.Effect<string, Failure> {
  return stream.pipe(Stream.decodeText(), Stream.mkString);
}

function jsonOf(output: string): unknown {
  return Option.getOrUndefined(parseJson(output));
}

function runBin(url: string): (run: BinRun) => Effect.Effect<BinResult, never, BinNeeds> {
  return ({ args, stateFolder, token }) =>
    Effect.gen(function* spawnCookout() {
      const path = yield* Path.Path;
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const bin = yield* path.fromFileUrl(BIN);
      const env = { COOKOUT_STATE_DIR: stateFolder, COOKOUT_TOKEN: token, COOKOUT_URL: url };
      const command = ChildProcess.make(process.execPath, [bin, ...args], { env, extendEnv: false });
      const handle = yield* spawner.spawn(command);
      const [stdout, stderr, exitCode] = yield* Effect.all(
        [collect(handle.stdout), collect(handle.stderr), handle.exitCode],
        { concurrency: "unbounded" },
      );
      return { exitCode, stderr, stderrJson: jsonOf(stderr), stdout, stdoutJson: jsonOf(stdout) };
    }).pipe(Effect.orDie);
}

const freshStateFolder: Effect.Effect<string, never, FileSystem.FileSystem | Path.Path | Scope.Scope> = Effect.gen(
  function* makeStateFolder() {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const parent = yield* fs.makeTempDirectoryScoped({ prefix: "cookout-e2e-" });
    return path.join(parent, "state");
  },
).pipe(Effect.orDie);

function postedMessageId({ stdoutJson }: BinResult): Effect.Effect<MessageId> {
  return decodePosted(stdoutJson).pipe(
    Effect.map(({ message }) => message.id),
    Effect.orDie,
  );
}

export { type BinNeeds, type BinResult, type BinRun, freshStateFolder, postedMessageId, runBin };
