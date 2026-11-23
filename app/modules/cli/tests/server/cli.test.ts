import { Effect, pipe } from "effect";
import {
  TestCookout,
  commandLineServices,
  runCookout,
  runCookoutBinary,
  testCookout,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";

const EXIT_FAILURE = 1;
const ONE_AT_A_TIME = { concurrency: 1 } as const;
const succeeded = { exitCode: 0, stderr: "" };
const verbs: readonly (readonly string[])[] = [
  ["identity", "create", "bot", "--owner", "matt"],
  ["identity", "rotate", "bot"],
  ["channel", "create", "grill", "--description", "Grill it"],
  ["channel", "get", "grill"],
  ["message", "post", "grill", "Is the lease 60 s?", "--data", '{"question":1}'],
  ["message", "post", "grill", "Yes.", "--reply-to", "1"],
  ["message", "list", "grill", "--limit", "1", "--before", "2"],
  ["thread", "get", "2"],
  ["identity", "delete", "bot"],
  ["whoami"],
  ["identity", "list"],
  ["channel", "list"],
  ["message", "list", "grill"],
  ["identity", "create", "loner"],
  ["channel", "create", "plain"],
];

it.effect("every verb passes its arguments and flags to the server and prints the answer as JSON", () =>
  Effect.gen(function* verbsReachTheServer() {
    const cookout = yield* TestCookout;
    const env = { COOKOUT_TOKEN: cookout.adminToken, COOKOUT_URL: cookout.url };
    const results = yield* pipe(
      verbs,
      Effect.forEach((args) => runCookout({ args, env }), ONE_AT_A_TIME),
    );

    expect(results).toMatchObject([
      { ...succeeded, stdoutJson: { identity: { name: "bot", owner: "matt" } } },
      { ...succeeded, stdoutJson: { identity: { name: "bot" } } },
      { ...succeeded, stdoutJson: { channel: { description: "Grill it", name: "grill" } } },
      { ...succeeded, stdoutJson: { channel: { name: "grill" } } },
      { ...succeeded, stdoutJson: { message: { data: { question: 1 }, id: 1 } } },
      { ...succeeded, stdoutJson: { message: { id: 2, replyTo: 1 } } },
      { ...succeeded, stdoutJson: { hasMore: false, messages: [{ id: 1 }] } },
      { ...succeeded, stdoutJson: { parent: { id: 1 }, replies: [{ id: 2 }] } },
      { ...succeeded, stdoutJson: { identity: { name: "bot" } } },
      { ...succeeded, stdoutJson: { identity: { name: "admin" } } },
      { ...succeeded, stdoutJson: { identities: [{ name: "admin" }] } },
      { ...succeeded, stdoutJson: { channels: [{ name: "grill" }] } },
      { ...succeeded, stdoutJson: { messages: [{ id: 1 }] } },
      { ...succeeded, stdoutJson: { identity: { name: "loner" } } },
      { ...succeeded, stdoutJson: { channel: { name: "plain" } } },
    ]);
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("a refusal is JSON on stderr, with its status, and exit code 1", () =>
  Effect.gen(function* refusalOnStderr() {
    const cookout = yield* TestCookout;
    const env = { COOKOUT_TOKEN: cookout.adminToken, COOKOUT_URL: cookout.url };
    const gone = yield* runCookout({ args: ["identity", "delete", "nobody"], env });

    expect(gone).toMatchObject({
      exitCode: EXIT_FAILURE,
      stderrJson: { error: { code: "identity_not_found", status: 404 } },
      stdout: "",
    });
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("the CLI refuses --data that isn't JSON with a usage error", () =>
  Effect.gen(function* badData() {
    const result = yield* runCookout({
      args: ["message", "post", "grill", "hi", "--data", "{nope"],
      env: { COOKOUT_URL: "http://127.0.0.1:1" },
    });

    expect(result).toMatchObject({ exitCode: EXIT_FAILURE, stderrJson: { error: { code: "usage" } } });
  }).pipe(Effect.provide(commandLineServices)),
);

it.effect("the CLI refuses a message ID that isn't a positive whole number with a usage error", () =>
  Effect.gen(function* badMessageId() {
    const result = yield* runCookout({ args: ["thread", "get", "0"], env: { COOKOUT_URL: "http://127.0.0.1:1" } });

    expect(result).toMatchObject({ exitCode: EXIT_FAILURE, stderrJson: { error: { code: "usage" } } });
  }).pipe(Effect.provide(commandLineServices)),
);

it.effect("the CLI exits 1 with a JSON error on stderr when the token is missing", () =>
  Effect.gen(function* tokenMissing() {
    const cookout = yield* TestCookout;
    const result = yield* runCookoutBinary({ args: ["whoami"], env: { COOKOUT_URL: cookout.url } });

    expect(result).toMatchObject({
      exitCode: EXIT_FAILURE,
      stderrJson: { error: { code: "token_missing", status: 401 } },
      stdout: "",
    });
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("the CLI says so when COOKOUT_URL is not set", () =>
  Effect.gen(function* urlMissing() {
    const result = yield* runCookout({ args: ["whoami"], env: {} });

    expect(result).toMatchObject({ exitCode: EXIT_FAILURE, stderrJson: { error: { code: "url_missing" } } });
  }).pipe(Effect.provide(commandLineServices)),
);

it.effect("the CLI fails with cli_error, as JSON on stderr, when it can't reach the server", () =>
  Effect.gen(function* unreachable() {
    const result = yield* runCookout({ args: ["whoami"], env: { COOKOUT_URL: "http://127.0.0.1:1/" } });

    expect(result).toMatchObject({ exitCode: EXIT_FAILURE, stderrJson: { error: { code: "cli_error" } }, stdout: "" });
  }).pipe(Effect.provide(commandLineServices)),
);

it.effect("the CLI prints its help and exits 1 when no command is given", () =>
  Effect.gen(function* noCommand() {
    const result = yield* runCookout({ args: [], env: {} });

    expect(result).toMatchObject({ exitCode: EXIT_FAILURE });
    expect(result.stdout).toContain("identity");
  }).pipe(Effect.provide(commandLineServices)),
);

it.effect("the CLI refuses an unknown command with a usage error", () =>
  Effect.gen(function* unknownCommand() {
    const result = yield* runCookout({ args: ["identity", "explode"], env: { COOKOUT_URL: "http://127.0.0.1:1" } });

    expect(result).toMatchObject({ exitCode: EXIT_FAILURE, stderrJson: { error: { code: "usage" } } });
  }).pipe(Effect.provide(commandLineServices)),
);
