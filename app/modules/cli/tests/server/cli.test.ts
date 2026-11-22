import { Context, Effect, FileSystem, Layer } from "effect";
import { TestCookout, interruptDevBinary, runCookout, runCookoutBinary, testCookout } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { NodeServices } from "@effect/platform-node";

const EXIT_FAILURE = 1;
const EXIT_SUCCESS = 0;
const BOOT = "2026-01-01T00:00:00.000Z";
const succeeded = { exitCode: 0, stderr: "" };
const griller = { admin: false, createdAt: BOOT, name: "auth-griller", owner: "matt" };
const admin = { admin: true, createdAt: BOOT, name: "admin" };
const bot = { admin: false, createdAt: BOOT, name: "bot" };
const FIRST_ID = 1;
const SECOND_ID = 2;
const postedParent = {
  author: { name: "agent", owner: "matt" },
  data: { question: 1 },
  id: FIRST_ID,
  kind: "top-level",
  text: "Is the lease 60 s?",
};
const postedReply = { id: SECOND_ID, kind: "reply", replyTo: FIRST_ID, text: "Yes." };
const oneReply = { latestReplyId: SECOND_ID, replyCount: 1 };
const onlyParent = { hasMore: false, messages: [{ id: FIRST_ID }] };

it.effect("the cookout CLI creates and lists identities and says who you are, as JSON", () =>
  Effect.gen(function* identityVerbs() {
    const cookout = yield* TestCookout;
    const env = { COOKOUT_TOKEN: cookout.adminToken, COOKOUT_URL: cookout.url };
    const created = yield* runCookout({ args: ["identity", "create", "auth-griller", "--owner", "matt"], env });
    yield* runCookout({ args: ["identity", "create", "bot"], env });
    const listed = yield* runCookout({ args: ["identity", "list"], env });
    const whoami = yield* runCookout({ args: ["whoami"], env });

    expect(created).toMatchObject({ ...succeeded, stdoutJson: { identity: griller } });
    expect(created.stdout).toMatch(/"token": "cookout_test_\d+"/u);
    expect(listed).toMatchObject({ ...succeeded, stdoutJson: { identities: [admin, griller, bot] } });
    expect(whoami).toMatchObject({ ...succeeded, stdoutJson: { identity: admin } });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("the CLI rotates and deletes identities", () =>
  Effect.gen(function* rotateAndDelete() {
    const cookout = yield* TestCookout;
    const leaky = yield* cookout.createIdentity("leaky");
    const env = { COOKOUT_TOKEN: cookout.adminToken, COOKOUT_URL: cookout.url };
    const rotated = yield* runCookout({ args: ["identity", "rotate", "leaky"], env });
    const deleted = yield* runCookout({ args: ["identity", "delete", "leaky"], env });
    const gone = yield* runCookout({ args: ["identity", "delete", "leaky"], env });

    expect(rotated).toMatchObject({ ...succeeded, stdoutJson: { identity: leaky.identity } });
    expect(rotated.stdout).toMatch(/"token": "cookout_test_\d+"/u);
    expect(deleted).toMatchObject({ ...succeeded, stdoutJson: { identity: leaky.identity } });
    expect(gone).toMatchObject({
      exitCode: EXIT_FAILURE,
      stderrJson: { error: { code: "identity_not_found", status: 404 } },
      stdout: "",
    });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("the CLI creates, lists and gets channels, as JSON", () =>
  Effect.gen(function* channelVerbs() {
    const cookout = yield* TestCookout;
    const agent = yield* cookout.createIdentity("agent");
    const env = { COOKOUT_TOKEN: agent.token, COOKOUT_URL: cookout.url };
    const created = yield* runCookout({ args: ["channel", "create", "grill", "--description", "Grill it"], env });
    const listed = yield* runCookout({ args: ["channel", "list"], env });
    const got = yield* runCookout({ args: ["channel", "get", "grill"], env });
    const grill = { channel: { createdAt: BOOT, description: "Grill it", name: "grill" } };

    expect(created).toMatchObject({ ...succeeded, stdoutJson: grill });
    expect(listed).toMatchObject({ ...succeeded, stdoutJson: { channels: [grill.channel] } });
    expect(got).toMatchObject({ ...succeeded, stdoutJson: grill });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("the CLI makes a channel, posts a message and a reply, and reads the thread back as JSON", () =>
  Effect.gen(function* messageVerbs() {
    const cookout = yield* TestCookout;
    const agent = yield* cookout.createIdentity("agent", { owner: "matt" });
    const env = { COOKOUT_TOKEN: agent.token, COOKOUT_URL: cookout.url };
    yield* runCookout({ args: ["channel", "create", "grill"], env });
    const posted = yield* runCookout({
      args: ["message", "post", "grill", "Is the lease 60 s?", "--data", '{"question":1}'],
      env,
    });
    const replied = yield* runCookout({ args: ["message", "post", "grill", "Yes.", "--reply-to", "1"], env });
    const thread = yield* runCookout({ args: ["thread", "get", "2"], env });
    const page = yield* runCookout({ args: ["message", "list", "grill", "--limit", "1", "--before", "2"], env });
    const newest = yield* runCookout({ args: ["message", "list", "grill"], env });

    expect([posted, replied, thread, page, newest]).toMatchObject([
      { ...succeeded, stdoutJson: { message: postedParent } },
      { ...succeeded, stdoutJson: { message: postedReply } },
      { ...succeeded, stdoutJson: { parent: { ...postedParent, ...oneReply }, replies: [postedReply] } },
      { ...succeeded, stdoutJson: onlyParent },
      { ...succeeded, stdoutJson: onlyParent },
    ]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("the CLI refuses --data that isn't JSON with a usage error", () =>
  Effect.gen(function* badData() {
    const result = yield* runCookout({
      args: ["message", "post", "grill", "hi", "--data", "{nope"],
      env: { COOKOUT_URL: "http://127.0.0.1:1" },
    });

    expect(result).toMatchObject({ exitCode: EXIT_FAILURE, stderrJson: { error: { code: "usage" } } });
  }),
);

it.effect("the CLI refuses a message ID that isn't a positive whole number with a usage error", () =>
  Effect.gen(function* badMessageId() {
    const result = yield* runCookout({ args: ["thread", "get", "0"], env: { COOKOUT_URL: "http://127.0.0.1:1" } });

    expect(result).toMatchObject({ exitCode: EXIT_FAILURE, stderrJson: { error: { code: "usage" } } });
  }),
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
  }).pipe(Effect.provide(testCookout())),
);

it.effect("the CLI says so when COOKOUT_URL is not set", () =>
  Effect.gen(function* urlMissing() {
    const result = yield* runCookout({ args: ["whoami"], env: {} });

    expect(result).toMatchObject({ exitCode: EXIT_FAILURE, stderrJson: { error: { code: "url_missing" } } });
  }),
);

it.effect("the CLI prints its help and exits 1 when no command is given", () =>
  Effect.gen(function* noCommand() {
    const result = yield* runCookout({ args: [], env: {} });

    expect(result).toMatchObject({ exitCode: EXIT_FAILURE });
    expect(result.stdout).toContain("identity");
  }),
);

it.effect("the CLI refuses an unknown command with a usage error", () =>
  Effect.gen(function* unknownCommand() {
    const result = yield* runCookout({ args: ["identity", "explode"], env: { COOKOUT_URL: "http://127.0.0.1:1" } });

    expect(result).toMatchObject({ exitCode: EXIT_FAILURE, stderrJson: { error: { code: "usage" } } });
  }),
);

it.effect("pnpm dev exits 0 on Ctrl-C and deletes its database", () =>
  Effect.gen(function* devStopsOnInterrupt() {
    const node = yield* Layer.build(NodeServices.layer);
    const { database, exitCode } = yield* interruptDevBinary();
    const kept = yield* Effect.orDie(Context.get(node, FileSystem.FileSystem).exists(database));

    expect(database).toContain("cookout-dev-");
    expect(exitCode).toBe(EXIT_SUCCESS);
    expect(kept).toBe(false);
  }),
);
