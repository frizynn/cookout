import { Array as Arr, Effect, Option, Predicate, String as Str } from "effect";
import type { JsonValue, Message, MessageId } from "../../index.ts";
import {
  TestCookout,
  answer,
  refusal,
  testCookout,
  testRoutineFirePath,
  testRoutineToken,
} from "../../../testing/server.ts";
import type { TestCookoutService, TestIdentity } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import type { WebhookCall } from "../../../webhook-fake/server.ts";

const BOARD = "https://board.example.com";
const SESSION_URL = "https://sessions.example.com/code/session_test";
const UNAUTHORIZED = 401;
const BAD_REQUEST = 400;
const ONE_CALL = 1;
const fired = {
  claude_code_session_id: "session_test",
  claude_code_session_url: SESSION_URL,
  type: "routine_fire",
};
const task = { name: "fixer", task: "  Fix the flaky login test.  " };
const spawningCookout = testCookout({ publicUrl: BOARD, routine: "fake" });

interface Spawned {
  readonly cookout: TestCookoutService;
  readonly ada: TestIdentity;
  readonly threadId: MessageId;
}

function spawnedBy(data: JsonValue): Effect.Effect<Spawned, never, TestCookout> {
  return Effect.gen(function* callSpawn() {
    const cookout = yield* TestCookout;
    const ada = yield* cookout.createIdentity("ada", { kind: "human" });
    yield* answer(() => cookout.client.createChannel({ name: "grill" }));
    const called = yield* answer(() => ada.client.callCommand("spawn-agent", { channel: "grill", data }));
    return { ada, cookout, threadId: called.threadId };
  });
}

function replyIn({ cookout, threadId }: Spawned): Effect.Effect<Message> {
  return answer(() => cookout.client.getThread(threadId)).pipe(
    Effect.repeat({ until: ({ replies }) => Arr.isReadonlyArrayNonEmpty(replies) }),
    Effect.map(({ replies }) => Option.getOrThrow(Arr.head(replies))),
  );
}

interface Fired {
  readonly call: WebhookCall;
  readonly text: string;
}

function textIn(body: unknown): string {
  if (Predicate.hasProperty(body, "text") && Predicate.isString(body.text)) {
    return body.text;
  }
  return expect.unreachable("The routine was fired with no text.");
}

function firedCall(spawned: Spawned): Effect.Effect<Fired> {
  return Effect.map(spawned.cookout.webhook.waitForCalls(ONE_CALL), (calls) => {
    const call = Option.getOrThrow(Arr.head(calls));
    return { call, text: textIn(call.body) };
  });
}

it.effect("/spawn-agent creates an agent the caller owns and fires the routine with its join code", () =>
  Effect.gen(function* spawn() {
    const cookout = yield* TestCookout;
    yield* cookout.webhook.answerWith(fired);
    const spawned = yield* spawnedBy(task);
    const reply = yield* replyIn(spawned);
    const { call, text } = yield* firedCall(spawned);
    const agent = yield* answer(() => cookout.client.getIdentity("fixer"));

    expect(call).toMatchObject({
      headers: {
        "anthropic-beta": "experimental-cc-routine-2026-04-01",
        "anthropic-version": "2023-06-01",
        authorization: `Bearer ${testRoutineToken}`,
      },
      method: "POST",
      path: testRoutineFirePath,
    });
    expect(Str.split(text, "\n")).toMatchObject([
      `board: ${BOARD}`,
      "agent: fixer",
      expect.stringMatching(/^join code: cookout_\S+$/u),
      "channel: grill",
      `thread: ${spawned.threadId}`,
      "task: Fix the flaky login test.",
    ]);
    expect(agent.identity).toMatchObject({ description: "Fix the flaky login test.", owner: "ada" });
    expect(reply).toMatchObject({
      author: { name: "spawn-agent" },
      text: `Spawned @fixer, owned by @ada, in the session ${SESSION_URL}`,
    });
  }).pipe(Effect.provide(spawningCookout)),
);

it.effect("the join code fired to the routine joins only the spawned agent, once", () =>
  Effect.gen(function* redeemFired() {
    const cookout = yield* TestCookout;
    yield* cookout.webhook.answerWith(fired);
    const spawned = yield* spawnedBy(task);
    yield* replyIn(spawned);
    const { text } = yield* firedCall(spawned);
    const joinCode = Str.replace(/^[\s\S]*join code: (?<code>\S+)[\s\S]*$/u, "$<code>")(text);
    const session = yield* answer(() => cookout.clientFor().redeemJoinCode({ joinCode }));
    const again = yield* refusal(() => cookout.clientFor().redeemJoinCode({ joinCode }));

    expect(session).toMatchObject({ identity: "fixer" });
    expect(again).toMatchObject({ code: "join_code_not_found" });
  }).pipe(Effect.provide(spawningCookout)),
);

it.effect("a failed fire says why in the thread and deactivates the new agent", () =>
  Effect.gen(function* failedFire() {
    const cookout = yield* TestCookout;
    yield* cookout.webhook.failNext(ONE_CALL, UNAUTHORIZED);
    const spawned = yield* spawnedBy(task);
    const reply = yield* replyIn(spawned);
    const agent = yield* answer(() => cookout.client.getIdentity("fixer"));

    expect(reply.text).toBe("The routine didn't start a session (the routine answered 401), so @fixer is deactivated.");
    expect(agent.identity).toMatchObject({ deactivated: true, name: "fixer" });
  }).pipe(Effect.provide(spawningCookout)),
);

it.effect("a fire answered with no session says so, and deactivates the new agent", () =>
  Effect.gen(function* noSession() {
    const spawned = yield* spawnedBy(task);
    const reply = yield* replyIn(spawned);

    expect(reply.text).toBe(
      "The routine didn't start a session (the routine's answer named no session), so @fixer is deactivated.",
    );
  }).pipe(Effect.provide(spawningCookout)),
);

it.effect("a routine that can't be reached is answered in the thread, and the new agent is deactivated", () =>
  Effect.gen(function* unreachable() {
    const spawned = yield* spawnedBy(task);
    const reply = yield* replyIn(spawned);

    expect(reply.text).toBe(
      "The routine didn't start a session (the routine couldn't be reached within 5 s), so @fixer is deactivated.",
    );
  }).pipe(Effect.provide(testCookout({ publicUrl: BOARD, routine: "unreachable" }))),
);

it.effect("every /spawn-agent reply posts as the one spawn-agent identity", () =>
  Effect.gen(function* twoReplies() {
    const first = yield* spawnedBy(task);
    const again = yield* answer(() => first.ada.client.callCommand("spawn-agent", { channel: "grill", data: task }));
    const replies = yield* Effect.all([replyIn(first), replyIn({ ...first, threadId: again.threadId })], {
      concurrency: 1,
    });

    expect(Arr.map(replies, ({ author }) => author.name)).toStrictEqual(["spawn-agent", "spawn-agent"]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("without the routine settings, /spawn-agent answers that spawning is not set up, and makes nothing", () =>
  Effect.gen(function* notSetUp() {
    const spawned = yield* spawnedBy(task);
    const reply = yield* replyIn(spawned);
    const calls = yield* spawned.cookout.webhook.calls;
    const missing = yield* refusal(() => spawned.cookout.client.getIdentity("fixer"));

    expect(reply).toMatchObject({ author: { name: "spawn-agent" } });
    expect(reply.text).toContain("Spawning is not set up on this board");
    expect([calls, missing]).toMatchObject([[], { code: "identity_not_found" }]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("/spawn-agent refuses data that isn't a name and a task, and a taken name is answered in the thread", () =>
  Effect.gen(function* refusals() {
    const cookout = yield* TestCookout;
    const ada = yield* cookout.createIdentity("ada", { kind: "human" });
    yield* cookout.createIdentity("fixer", { owner: "ada" });
    yield* answer(() => cookout.client.createChannel({ name: "grill" }));
    const noTask = yield* refusal(() =>
      ada.client.callCommand("spawn-agent", { channel: "grill", data: { name: "fixer" } }),
    );
    const called = yield* answer(() => ada.client.callCommand("spawn-agent", { channel: "grill", data: task }));
    const reply = yield* replyIn({ ada, cookout, threadId: called.threadId });

    expect(noTask).toMatchObject({ code: "invalid_request", status: BAD_REQUEST });
    expect(reply.text).toBe("@fixer couldn't be made: The name fixer is taken.");
  }).pipe(Effect.provide(spawningCookout)),
);

it.effect("only a human can spawn an agent", () =>
  Effect.gen(function* agentCaller() {
    const cookout = yield* TestCookout;
    const bot = yield* cookout.createIdentity("bot");
    yield* answer(() => cookout.client.createChannel({ name: "grill" }));
    const called = yield* answer(() => bot.client.callCommand("spawn-agent", { channel: "grill", data: task }));
    const reply = yield* replyIn({ ada: bot, cookout, threadId: called.threadId });
    const calls = yield* cookout.webhook.calls;

    expect(reply.text).toBe("Only a human can spawn an agent, since the agent is owned by whoever spawns it.");
    expect(calls).toStrictEqual([]);
  }).pipe(Effect.provide(spawningCookout)),
);

it.effect("GET /v1/commands lists /spawn-agent with its name and task fields, beside the registered commands", () =>
  Effect.gen(function* listed() {
    const cookout = yield* TestCookout;
    yield* answer(() =>
      cookout.client.addCommand({ name: "zip", schema: { type: "object" }, url: "https://hooks.example.com/zip" }),
    );
    const ada = yield* cookout.createIdentity("ada", { kind: "human" });
    const { commands } = yield* answer(ada.client.listCommands);

    expect(Arr.map(commands, ({ name }) => name)).toStrictEqual(["spawn-agent", "zip"]);
    expect(Arr.head(commands)).toMatchObject(
      Option.some({
        description: "Start a remote Claude Code session that works on this board as a new agent you own.",
        handler: "spawn-agent",
        schema: {
          properties: { name: { type: "string" }, task: { type: "string" } },
          required: ["name", "task"],
          type: "object",
        },
      }),
    );
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a registered command named spawn-agent is listed once, as the one the server handles", () =>
  Effect.gen(function* shadowed() {
    const cookout = yield* TestCookout;
    yield* answer(() =>
      cookout.client.addCommand({ name: "spawn-agent", schema: { type: "object" }, url: "https://hooks.example.com" }),
    );
    const { commands } = yield* answer(cookout.client.listCommands);

    expect(Arr.map(commands, ({ name, url }) => [name, url])).toStrictEqual([["spawn-agent", ""]]);
  }).pipe(Effect.provide(testCookout())),
);
