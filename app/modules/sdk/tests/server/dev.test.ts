import { Effect, FileSystem, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { answer, commandLineServices, runCookout, runDev, startDev } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { createCookoutClient } from "../../index.ts";

const OK = 200;
const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;
const THREE_REPLIES = 3;
const SeededToken = Schema.Struct({ token: Schema.String });
const SeedOutput = Schema.Struct({ identities: Schema.NonEmptyArray(SeededToken), thread: Schema.Finite });
const ThreadParent = Schema.Struct({ text: Schema.String });
const ThreadOutput = Schema.Struct({ parent: ThreadParent, replies: Schema.Array(Schema.Unknown) });

function shaped<Shape>(value: unknown, isShape: (input: unknown) => input is Shape, otherwise: string): Shape {
  if (isShape(value)) {
    return value;
  }
  return expect.unreachable(otherwise);
}

function databaseExists(database: string): Effect.Effect<boolean, never, FileSystem.FileSystem> {
  return Effect.gen(function* checkDatabase() {
    const fs = yield* FileSystem.FileSystem;
    return yield* Effect.orDie(fs.exists(database));
  });
}

function callWebhookFake(url: string): Effect.Effect<number> {
  return HttpClient.execute(HttpClientRequest.post(`${url}/command`)).pipe(
    Effect.map(({ status }) => status),
    Effect.provide(FetchHttpClient.layer),
    Effect.orDie,
  );
}

it.effect("pnpm dev serves a fresh board and a webhook fake, and removes its database when it stops", () =>
  Effect.gen(function* devServesAndCleansUp() {
    const dev = yield* startDev;
    const { identity } = yield* answer(() =>
      createCookoutClient({ env: {}, token: dev.adminToken, url: dev.url }).whoami(),
    );
    const fakeStatus = yield* callWebhookFake(dev.webhookFakeUrl);
    const keptWhileRunning = yield* databaseExists(dev.database);
    yield* dev.stop;
    const keptAfterStop = yield* databaseExists(dev.database);

    expect(identity.name).toBe("admin");
    expect(fakeStatus).toBe(OK);
    expect(keptWhileRunning).toBe(true);
    expect(keptAfterStop).toBe(false);
  }).pipe(Effect.provide(commandLineServices)),
);

it.effect("pnpm seed prints the seeded tokens, and the cookout CLI reads the seeded thread with one", () =>
  Effect.gen(function* seedThenReadThread() {
    const dev = yield* startDev;
    const seeded = yield* runDev({ args: ["seed"], env: { COOKOUT_TOKEN: dev.adminToken, COOKOUT_URL: dev.url } });
    const board = shaped(seeded.stdoutJson, Schema.is(SeedOutput), seeded.stderr);
    const [first] = board.identities;
    const read = yield* runCookout({
      args: ["thread", "get", String(board.thread)],
      env: { COOKOUT_TOKEN: first.token, COOKOUT_URL: dev.url },
    });
    const thread = shaped(read.stdoutJson, Schema.is(ThreadOutput), read.stderr);

    expect(seeded.exitCode).toBe(EXIT_SUCCESS);
    expect(thread.parent.text).toBe("Morning! Who is looking at the flaky login test?");
    expect(thread.replies).toHaveLength(THREE_REPLIES);
  }).pipe(Effect.provide(commandLineServices)),
);

it.effect("pnpm seed without COOKOUT_URL and COOKOUT_TOKEN is refused as JSON on stderr", () =>
  Effect.gen(function* seedWithoutConnection() {
    const seeded = yield* runDev({ args: ["seed"], env: {} });

    expect(seeded.exitCode).toBe(EXIT_FAILURE);
    expect(seeded.stderrJson).toStrictEqual({
      error: {
        code: "url_missing",
        message: "Set COOKOUT_URL and COOKOUT_TOKEN to the url and adminToken that pnpm dev printed.",
      },
    });
  }).pipe(Effect.provide(commandLineServices)),
);

it.effect("pnpm seed on a board it already seeded is refused with the server's code", () =>
  Effect.gen(function* seedTwice() {
    const dev = yield* startDev;
    const env = { COOKOUT_TOKEN: dev.adminToken, COOKOUT_URL: dev.url };
    yield* runDev({ args: ["seed"], env });
    const again = yield* runDev({ args: ["seed"], env });

    expect(again.exitCode).toBe(EXIT_FAILURE);
    expect(again.stderrJson).toStrictEqual({
      error: { code: "identity_exists", message: "The name ada is taken." },
    });
  }).pipe(Effect.provide(commandLineServices)),
);

it.effect("pnpm seed against a stopped cookout is refused", () =>
  Effect.gen(function* seedStoppedCookout() {
    const dev = yield* startDev;
    yield* dev.stop;
    const seeded = yield* runDev({ args: ["seed"], env: { COOKOUT_TOKEN: dev.adminToken, COOKOUT_URL: dev.url } });

    expect(seeded.exitCode).toBe(EXIT_FAILURE);
    expect(seeded.stderrJson).toMatchObject({ error: { code: "seed_failed" } });
  }).pipe(Effect.provide(commandLineServices)),
);

it.effect("the dev program refuses a command it doesn't have", () =>
  Effect.gen(function* unknownDevCommand() {
    const result = yield* runDev({ args: ["deploy"], env: {} });

    expect(result.exitCode).toBe(EXIT_FAILURE);
  }).pipe(Effect.provide(commandLineServices)),
);
