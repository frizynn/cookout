import { Effect, FileSystem, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import {
  answer,
  commandLineServices,
  interruptDevBinary,
  runCookout,
  runDev,
  startDev,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { createCookoutClient } from "../../../sdk/index.ts";

interface Fetched {
  readonly status: number;
  readonly text: string;
}

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

function fetchedText(url: string): Effect.Effect<Fetched> {
  return Effect.gen(function* fetchText() {
    const response = yield* HttpClient.execute(HttpClientRequest.get(url));
    const text = yield* response.text;
    return { status: response.status, text };
  }).pipe(Effect.provide(FetchHttpClient.layer), Effect.orDie);
}

function postedFrom(origin: string, url: string): Effect.Effect<string> {
  return HttpClient.execute(HttpClientRequest.post(url).pipe(HttpClientRequest.setHeader("origin", origin))).pipe(
    Effect.flatMap((response) => response.text),
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

it.effect("pnpm dev serves the web UI from the Vite dev server, which passes /v1 on to the cookout", () =>
  Effect.gen(function* devServesTheWebUi() {
    const dev = yield* startDev;
    const page = yield* fetchedText(dev.webUrl);
    const health = yield* fetchedText(`${dev.webUrl}/v1/health`);

    expect([page.status, health.status]).toStrictEqual([OK, OK]);
    expect(page.text).toContain('src="/app/web.tsx"');
    expect(health.text).toContain('"status":"ok"');
  }).pipe(Effect.provide(commandLineServices)),
);

it.effect("a write from the web UI's page passes the Origin guard through the Vite dev server", () =>
  Effect.gen(function* devWebWrites() {
    const dev = yield* startDev;
    const fromPage = yield* postedFrom(dev.webUrl, `${dev.webUrl}/v1/channels`);

    expect(fromPage).toContain('"token_missing"');
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

it.effect("pnpm dev exits 0 on Ctrl-C and deletes its database", () =>
  Effect.gen(function* devStopsOnInterrupt() {
    const { database, exitCode } = yield* interruptDevBinary();
    const kept = yield* databaseExists(database);

    expect(database).toContain("cookout-dev-");
    expect(exitCode).toBe(EXIT_SUCCESS);
    expect(kept).toBe(false);
  }).pipe(Effect.provide(commandLineServices)),
);

it.effect("the dev program refuses a command it doesn't have", () =>
  Effect.gen(function* unknownDevCommand() {
    const result = yield* runDev({ args: ["deploy"], env: {} });

    expect(result.exitCode).toBe(EXIT_FAILURE);
  }).pipe(Effect.provide(commandLineServices)),
);
