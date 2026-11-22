import type { BoardConnection, SeedFailure } from "./board.ts";
import { CliError, Command, Flag } from "effect/cli";
import { Console, Effect, Layer, Schema } from "effect";
import { cookoutToken, cookoutUrl } from "../../../config/server.ts";
import { NodeServices } from "@effect/platform-node";
import { devCookout } from "./dev-cookout.ts";
import { seedBoard } from "./board.ts";

const PRETTY = 2;
const FREE_PORT = 0;
const toLine = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));
const toPretty = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown, { space: PRETTY }));
const usage: SeedFailure = { code: "usage", message: "Run with --help to see the commands." };
const missingConnection: SeedFailure = {
  code: "url_missing",
  message: "Set COOKOUT_URL and COOKOUT_TOKEN to the url and adminToken that pnpm dev printed.",
};

function printLine(line: unknown): Effect.Effect<void> {
  return toLine(line).pipe(Effect.orDie, Effect.flatMap(Console.log));
}

function printFailure(failure: SeedFailure): Effect.Effect<void> {
  return toLine({ error: failure }).pipe(Effect.orDie, Effect.flatMap(Console.error));
}

const portFlag = Flag.Int("port").pipe(Flag.withDefault(FREE_PORT), Flag.withDescription("The port to listen on."));

const startCommand = Command.make("start", { port: portFlag }, ({ port }) =>
  Effect.gen(function* start() {
    const dev = yield* devCookout(port);
    yield* printLine({ ...dev, message: "The dev cookout is running. Ctrl-C stops it and deletes its database." });
    return yield* Effect.never;
  }).pipe(Effect.scoped),
).pipe(Command.withDescription("Start the cookout on a temporary SQLite file, with a webhook fake."));

function connection(): Effect.Effect<BoardConnection, SeedFailure> {
  return Effect.gen(function* readConnection() {
    const url = yield* Effect.orDie(cookoutUrl);
    const token = yield* Effect.orDie(cookoutToken);
    if (url === "" || token === "") {
      return yield* Effect.fail(missingConnection);
    }
    return { token, url };
  });
}

const seedCommand = Command.make("seed", {}, () =>
  Effect.gen(function* seed() {
    const server = yield* connection();
    const board = yield* seedBoard(server);
    const printed = yield* Effect.orDie(toPretty(board));
    yield* Console.log(printed);
  }).pipe(Effect.tapError(printFailure)),
).pipe(Command.withDescription("Fill the cookout at COOKOUT_URL with a small board, as the admin in COOKOUT_TOKEN."));

const devCommand = Command.make("dev").pipe(
  Command.withDescription("Run the cookout locally to verify a change."),
  Command.withSubcommands([startCommand, seedCommand]),
);

function devCommandLine(args: readonly string[]): Effect.Effect<void, SeedFailure> {
  return Effect.gen(function* runDevCommandLine() {
    const node = yield* Layer.build(NodeServices.layer);
    return yield* Command.runWith(devCommand, { version: "0.0.0" })(args).pipe(
      Effect.provideContext(node),
      Effect.catchIf(CliError.isCliError, () => Effect.fail(usage)),
    );
  }).pipe(Effect.scoped);
}

export { devCommandLine };
