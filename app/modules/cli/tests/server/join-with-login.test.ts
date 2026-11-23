import type { CliResult, CommandLineNeeds } from "../../../testing/server.ts";
import { Effect, FileSystem, Stdio, Stream } from "effect";
import {
  TestCookout,
  answer,
  commandLineServices,
  freshStateFolder,
  runCookout,
  testCookout,
} from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";

type Env = Readonly<Record<string, string>>;

const EXIT_FAILURE = 1;
const ONE_AT_A_TIME = { concurrency: 1 } as const;
const encoder = new TextEncoder();

function logIn(env: Env, token: string): Effect.Effect<CliResult, never, CommandLineNeeds> {
  const stdin = Stdio.layerTest({ stdin: Stream.make(encoder.encode(`${token}\n`)) });
  return runCookout({ args: ["login", "--token"], env }).pipe(Effect.provide(stdin));
}

const configFolder = Effect.flatMap(FileSystem.FileSystem, (fs) =>
  Effect.orDie(fs.makeTempDirectoryScoped({ prefix: "cookout-config-" })),
);

it.effect("inside Claude Code, join uses the Login to join an agent the human owns; other verbs don't", () =>
  Effect.gen(function* joinWithLogin() {
    const cookout = yield* TestCookout;
    const grace = yield* cookout.createIdentity("grace", { kind: "human" });
    yield* cookout.createIdentity("triage-agent", { owner: "grace" });
    yield* answer(() => cookout.client.createChannel({ name: "grill" }));
    const terminal = {
      COOKOUT_STATE_DIR: yield* freshStateFolder,
      COOKOUT_URL: cookout.url,
      XDG_CONFIG_HOME: yield* configFolder,
    };
    const session = { ...terminal, CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: "s1" };
    yield* logIn(terminal, grace.token);
    const steps: readonly (readonly string[])[] = [
      ["message", "post", "grill", "as grace"],
      ["join", "--as", "triage-agent"],
      ["message", "post", "grill", "triaged"],
    ];
    const results = yield* Effect.forEach(steps, (args) => runCookout({ args, env: session }), ONE_AT_A_TIME);

    expect(results).toMatchObject([
      { exitCode: EXIT_FAILURE, stderrJson: { error: { code: "not_joined" } } },
      { exitCode: 0, stdoutJson: { created: false, identity: "triage-agent" } },
      { exitCode: 0, stdoutJson: { message: { author: { name: "triage-agent" } } } },
    ]);
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("inside Claude Code with no Login and no token, join says to log in first", () =>
  Effect.gen(function* joinWithoutLogin() {
    const cookout = yield* TestCookout;
    const env = {
      CLAUDECODE: "1",
      CLAUDE_CODE_SESSION_ID: "s1",
      COOKOUT_STATE_DIR: yield* freshStateFolder,
      COOKOUT_URL: cookout.url,
      XDG_CONFIG_HOME: yield* configFolder,
    };
    const result = yield* runCookout({ args: ["join", "--as", "scout"], env });

    expect(result).toMatchObject({
      exitCode: EXIT_FAILURE,
      stderrJson: { error: { code: "login_missing", message: "log in first: cookout login" } },
    });
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("join sends COOKOUT_SESSION before the Login, and with no COOKOUT_URL it says so", () =>
  Effect.gen(function* joinPrecedence() {
    const cookout = yield* TestCookout;
    const grace = yield* cookout.createIdentity("grace", { kind: "human" });
    const bot = yield* cookout.createIdentity("release-bot");
    const { agentSessionToken } = yield* answer(() => bot.client.join({ as: "release-bot" }));
    const terminal = { COOKOUT_URL: cookout.url, XDG_CONFIG_HOME: yield* configFolder };
    const inClaudeCode = { CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: "s1", COOKOUT_STATE_DIR: yield* freshStateFolder };
    yield* logIn(terminal, grace.token);
    const envs: readonly Env[] = [
      { ...terminal, ...inClaudeCode, COOKOUT_SESSION: agentSessionToken },
      { ...terminal, ...inClaudeCode, COOKOUT_URL: "" },
    ];
    const results = yield* Effect.forEach(
      envs,
      (env) => runCookout({ args: ["join", "--as", "release-bot", "--print-env"], env }),
      ONE_AT_A_TIME,
    );

    expect(results).toMatchObject([
      { exitCode: EXIT_FAILURE, stderrJson: { error: { code: "agent_session_live" } } },
      { exitCode: EXIT_FAILURE, stderrJson: { error: { code: "url_missing" } } },
    ]);
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);
