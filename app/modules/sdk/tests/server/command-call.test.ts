import { TestCookout, answer, commandFixture, refusal, testCookout } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import type { TestCookoutService } from "../../../testing/server.ts";

const NO_REPLIES = 0;
const schema = { properties: { branch: { type: "string" } }, required: ["branch"], type: "object" };
const deploy = { name: "deploy", schema, url: "https://hooks.example.com/deploy" };

function withDeployInGrill(cookout: TestCookoutService): Effect.Effect<void> {
  return Effect.gen(function* addDeploy() {
    yield* answer(() => cookout.client.addCommand(deploy));
    yield* answer(() => cookout.client.createChannel({ name: "grill" }));
  });
}

it.effect(
  "a call whose data breaks the command's schema is refused with 400 and the schema errors, and posts nothing",
  () =>
    Effect.gen(function* badData() {
      const cookout = yield* TestCookout;
      yield* withDeployInGrill(cookout);
      const ann = yield* cookout.createIdentity("ann");
      const missing = yield* refusal(() => ann.client.callCommand("deploy", { channel: "grill", data: {} }));
      const wrongType = yield* refusal(() =>
        ann.client.callCommand("deploy", { channel: "grill", data: { branch: 1 } }),
      );
      const { messages } = yield* answer(() => ann.client.listMessages("grill"));

      expect([missing, wrongType]).toMatchObject([
        {
          code: "invalid_request",
          details: [{ message: "must have required property 'branch'", path: ["data"] }],
          status: 400,
        },
        { code: "invalid_request", details: [{ message: "must be string", path: ["data", "branch"] }], status: 400 },
      ]);
      expect(messages).toStrictEqual([]);
    }).pipe(Effect.provide(testCookout())),
);

it.effect("a good call answers 202 with its thread, posts the call by the caller, and the caller follows it", () =>
  Effect.gen(function* goodCall() {
    const cookout = yield* TestCookout;
    yield* withDeployInGrill(cookout);
    const ann = yield* cookout.createIdentity("ann");
    const called = yield* answer(() =>
      ann.client.callCommand("deploy", { channel: "grill", data: { branch: "main" } }),
    );
    const { messages } = yield* answer(() => ann.client.listMessages("grill"));
    const { message: reply } = yield* answer(() =>
      cookout.client.createMessage({ channel: "grill", replyTo: called.threadId, text: "on it" }),
    );
    const { items } = yield* answer(() => ann.client.inbox());

    expect(called).toStrictEqual({ messageId: called.threadId, threadId: called.threadId });
    expect(messages).toMatchObject([
      {
        author: { name: "ann" },
        data: { command: "deploy", data: { branch: "main" } },
        id: called.messageId,
        kind: "top-level",
        replyCount: NO_REPLIES,
      },
    ]);
    expect(items).toMatchObject([{ message: reply, reasons: ["followed-thread"] }]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a call to a command that doesn't exist, or into a channel that doesn't, is refused with 404", () =>
  Effect.gen(function* missing() {
    const cookout = yield* TestCookout;
    yield* withDeployInGrill(cookout);
    const noCommand = yield* refusal(() =>
      cookout.client.callCommand("release", { channel: "grill", data: { branch: "main" } }),
    );
    const notAName = yield* refusal(() =>
      cookout.client.callCommand("Deploy", { channel: "grill", data: { branch: "main" } }),
    );
    const noChannel = yield* refusal(() =>
      cookout.client.callCommand("deploy", { channel: "lounge", data: { branch: "main" } }),
    );

    expect([noCommand, notAName, noChannel]).toMatchObject([
      { code: "command_not_found", status: 404 },
      { code: "command_not_found", status: 404 },
      { code: "channel_not_found", status: 404 },
    ]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a call to a stored command whose schema doesn't compile fails with 500 and posts nothing", () =>
  Effect.gen(function* storedBadSchema() {
    const cookout = yield* TestCookout;
    const stored = commandFixture("deploy");
    yield* cookout.seedCommand({ ...stored, command: { ...stored.command, schema: { type: "strnig" } } });
    yield* answer(() => cookout.client.createChannel({ name: "grill" }));
    const error = yield* refusal(() => cookout.client.callCommand("deploy", { channel: "grill", data: {} }));
    const { messages } = yield* answer(() => cookout.client.listMessages("grill"));

    expect(error).toMatchObject({ code: "internal_error", status: 500 });
    expect(messages).toStrictEqual([]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a command whose schema is not a JSON Schema is refused with 400 when it is added", () =>
  Effect.gen(function* badSchema() {
    const cookout = yield* TestCookout;
    const error = yield* refusal(() => cookout.client.addCommand({ ...deploy, schema: { type: "strnig" } }));
    const { commands } = yield* answer(cookout.client.listCommands);

    expect(error).toMatchObject({ code: "invalid_request", details: [{ path: ["schema"] }], status: 400 });
    expect(commands).toStrictEqual([]);
  }).pipe(Effect.provide(testCookout())),
);
