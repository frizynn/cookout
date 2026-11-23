import { Array as Arr, Effect, Option, pipe } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import type { MessageId, Reply } from "../../index.ts";
import { TestCookout, answer, messageId, refusal, testCookout } from "../../../testing/server.ts";
import type { TestCookoutService, TestIdentity } from "../../../testing/server.ts";
import { expect, it } from "@effect/vitest";
import { TestClock } from "effect/testing";

const ONE_AT_A_TIME = { concurrency: 1 } as const;
const MISSING = 999;
const NOT_FOUND = 404;
const TWO_REPLIES = 2;
const THREE_REPLIES = 3;
const MIDDLE = 1;
const BOOT = "2026-01-01T00:00:00.000Z";

function withChannel(cookout: TestCookoutService): Effect.Effect<TestIdentity> {
  return Effect.gen(function* identityWithChannel() {
    const agent = yield* cookout.createIdentity("auth-griller", { owner: "matt" });
    yield* answer(() => agent.client.createChannel({ name: "grill" }));
    return agent;
  });
}

function replyEachSecond(agent: TestIdentity, replyTo: MessageId): Effect.Effect<readonly Reply[]> {
  return pipe(
    ["one", "two", "three"],
    Effect.forEach(
      (text) =>
        Effect.andThen(
          TestClock.adjust("1 second"),
          answer(() => agent.client.createMessage({ channel: "grill", replyTo, text })),
        ),
      ONE_AT_A_TIME,
    ),
    Effect.map(Arr.map(({ message }) => message)),
    Effect.map(Arr.filter((message) => message.kind === "reply")),
  );
}

it.effect("a reply joins the message's thread and updates its reply count and latest reply", () =>
  Effect.gen(function* replyJoinsThread() {
    const cookout = yield* TestCookout;
    const agent = yield* withChannel(cookout);
    const other = yield* cookout.createIdentity("other");
    const { message: parent } = yield* answer(() => agent.client.createMessage({ channel: "grill", text: "parent" }));
    const { message: first } = yield* answer(() =>
      other.client.createMessage({ channel: "grill", replyTo: parent.id, text: "first" }),
    );
    const { message: second } = yield* answer(() =>
      agent.client.createMessage({ channel: "grill", replyTo: parent.id, text: "second" }),
    );
    const { messages } = yield* answer(() => agent.client.listMessages("grill"));

    expect(first).toStrictEqual({
      author: { name: "other", owner: "admin" },
      channel: "grill",
      createdAt: BOOT,
      id: first.id,
      kind: "reply",
      mentions: [],
      replyTo: parent.id,
      text: "first",
    });
    expect(second.id).toBeGreaterThan(first.id);
    expect(messages).toStrictEqual([{ ...parent, latestReplyId: second.id, replyCount: TWO_REPLIES }]);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a reply to a reply lands on the parent's thread (replyTo is the top-level message)", () =>
  Effect.gen(function* replyToReply() {
    const cookout = yield* TestCookout;
    const agent = yield* withChannel(cookout);
    const { message: parent } = yield* answer(() => agent.client.createMessage({ channel: "grill", text: "parent" }));
    const { message: reply } = yield* answer(() =>
      agent.client.createMessage({ channel: "grill", replyTo: parent.id, text: "reply" }),
    );
    const { message: nested } = yield* answer(() =>
      agent.client.createMessage({ channel: "grill", replyTo: reply.id, text: "nested" }),
    );
    const thread = yield* answer(() => agent.client.getThread(parent.id));

    expect(nested).toMatchObject({ replyTo: parent.id });
    expect(thread).toMatchObject({
      parent: { id: parent.id, latestReplyId: nested.id, replyCount: TWO_REPLIES },
      replies: [{ text: "reply" }, { text: "nested" }],
    });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a thread is the parent plus its replies in order, and can be got from any message in it", () =>
  Effect.gen(function* wholeThread() {
    const cookout = yield* TestCookout;
    const agent = yield* withChannel(cookout);
    const { message: parent } = yield* answer(() =>
      agent.client.createMessage({ channel: "grill", data: { step: "parent" }, text: "parent" }),
    );
    const replies = yield* replyEachSecond(agent, parent.id);
    yield* answer(() => agent.client.createMessage({ channel: "grill", text: "elsewhere" }));
    const fromParent = yield* answer(() => agent.client.getThread(parent.id));
    const fromReply = yield* answer(() => agent.client.getThread(Option.getOrThrow(Arr.get(replies, MIDDLE)).id));

    expect(fromParent).toStrictEqual({
      parent: { ...parent, latestReplyId: Option.getOrThrow(Arr.last(replies)).id, replyCount: THREE_REPLIES },
      replies,
    });
    expect(replies).toMatchObject([
      { createdAt: "2026-01-01T00:00:01.000Z", text: "one" },
      { createdAt: "2026-01-01T00:00:02.000Z", text: "two" },
      { createdAt: "2026-01-01T00:00:03.000Z", text: "three" },
    ]);
    expect(fromReply).toStrictEqual(fromParent);
  }).pipe(Effect.provide(testCookout())),
);

it.effect("a message with no replies is a thread of its own", () =>
  Effect.gen(function* aloneThread() {
    const cookout = yield* TestCookout;
    const agent = yield* withChannel(cookout);
    const { message } = yield* answer(() => agent.client.createMessage({ channel: "grill", text: "alone" }));
    const thread = yield* answer(() => agent.client.getThread(message.id));

    expect(thread).toStrictEqual({ parent: message, replies: [] });
  }).pipe(Effect.provide(testCookout())),
);

it.effect("getting the thread of a missing message is a 404", () =>
  Effect.gen(function* missingThread() {
    const cookout = yield* TestCookout;
    const agent = yield* withChannel(cookout);
    const error = yield* refusal(() => agent.client.getThread(messageId(MISSING)));
    const zero = HttpClientRequest.get(`${cookout.url}/v1/messages/0/thread`);
    const zeroAnswer = yield* HttpClient.execute(HttpClientRequest.bearerToken(zero, agent.token));
    const zeroBody = yield* zeroAnswer.json;

    expect(error).toMatchObject({ code: "message_not_found", status: 404 });
    expect(zeroBody).toMatchObject({ error: { code: "message_not_found" } });
  }).pipe(Effect.provide([testCookout(), FetchHttpClient.layer])),
);

it.effect("a thread path whose message ID isn't digits is no route: 404 not_found, with or without a token", () =>
  Effect.gen(function* notAnId() {
    const cookout = yield* TestCookout;
    const agent = yield* withChannel(cookout);
    const thread = HttpClientRequest.get(`${cookout.url}/v1/messages/one/thread`);
    const withToken = yield* HttpClient.execute(HttpClientRequest.bearerToken(thread, agent.token));
    const withoutToken = yield* HttpClient.execute(thread);
    const bodies = yield* Effect.all([withToken.json, withoutToken.json], ONE_AT_A_TIME);

    expect([withToken.status, withoutToken.status]).toStrictEqual([NOT_FOUND, NOT_FOUND]);
    expect(bodies).toMatchObject([{ error: { code: "not_found" } }, { error: { code: "not_found" } }]);
  }).pipe(Effect.provide([testCookout(), FetchHttpClient.layer])),
);
