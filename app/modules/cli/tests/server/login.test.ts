import type { CliResult, CommandLineNeeds, TestCookoutService, TestIdentity } from "../../../testing/server.ts";
import { Effect, FileSystem, Path, Stdio, Stream } from "effect";
import { TestCookout, answer, commandLineServices, runCookout, testCookout } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { Scope } from "effect";

const PERMISSIONS = 0o1000;
const PRIVATE_FILE = 0o600;
const SHARED_FILE = 0o644;
const ONE_AT_A_TIME = { concurrency: 1 } as const;

type Env = Readonly<Record<string, string>>;

interface LoginSetup {
  readonly ada: TestIdentity;
  readonly cookout: TestCookoutService;
  readonly env: Env;
  readonly file: string;
  readonly folder: string;
}

type SetupNeeds = CommandLineNeeds | TestCookout | Scope.Scope;

const encoder = new TextEncoder();

function logIn(env: Env, token: string): Effect.Effect<CliResult, never, CommandLineNeeds> {
  const stdin = Stdio.layerTest({ stdin: Stream.make(encoder.encode(`${token}\n`)) });
  return runCookout({ args: ["login", "--token"], env }).pipe(Effect.provide(stdin));
}

function run(env: Env, ...args: readonly string[]): Effect.Effect<CliResult, never, CommandLineNeeds> {
  return runCookout({ args, env });
}

const setUp: Effect.Effect<LoginSetup, never, SetupNeeds> = Effect.gen(function* makeConfigFolder() {
  const cookout = yield* TestCookout;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const ada = yield* cookout.createIdentity("ada", { kind: "human" });
  const folder = yield* Effect.orDie(fs.makeTempDirectoryScoped({ prefix: "cookout-config-" }));
  const file = path.join(folder, "cookout", "credentials");
  return { ada, cookout, env: { COOKOUT_URL: cookout.url, XDG_CONFIG_HOME: folder }, file, folder };
});

const loggedIn: Effect.Effect<LoginSetup, never, SetupNeeds> = Effect.tap(setUp, ({ ada, env }) =>
  logIn(env, ada.token),
);

it.effect("login --token keeps a human's token, and later commands act as that human", () =>
  Effect.gen(function* loginAsAda() {
    const { ada, cookout, env } = yield* setUp;
    yield* answer(() => ada.client.createChannel({ name: "grill" }));

    const results = yield* Effect.all(
      [logIn(env, ada.token), run(env, "whoami"), run(env, "message", "post", "grill", "hello")],
      ONE_AT_A_TIME,
    );

    expect(results).toMatchObject([
      { exitCode: 0, stdoutJson: { identity: { name: "ada" }, url: cookout.url } },
      { exitCode: 0, stdoutJson: { identity: { name: "ada" }, source: "login" } },
      { exitCode: 0, stdoutJson: { message: { author: { name: "ada" } } } },
    ]);

    const [login] = results;

    expect(login.stdout).not.toContain(ada.token);
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("the credentials file is mode 600 and keeps one Login per server, and logout removes only this one", () =>
  Effect.gen(function* twoServers() {
    const { ada, cookout, env, file } = yield* loggedIn;
    const fs = yield* FileSystem.FileSystem;
    const second = yield* cookout.startSecondServer;
    const other = { ...env, COOKOUT_URL: second.url };
    yield* logIn(other, ada.token);
    const info = yield* Effect.orDie(fs.stat(file));

    const results = yield* Effect.all(
      [run(other, "logout"), run(env, "whoami"), run(other, "whoami"), run(other, "logout")],
      ONE_AT_A_TIME,
    );

    expect(info.mode % PERMISSIONS).toBe(PRIVATE_FILE);
    expect(results).toMatchObject([
      { exitCode: 0, stdoutJson: { loggedOut: true, url: second.url } },
      { exitCode: 0, stdoutJson: { identity: { name: "ada" }, source: "login" } },
      { exitCode: 1, stderrJson: { error: { code: "token_missing" } } },
      { exitCode: 0, stdoutJson: { loggedOut: false, url: second.url } },
    ]);
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("login --token refuses an agent's token, an unknown one or none with exit code 1 and stores nothing", () =>
  Effect.gen(function* refusedLogins() {
    const { cookout, env, file } = yield* setUp;
    const fs = yield* FileSystem.FileSystem;
    const bot = yield* cookout.createIdentity("release-bot", { owner: "matt" });

    const results = yield* Effect.all(
      [logIn(env, bot.token), logIn(env, "not-a-real-token"), logIn(env, ""), run(env, "login")],
      ONE_AT_A_TIME,
    );
    const stored = yield* Effect.orDie(fs.exists(file));

    expect(results).toMatchObject([
      { exitCode: 1, stderrJson: { error: { code: "human_only" } } },
      { exitCode: 1, stderrJson: { error: { code: "token_unknown" } } },
      { exitCode: 1, stderrJson: { error: { code: "usage" } } },
      { exitCode: 1, stderrJson: { error: { code: "usage" } } },
    ]);
    expect(stored).toBe(false);
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("with no HOME or XDG_CONFIG_HOME, login is refused and logout has nothing to remove", () =>
  Effect.gen(function* noConfigFolder() {
    const { ada, cookout } = yield* setUp;
    const env = { COOKOUT_URL: cookout.url };

    const results = yield* Effect.all([logIn(env, ada.token), run(env, "logout")], ONE_AT_A_TIME);

    expect(results).toMatchObject([
      { exitCode: 1, stderrJson: { error: { code: "config_folder_missing" } } },
      { exitCode: 0, stdoutJson: { loggedOut: false } },
    ]);
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("with only HOME set, the Login is kept in ~/.config/cookout/credentials", () =>
  Effect.gen(function* homeConfig() {
    const { ada, cookout, folder } = yield* setUp;
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const env = { COOKOUT_URL: cookout.url, HOME: folder };

    const results = yield* Effect.all([logIn(env, ada.token), run(env, "whoami")], ONE_AT_A_TIME);
    const stored = yield* Effect.orDie(fs.exists(path.join(folder, ".config", "cookout", "credentials")));

    expect(results).toMatchObject([{ exitCode: 0 }, { exitCode: 0, stdoutJson: { source: "login" } }]);
    expect(stored).toBe(true);
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("COOKOUT_TOKEN wins over the Login, and whoami says so", () =>
  Effect.gen(function* tokenWins() {
    const { cookout, env } = yield* loggedIn;
    const bot = yield* cookout.createIdentity("release-bot", { owner: "matt" });

    const whoami = yield* run({ ...env, COOKOUT_TOKEN: bot.token }, "whoami");

    expect(whoami).toMatchObject({
      exitCode: 0,
      stdoutJson: { identity: { name: "release-bot" }, source: "COOKOUT_TOKEN" },
    });
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

const agentTools: readonly Env[] = [{ CLAUDECODE: "1" }, { CLAUDECODE: "1", COOKOUT_ALLOW_HUMAN: "1" }];

it.effect.each(agentTools)("inside an agent tool (%o) the Login is never sent", (markers) =>
  Effect.gen(function* agentToolWithLogin() {
    const { env } = yield* loggedIn;

    const whoami = yield* run({ ...env, ...markers }, "whoami");

    expect(whoami).toMatchObject({ exitCode: 1, stderrJson: { error: { code: "token_missing" } } });
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("the CLI refuses a credentials file others can read with credentials_unsafe", () =>
  Effect.gen(function* sharedCredentials() {
    const { ada, env, file } = yield* loggedIn;
    const fs = yield* FileSystem.FileSystem;
    yield* Effect.orDie(fs.chmod(file, SHARED_FILE));

    const results = yield* Effect.all([run(env, "whoami"), logIn(env, ada.token)], ONE_AT_A_TIME);

    expect(results).toMatchObject([
      { exitCode: 1, stderrJson: { error: { code: "credentials_unsafe" } } },
      { exitCode: 1, stderrJson: { error: { code: "credentials_unsafe" } } },
    ]);
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("login --token whose config folder can't be made fails with cli_error", () =>
  Effect.gen(function* configFolderIsAFile() {
    const { ada, cookout, folder } = yield* setUp;
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const notAFolder = path.join(folder, "not-a-folder");
    yield* Effect.orDie(fs.writeFileString(notAFolder, ""));

    const refused = yield* logIn({ COOKOUT_URL: cookout.url, XDG_CONFIG_HOME: notAFolder }, ada.token);

    expect(refused).toMatchObject({ exitCode: 1, stderrJson: { error: { code: "cli_error" } } });
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);

it.effect("a credentials file that isn't one is credentials_damaged", () =>
  Effect.gen(function* damagedCredentials() {
    const { env, file } = yield* loggedIn;
    const fs = yield* FileSystem.FileSystem;
    yield* Effect.orDie(fs.writeFileString(file, "not json"));

    const whoami = yield* run(env, "whoami");

    expect(whoami).toMatchObject({ exitCode: 1, stderrJson: { error: { code: "credentials_damaged" } } });
  }).pipe(Effect.provide([testCookout(), commandLineServices])),
);
